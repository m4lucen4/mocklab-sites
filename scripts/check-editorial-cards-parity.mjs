import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import vm from "node:vm";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = resolve(root, "src/components/EditorialCards.astro");
const layoutPath = resolve(root, "src/layouts/BaseLayout.astro");
const astroCliPath = resolve(root, "node_modules/astro/bin/astro.mjs");

const populatedConfig = {
  cards: [
    {
      image_url: 'https://cdn.example.test/card?title=Tea&ref="feature"',
      title: 'First <story> & "quote"',
      description: "<p>Rich <strong>HTML</strong> &amp; entities</p><ul><li>One</li></ul>",
      text_secondary_button: "Read <more> & now",
      url_secondary_button: "https://example.test/story?source=site&campaign=editorial",
    },
    {
      image_url: "",
      title: "",
      description: "",
      text_secondary_button: "Read internally",
      url_secondary_button: "/insights?source=site&view=all",
    },
  ],
};

const emptyConfig = {
  cards: [{}, {}],
};

const incompleteLinkConfig = {
  cards: [
    { text_secondary_button: "Missing URL" },
    { url_secondary_button: "/missing-label" },
  ],
};

function normalizeHtml(html) {
  return html.replace(/\s+/g, " ").trim();
}

function canonicalizeEntities(html) {
  const entityValues = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  const canonicalEntities = {
    "&": "&amp;",
    "'": "&#39;",
    ">": "&gt;",
    "<": "&lt;",
    '"': "&quot;",
  };

  return html.replace(/&(?:#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity) => {
    const entityName = entity.slice(1, -1).toLowerCase();
    const value = entityName.startsWith("#x")
      ? String.fromCodePoint(Number.parseInt(entityName.slice(2), 16))
      : entityName.startsWith("#")
        ? String.fromCodePoint(Number.parseInt(entityName.slice(1), 10))
        : entityValues[entityName];

    return canonicalEntities[value] ?? entity;
  });
}

function normalizeSemantics(html) {
  return canonicalizeEntities(normalizeHtml(html));
}

async function getClientBuilder() {
  const layout = await readFile(layoutPath, "utf8");
  const builderStart = layout.indexOf("function buildEditorialCardsHtml(config)");
  const builderEnd = layout.indexOf("function buildProjectColumnsHtml");
  const escapeStart = layout.indexOf("function escapeHtml(str)");
  const escapeEnd = layout.indexOf("// ─── Lightbox / Carousel");

  if ([builderStart, builderEnd, escapeStart, escapeEnd].some((index) => index === -1)) {
    throw new Error("Could not locate the editorial cards client renderer.");
  }

  const context = {
    document: {
      createElement() {
        return {
          appendChild(node) {
            this.node = node;
          },
          get innerHTML() {
            return this.node.value
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\"/g, "&quot;")
              .replace(/'/g, "&#39;");
          },
        };
      },
      createTextNode(value) {
        return { value };
      },
    },
  };

  vm.runInNewContext(`${layout.slice(escapeStart, escapeEnd)}${layout.slice(builderStart, builderEnd)}`, context);
  return context.buildEditorialCardsHtml;
}

async function renderSsr() {
  const fixture = await mkdtemp(resolve(root, ".editorial-cards-parity-"));
  const pagesDirectory = resolve(fixture, "src/pages");
  const fixturePage = `---
import EditorialCards from ${JSON.stringify(componentPath)};
const populatedConfig = ${JSON.stringify(populatedConfig)};
const emptyConfig = ${JSON.stringify(emptyConfig)};
const incompleteLinkConfig = ${JSON.stringify(incompleteLinkConfig)};
---
<EditorialCards config={populatedConfig} />
<EditorialCards config={emptyConfig} />
<EditorialCards config={incompleteLinkConfig} />
`;

  try {
    await writeFile(resolve(fixture, "astro.config.mjs"), "export default {};\n");
    await mkdir(pagesDirectory, { recursive: true });
    await writeFile(resolve(pagesDirectory, "index.astro"), fixturePage);
    await execFileAsync(process.execPath, [astroCliPath, "build"], { cwd: fixture });
    return await readFile(resolve(fixture, "dist/index.html"), "utf8");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

function extractSections(html) {
  return html.match(/<section data-component="editorial_cards"[\s\S]*?<\/section>/g) ?? [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const clientBuilder = await getClientBuilder();
const clientHtml = clientBuilder(populatedConfig);
const emptyClientHtml = clientBuilder(emptyConfig);
const incompleteLinkClientHtml = clientBuilder(incompleteLinkConfig);
const ssrHtml = await renderSsr();
const [ssrSection] = extractSections(ssrHtml);

assert(ssrSection, "SSR did not render the populated editorial cards section.");
assert(extractSections(ssrHtml).length === 1, "SSR rendered a section for empty cards or incomplete links.");
assert(emptyClientHtml === "", "Client rendered a section for two empty cards.");
assert(incompleteLinkClientHtml === "", "Client rendered a section for incomplete links.");
assert(
  normalizeSemantics(ssrSection) === normalizeSemantics(clientHtml),
  `SSR and client editorial cards output differs.\nSSR: ${normalizeSemantics(ssrSection)}\nClient: ${normalizeSemantics(clientHtml)}`,
);

assert((clientHtml.match(/<article /g) ?? []).length === 2, "Expected two populated editorial card articles.");
assert(clientHtml.includes('<strong>HTML</strong>'), "Rich HTML description was not preserved.");
assert(clientHtml.includes('target="_blank" rel="noopener noreferrer"'), "External link attributes are missing.");
assert(clientHtml.includes('src="https://cdn.example.test/card?title=Tea&amp;ref=&quot;feature&quot;"'), "Image attribute was not escaped and rendered.");
assert(clientHtml.includes('href="https://example.test/story?source=site&amp;campaign=editorial"'), "External link attribute was not escaped and rendered.");
assert(clientHtml.includes('href="/insights?source=site&amp;view=all"'), "Internal link attribute was not escaped and rendered.");
assert(!clientHtml.includes('<img src=""'), "Empty image field rendered an image.");
assert(!clientHtml.includes('<h2 class="text-2xl font-bold"></h2>'), "Empty title field rendered a heading.");
assert(clientHtml.includes('First &lt;story&gt; &amp; &quot;quote&quot;'), "Title escaping is missing.");
assert(clientHtml.includes('Read &lt;more&gt; &amp; now'), "Link text escaping is missing.");

console.log("Editorial cards SSR/client parity verified with rendered two-card and empty-card fixtures.");
