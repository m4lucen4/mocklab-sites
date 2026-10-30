# Display project language versions

The public Projects listing and both project-detail layouts use the versions authored in Galia. The existing site language settings remain authoritative: ES/EN/CA, site default on SSR, validated visitor preference on load, and live selector changes.

## Resolution rules

| Input | Display |
|---|---|
| Nonblank translated title/description/keywords | That field from the selected language |
| Missing version or NULL/empty/whitespace field | Original project field, independently |
| Selected original language | Original project fields |
| No language metadata (legacy project) | Original fields; no inferred original language |
| Disabled language | Not selectable; its translation is not serialized into the browser |

Original projects remain immutable. Switching back never translates from already translated DOM. Keywords use a complete replacement set, not a mixture of languages. Categories, years, image URLs, project IDs/links, project order/visibility and view/category filters retain their previous behavior. Keywords appear where the existing detail layout exposes them; this feature does not add new metadata sections to other layouts.

Home/custom-page ProjectColumns, page/component authored text, legal content and site metadata are outside this Projects-page scope.

## Server and browser boundary

- The existing server-only admin project loader still filters by site owner. It embeds only translation language/text fields, using left relationships so projects without versions remain visible. Published-site and route checks remain unchanged.
- Lists carry an escaped, explicit public text projection, never a complete admin project record. Live language changes update card text and image alt attributes in place, preserving filters/view state.
- Detail pages render the default article plus inert templates for other enabled languages. Switching clones the selected Astro-rendered article, preserving both detail designs and delegated lightbox behavior without a second handwritten detail renderer. Template images are not live gallery nodes. There are at most three enabled languages.
- Project descriptions are plain authored text with paragraph/newline formatting, safely escaped before HTML construction. Other rich-text site components are unchanged.
- The existing fixed-label renderer emits an additive `site:languagechange` notification. Project scripts also initialize from the restored global/document language, so early language restoration is not missed.

No browser service-role key, protected-table fetch, new public API endpoint, RLS relaxation or database mutation is introduced.

## Checks

Run `pnpm check:project-translations`. It uses synthetic projects and a fake Supabase backend, checks pure fallback/scoping/escaping, builds real Astro fixtures, and drives Chrome through actual BaseLayout language restoration/selection. It covers both list layouts/detail types, partial and absent content, original restoration, disabled/invalid/mono-language states, filter/view preservation (including clearing an alternating-grid filter after language switching), inert detail galleries/lightbox and secret exclusion.

Chrome is required. Set `CHROME_PATH` to its executable when it is not at the macOS default. Failure or browser unavailability is not a pass. Fixtures, browser profile and HTTP server are scoped to this repository and removed afterward; no real customer data or Supabase writes are used.

Also run `pnpm exec astro check`, `pnpm check:editorial-cards-parity` and `pnpm build`. Deployment and live-site verification remain separate operator actions.

## Prerequisite and rollout

The dashboard migration `20261030000100_add_project_translations.sql` must already exist in the same backend, exposing the settings/translation tables and foreign keys. Missing schema is an installation error, not an absent translation. Anonymous table access remains revoked; this renderer uses its existing server-only client.

This work does not apply migrations, publish, push or deploy. Deploy the compatible renderer only after schema availability has been confirmed.
