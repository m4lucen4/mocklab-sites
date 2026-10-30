import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
