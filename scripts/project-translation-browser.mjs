import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function verifyBrowser(fixture, projectId) {
  const dist = resolve(fixture, 'dist');
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(dist, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (!path.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)];
      res.setHeader('Content-Type', mime || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(resolve(fixture, 'chrome-'));
  let chrome, socket, timer, session, sequence = 0;
  const pending = new Map(), events = new Map();
  const call = (method, params = {}, browser = false) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(!browser && session ? { sessionId: session } : {}) }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = condition => evaluate(`new Promise((resolve,reject)=>{const deadline=Date.now()+6000;function check(){if(${condition})resolve(true);else if(Date.now()>deadline)reject(Error('Condition not met: '+${JSON.stringify(condition)}));else requestAnimationFrame(check)}check()})`);
  const navigate = async page => {
    const loaded = new Promise(resolve => events.set('Page.loadEventFired', resolve));
    await call('Page.navigate', { url: base + '/' + page + '/' });
    await loaded;
    await wait("document.body.classList.contains('styles-ready') && !!window.__siteLang");
    assert.ok(await evaluate("window.__fixtureRequests.length > 0 && window.__fixtureRequests.every(table=>['sites','site_pages','site_components'].includes(table))"), 'Unexpected or missing synthetic backend requests');
  };
  const choose = async language => {
    await evaluate(`document.querySelector('[data-lang-btn="${language}"]').click()`);
    await wait(`window.__siteLang === ${JSON.stringify(language)}`);
    // Module scripts may bind after BaseLayout restores the language.
    await wait(`!document.querySelector('[data-project-detail-language]') || document.querySelector('[data-project-detail-language]').dataset.projectDetailLanguage === ${JSON.stringify(language)}`);
  };
  const title = () => evaluate(`document.querySelector('[data-project-id="${projectId}"] [data-project-title]')?.textContent`);
  const active = selector => `document.querySelector('[data-project-detail-active] ${selector}')`;

  try {
    chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
      '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-extensions',
      '--disable-sync', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const startup = setTimeout(() => reject(new Error('Chrome startup unavailable; set CHROME_PATH.')), 10000);
      chrome.once('error', error => { clearTimeout(startup); reject(error); });
      chrome.stderr.on('data', chunk => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(startup); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const request = pending.get(message.id); pending.delete(message.id);
        if (request) message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      } else if (events.has(message.method)) {
        const resolve = events.get(message.method); events.delete(message.method); resolve(message.params);
      }
    };
    timer = setTimeout(() => {
      for (const request of pending.values()) request.reject(new Error('Project translation browser checks timed out'));
      chrome.kill('SIGTERM');
    }, 45000);
    const target = await call('Target.createTarget', { url: 'about:blank' }, true);
    session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, true)).sessionId;
    await call('Page.enable'); await call('Network.enable');
    await call('Network.setBlockedURLs', { urls: ['https://*'] });
    await call('Page.addScriptToEvaluateOnNewDocument', { source: "if(!sessionStorage.getItem('translation-seeded')){localStorage.setItem('site_language:fixture-studio','en');sessionStorage.setItem('translation-seeded','1')}" });

    await navigate('es-grid4');
    await wait(`document.querySelector('[data-project-id="${projectId}"] [data-project-title]')?.textContent === 'English title'`);
    assert.equal(await title(), 'English title', 'Stored EN language did not update preserved SSR cards');
    assert.ok(await evaluate("document.querySelector('[data-project-id=\"empty\"] [data-project-description]').textContent.includes('English description')"));
    await evaluate("window.__originalList=document.querySelector('[data-project-texts]');document.getElementById('btn-view-list').click();const s=document.getElementById('keyword-select');s.value='Residencial';s.dispatchEvent(new Event('change',{bubbles:true}))");
    await choose('ca');
    assert.equal(await title(), 'Original title');
    assert.equal(await evaluate("document.querySelector('[data-project-texts]')===window.__originalList"), true);
    assert.equal(await evaluate("document.getElementById('view-list').classList.contains('hidden')"), false);
    assert.match(await evaluate("document.getElementById('active-pills').textContent"), /Residencial/);
    assert.equal(await evaluate("document.querySelector('[data-project-id=\"empty\"] [data-project-description]').hidden"), true);
    await choose('es'); assert.equal(await title(), 'Original title');
    await choose('en'); assert.equal(await title(), 'English title');
    assert.equal(await evaluate(`document.querySelector('[data-project-id="${projectId}"]').getAttribute('href')`), '/fixture-studio/proyectos/' + projectId);

    for (const type of [1, 2]) {
      // Each case starts from a deliberate visitor preference; the prior case
      // finishes on ES to verify switching back to the original.
      await evaluate("localStorage.setItem('site_language:fixture-studio','en')");
      console.log(`Checking detail layout ${type} with restored EN preference.`);
      await navigate('es-detail' + type);
      await wait(`${active('h1')}?.textContent.trim() === 'English title'`);
      await choose('ca');
      assert.equal(await evaluate(active('h1') + '.textContent.trim()'), 'Original title');
      assert.ok(await evaluate(active('article') + '.textContent.includes("Descripció catalana")'));
      assert.ok(await evaluate(active('article') + '.textContent.includes("Segon paràgraf")'));
      assert.equal(await evaluate("document.querySelectorAll('#page-content img[data-lightbox]').length"), 1, 'Inert detail variants duplicated live gallery images');
      assert.equal(await evaluate("document.querySelectorAll('#page-content [data-preserve]').length"), 1);
      await evaluate(active('img[data-lightbox]') + '.click()');
      assert.equal(await evaluate('document.body.style.overflow'), 'hidden', 'Replaced detail gallery lost delegated lightbox');
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      assert.equal(await evaluate('document.body.style.overflow'), '');
      await choose('en');
      assert.ok(await evaluate(active('article') + '.textContent.includes("Original description")'));
      if (type === 1) assert.ok(await evaluate(active('article') + '.textContent.includes("english")'));
      assert.equal(await evaluate('window.__projectInjected'), undefined);
      await choose('es');
      assert.equal(await evaluate(active('h1') + '.textContent.trim()'), 'Original title');
    }
    await navigate('es-alternating'); await choose('en');
    assert.equal(await title(), 'English title');
    await evaluate("(()=>{const s=document.getElementById('keyword-select');s.value='Interiorismo';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await choose('ca');
    await evaluate("document.querySelector('[data-remove-filter=Interiorismo]').click()");
    assert.equal(await title(), 'Original title', 'Detached cards restored after filter removal kept a stale language');
    assert.equal(await evaluate(`document.querySelector('#view-grid [data-project-id="${projectId}"] img').alt`), 'Original title');
    assert.ok(await evaluate(`document.querySelector('#view-grid [data-project-id="${projectId}"] [data-project-description]').textContent.includes('Descripció catalana')`));
    assert.equal(await evaluate("document.querySelectorAll('#view-grid .project-card[data-group]').length"), 2);
    await evaluate("(()=>{const s=document.getElementById('keyword-select');s.value='Interiorismo';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await choose('en');
    await evaluate("document.querySelector('[data-remove-filter=Interiorismo]').click()");
    assert.equal(await title(), 'English title', 'Reverse language switch did not update restored cards');
    await navigate('es-hidden'); await choose('en');
    assert.equal(await evaluate("document.querySelectorAll('[data-project-description]').length"), 0);
    await evaluate("localStorage.setItem('site_language:fixture-studio','xx')");
    await navigate('es-grid4'); assert.equal(await evaluate('window.__siteLang'), 'es');
    await navigate('en-mono'); assert.equal(await evaluate('window.__siteLang'), 'en');
    assert.equal(await evaluate("document.querySelectorAll('[data-lang-btn]').length"), 0);
    assert.equal(await title(), 'English title');
    assert.equal(await evaluate("JSON.parse(document.querySelector('[data-project-texts]').dataset.projectTexts)[0].translations.some(row=>row.language==='ca')"), false);
    assert.ok(await evaluate("window.__fixtureRequests.length > 0 && window.__fixtureRequests.every(table=>['sites','site_pages','site_components'].includes(table))"), 'Browser queried protected project tables');
    console.log('Chrome verified restored/live ES/EN/CA, partial fallback, filter/view preservation, both detail layouts/lightbox, hidden descriptions, invalid/mono languages, inert templates and no protected-table requests.');
  } finally {
    clearTimeout(timer);
    if (socket) socket.close();
    if (chrome && chrome.exitCode === null) { const exit = once(chrome, 'exit'); chrome.kill('SIGTERM'); await exit; }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}
