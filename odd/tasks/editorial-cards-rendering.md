# Editorial cards public rendering

## Objective and problem
Render the dashboard's existing `editorial_cards` component in the public site. Today neither SSR routes nor the client refresh recognize it, so cards disappear.

## Scope and constraints
- Authorized: this repository's editorial cards type, component, both SSR routes, client rebuild, and focused checks. Do not change dashboard data or other component types.
- Preserve existing rich-HTML convention (`set:html` / `.html-content`), text and attribute escaping, and CTA secondary-link appearance and external-link behavior.
- Exactly two ordered cards; responsive two columns to one, 4:3 cover images; omit empty optional fields and links without both text and URL.
- Existing unrelated `.claude/settings.local.json`, `.atl/`, and `odd/tasks/project-page-visibility.md` are out of scope.
- Route: delegated direct, because the change spans multiple non-trivial files; exploration mapped routes, component, types and BaseLayout.
- TDD: off (no configured TDD mode or test runner); verification runner: `pnpm astro check`, `pnpm build`, plus focused SSR/client parity check when feasible.
- Delivery strategy: ask-on-risk; estimated authored changes ~180–300 lines, below the ~400-line advisory budget. The user explicitly authorized a local commit on this feature branch; push and PR remain theirs.

## Tasks
- [x] EC-1: Implement typed editorial cards SSR component and wire both page routes; preserve card order and conventions. Acceptance: two responsive cards; fields and links render only when present; rich description uses existing HTML convention.
- [x] EC-2: Add matching client HTML builder and dispatch, plus focused SSR/client parity validation and all applicable repository checks. Acceptance: equivalent structure, classes, URLs, visibility rules and content in both paths; report exact check results.

## Progress and evidence
- Explored existing CTA, rich HTML, links, routes and client builders before writing source.
- Branch: `feat/editorial-cards-rendering` from `main` (`4f0f524`).
- EC-1: Added `EditorialCards.astro` and tuple config types, wired home and page SSR routes. Two ordered cards render as a responsive grid, with 4:3 cover images, conditional title/rich HTML/secondary CTA link, and no empty article or section. No other component types changed.
- EC-2: Added a mirrored client builder in `BaseLayout.astro` using existing `escapeHtml`/`escapeAttr`, plus `scripts/check-editorial-cards-parity.mjs` and a package command. The check actually renders Astro SSR and runs the client builder against two-card, empty-card and incomplete-link fixtures, comparing equivalent markup; it checks escaping, rich HTML, internal/external links and omitted empty fields.
- Checks: `pnpm check:editorial-cards-parity` passed (parent spot check); `pnpm astro check` passed with 0 errors and 10 existing hints (writer); `pnpm build` passed (writer); `git diff --check` passed (parent).
- Runtime smoke test against a Supabase-backed site: not run (no local fixture/project credentials). SSR/component and client builder were exercised in the parity check.
- Native review: mode on; committed-only assessment against `main` with unrelated untracked files explicitly excluded classified the feature commit as medium, `review_due: false`, `review_due_reason: under_budget` (320 changed lines). No review was started; the pending slice starts at the branch point `4f0f524`.
- Feature work-unit commit: `1e89f4b3a9c1efb69877bc5e38514ca99459542c` on `feat/editorial-cards-rendering`; no push or PR. Rollback boundary: this document, editorial component and type, two page routes, client builder, parity script and package command; unrelated local edits are excluded.
