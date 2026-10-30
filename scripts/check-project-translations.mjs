import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function loadTs(path, dependencies = {}) {
  const source = (await readFile(resolve(root, path), 'utf8'))
    .replaceAll('import.meta.env', '({ SUPABASE_URL: "https://fixture.invalid", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "server-only-sentinel" })');
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected runtime dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: path });
  return module.exports;
}

const languages = await loadTs('src/lib/siteLanguages.ts');
const { publicProjectText, projectTextForLanguage, localizeProject, projectPreview, escapeProjectText } =
  await loadTs('src/lib/projectTranslations.ts', { './siteLanguages': languages });

const project = {
  id: '9007199254740993', user: 'owner-a', title: 'Original title',
  description: 'Original description', keywords: 'original,keywords',
  category: 'Residencial', year: '2026', image_data: [{ url: '/cover.jpg' }],
  prompt: 'private prompt sentinel', assigned: 'private assignment sentinel',
  translation_settings: {
    original_language: 'es',
    translations: [
      { language: 'en', title: 'English title', description: null, keywords: 'english,tags', updated_at: 'private timestamp' },
      { language: 'ca', title: '  ', description: 'Descripció catalana', keywords: '' },
      { language: 'es', title: 'Must not replace original' },
      { language: 'xx', title: 'Unsupported' },
    ],
  },
};
const frozen = JSON.stringify(project);
const payload = publicProjectText(project);
assert.equal(payload.id, project.id);
assert.equal(publicProjectText(project, ['es']).translations.length, 0, 'Disabled-language translations reached the browser payload');
assert.equal(projectTextForLanguage(payload, 'en').title, 'English title');
assert.equal(projectTextForLanguage(payload, 'en').description, project.description);
assert.equal(projectTextForLanguage(payload, 'en').keywords, 'english,tags');
assert.equal(projectTextForLanguage(payload, 'ca').title, project.title);
assert.equal(projectTextForLanguage(payload, 'ca').description, 'Descripció catalana');
assert.equal(projectTextForLanguage(payload, 'ca').keywords, project.keywords);
assert.equal(projectTextForLanguage(payload, 'es').title, project.title);
assert.equal(projectTextForLanguage(payload, 'xx').title, project.title);
for (const field of ['title', 'description', 'keywords']) {
  for (const value of [null, '', ' ', '\n\t']) {
    const partial = { ...project, translation_settings: { original_language: 'es', translations: [{ language: 'en', [field]: value }] } };
    assert.equal(localizeProject(partial, 'en')[field], project[field]);
  }
}
for (const settings of [undefined, null, { original_language: 'ca', translations: [] }]) {
  const legacy = { ...project, translation_settings: settings };
  for (const language of ['es', 'en', 'ca']) assert.equal(localizeProject(legacy, language).title, project.title);
}
const localized = localizeProject(project, 'en');
assert.equal(localized.category, project.category);
assert.equal(localized.year, project.year);
assert.equal(localized.image_data, project.image_data);
assert.equal(JSON.stringify(project), frozen, 'Language resolution mutated the original');
const serialized = JSON.stringify(payload);
for (const forbidden of ['private prompt', 'private assignment', 'private timestamp', 'owner-a', 'server-only-sentinel']) {
  assert.ok(!serialized.includes(forbidden), `Private data leaked into public text: ${forbidden}`);
}
assert.equal(escapeProjectText('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
assert.equal(projectPreview('one two three four', 2), 'one two…');
assert.equal(projectPreview('  one  two ', 20), '  one  two ');

const requests = [];
const admin = { from(table) {
  const query = { table }; requests.push(query);
  const builder = {
    select(columns) { query.columns = columns; return builder; },
    eq(column, value) { query.filter = [column, value]; return Promise.resolve({ data: [project].filter(p => p[column] === value), error: null }); },
  };
  return builder;
} };
let clients = 0;
const server = await loadTs('src/lib/supabase.ts', {
  '@supabase/supabase-js': { createClient: () => ++clients === 1 ? {} : admin },
});
assert.equal((await server.getUserProjects('owner-a')).length, 1);
assert.equal((await server.getUserProjects('owner-b')).length, 0);
for (const query of requests) {
  assert.equal(query.table, 'projects');
  assert.equal(query.filter[0], 'user');
  assert.match(query.columns, /translation_settings:project_translation_settings/);
  assert.match(query.columns, /project_translations\(language,\s*title,\s*description,\s*keywords\)/);
  assert.ok(!query.columns.includes('!inner'), 'Legacy projects must not be filtered out');
}
console.log('Project translation field fallback, immutable public projection, escaping and owner-scoped server query verified.');

const exec = promisify(execFile);
const fixture = await mkdtemp(resolve(root, '.project-translations-check-'));
const svg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3C/svg%3E';
const renderedProject = {
  ...project, image_data: [{ url: svg }],
  translation_settings: { ...project.translation_settings, translations: project.translation_settings.translations.map(row =>
    row.language === 'ca' ? { ...row, description: 'Descripció catalana\n\nSegon paràgraf <img src=x onerror="window.__projectInjected=true">' } : row,
  ) },
};
const emptyProject = {
  ...project, id: 'empty', title: 'Empty original description', description: '', category: 'Interiorismo',
  translation_settings: { original_language: 'es', translations: [{ language: 'en', description: 'English description appears from empty original' }] },
};
const modes = ['grid4', 'alternating', 'hidden', 'detail1', 'detail2'];
try {
  await mkdir(resolve(fixture, 'src/pages'), { recursive: true });
  await writeFile(resolve(fixture, 'astro.config.mjs'), 'import tailwindcss from "@tailwindcss/vite"; export default { vite: { plugins: [tailwindcss()] } };\n');
  for (const language of ['es', 'en', 'ca']) {
    for (const mode of modes) {
      const site = {
        id: 'fixture-site', user_id: 'owner-a', slug: 'fixture-studio', studio_name: 'Fixture Studio',
        primary_color: '#111111', secondary_color: '#ffffff', tertiary_color: '#eeeeee',
        font: 'Arial', title_font: null, navbar_type: 1, logo_url: '', published: true,
        default_language: language, enabled_languages: ['es', 'en', 'ca'], multilanguage: true,
      };
      const pages = [{ id: 'home', site_id: site.id, slug: 'home', title: 'Inicio', visible: true, show_in_nav: true, position: 0 },
        { id: 'projects', site_id: site.id, slug: 'proyectos', title: 'Proyectos', visible: true, show_in_nav: true, position: 1 }];
      const mono = { ...site, default_language: 'en', enabled_languages: ['en'], multilanguage: false };
      const cases = mode === 'grid4' && language === 'en' ? [[mode, site], ['mono', mono]] : [[mode, site]];
      for (const [pageMode, fixtureSite] of cases) {
        const content = mode.startsWith('detail')
          ? `<LocalizedProjectDetail project={project} siteSlug={site.slug} language={site.default_language} languages={site.enabled_languages} detailType={${mode === 'detail2' ? 2 : 1}} />`
          : `<ProjectList projects={[project, emptyProject]} siteSlug={site.slug} language={site.default_language} languages={site.enabled_languages} layout="${mode === 'alternating' ? 'grid-alternating' : 'grid-4'}" showDescriptions={${mode !== 'hidden'}} />`;
        const pageName = language + '-' + pageMode;
        await writeFile(resolve(fixture, 'src/pages', pageName + '.astro'), `---
import BaseLayout from ${JSON.stringify(resolve(root, 'src/layouts/BaseLayout.astro'))};
import ProjectList from ${JSON.stringify(resolve(root, 'src/components/ProjectList.astro'))};
import LocalizedProjectDetail from ${JSON.stringify(resolve(root, 'src/components/LocalizedProjectDetail.astro'))};
const site = ${JSON.stringify(fixtureSite)};
const pages = ${JSON.stringify(pages)};
const project = ${JSON.stringify(renderedProject)};
const emptyProject = ${JSON.stringify(emptyProject)};
---
<BaseLayout site={site} pages={pages} currentPageSlug="proyectos" homeComponents={[]}>
  ${content}
</BaseLayout>
`);
      }
    }
  }
  await exec(process.execPath, [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: fixture,
    env: { ...process.env, SUPABASE_URL: 'https://fixture.supabase.invalid', SUPABASE_ANON_KEY: 'fixture-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-sentinel', PUBLIC_SUPABASE_URL: 'https://fixture.supabase.invalid', PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon' },
  });
  for (const language of ['es', 'en', 'ca']) {
    for (const mode of modes) {
      const path = resolve(fixture, 'dist', language + '-' + mode, 'index.html');
      let html = await readFile(path, 'utf8');
      const expected = localizeProject(renderedProject, language);
      const active = html.split('<template')[0];
      if (mode.startsWith('detail')) {
        assert.match(active, new RegExp('<h1[^>]*>\\s*' + expected.title + '\\s*</h1>'), `SSR detail did not select ${language} title`);
        if (mode === 'detail1') assert.ok(active.includes(expected.keywords.split(',')[0]), 'SSR keyword fallback failed');
      } else {
        const title = html.match(/<p[^>]*data-project-title[^>]*>([^<]*)<\/p>/)?.[1];
        assert.equal(title, expected.title, `SSR list did not select ${language} title`);
        if (mode === 'hidden') assert.ok(!html.includes('data-project-description-limit='), 'Hidden descriptions were exposed');
        else {
          const description = html.match(/<p[^>]*data-project-description[^>]*>([\s\S]*?)<\/p>/)?.[1];
          assert.ok(description.includes(escapeProjectText(expected.description.split('\n')[0])), `SSR description fallback failed for ${language}`);
          assert.ok(!description.includes('<img src=x'), 'List description created an executable node');
        }
      }
      if (mode.startsWith('detail')) assert.ok(!active.includes('<img src=x'), 'Detail description created an executable node');
      assert.ok(!html.includes('private prompt sentinel'), 'Private project data reached SSR');
      assert.ok(!html.includes('server-only-sentinel'), 'Server credential reached SSR');
      assert.ok(html.includes('/fixture-studio/proyectos/' + project.id) || mode.startsWith('detail'), 'Project link changed');
      // Install a synthetic backend before the unchanged production inline script.
      const site = { id: 'fixture-site', slug: 'fixture-studio', studio_name: 'Fixture Studio', user_id: 'owner-a',
        default_language: language, enabled_languages: ['es', 'en', 'ca'], multilanguage: true,
        font: 'Arial', primary_color: '#111111', secondary_color: '#ffffff', tertiary_color: '#eeeeee',
        published: true, navbar_type: 1, logo_url: '' };
      const pages = [{ id: 'home', site_id: site.id, slug: 'home', title: 'Inicio', visible: true, show_in_nav: true, position: 0 },
        { id: 'projects', site_id: site.id, slug: 'proyectos', title: 'Proyectos', visible: true, show_in_nav: true, position: 1 }];
      const mock = `<script>window.__fixtureRequests=[];(()=>{const original=window.fetch.bind(window);const site=${JSON.stringify(site)},pages=${JSON.stringify(pages)};window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!=='https://fixture.supabase.invalid')return original(input,init);const table=url.pathname.split('/').pop();window.__fixtureRequests.push(table);return Promise.resolve(new Response(JSON.stringify(table==='sites'?[site]:table==='site_pages'?pages:[]),{headers:{'Content-Type':'application/json'}}))}})()</script>`;
      await writeFile(path, html.replace('<head>', '<head>' + mock));
    }
  }
  const monoPath = resolve(fixture, 'dist/en-mono/index.html');
  let monoHtml = await readFile(monoPath, 'utf8');
  const monoSite = { id: 'fixture-site', slug: 'fixture-studio', studio_name: 'Fixture Studio', default_language: 'en', enabled_languages: ['en'], multilanguage: false, font: 'Arial', primary_color: '#111111', secondary_color: '#ffffff', published: true, navbar_type: 1 };
  const monoPages = [{ id: 'projects', site_id: monoSite.id, slug: 'proyectos', title: 'Proyectos', visible: true, show_in_nav: true, position: 0 }];
  const monoMock = `<script>window.__fixtureRequests=[];(()=>{const original=window.fetch.bind(window),site=${JSON.stringify(monoSite)},pages=${JSON.stringify(monoPages)};window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!=='https://fixture.supabase.invalid')return original(input,init);const table=url.pathname.split('/').pop();window.__fixtureRequests.push(table);return Promise.resolve(new Response(JSON.stringify(table==='sites'?[site]:table==='site_pages'?pages:[]),{headers:{'Content-Type':'application/json'}}))}})()</script>`;
  await writeFile(monoPath, monoHtml.replace('<head>', '<head>' + monoMock));
  console.log('Rendered Astro list/detail SSR, partial fallback, enabled-language variants and text escaping passed.');
  const { verifyBrowser } = await import('./project-translation-browser.mjs');
  await verifyBrowser(fixture, project.id);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
