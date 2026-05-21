# CLAUDE.md — mocklab-sites

## What is this project?

**mocklab-sites** is the public portfolio renderer for Mocklab. Each Mocklab user with `has_web = true` gets a public site hosted at `https://sites.mocklab.app/{slug}`. The data (site config, pages, components, projects) lives in Supabase and is configured via the **galia-dashboard** (sister project at `../galia-dashboard`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 6, SSR mode, Node adapter (standalone) |
| Styling | TailwindCSS v4 (via `@tailwindcss/vite`) |
| Backend | Supabase (`@supabase/supabase-js`) |
| Package manager | pnpm |
| Deploy | Self-hosted Node server (`node dist/server/entry.mjs`) |

---

## Directory Structure

```
src/
├── components/        # Astro components, one per site component type
│   ├── Header.astro       # Slideshow header (carousel)
│   ├── CTA.astro          # Call-to-action block (types 1, 2, 3)
│   ├── Body.astro         # Image gallery + text (types 1–4)
│   ├── Content.astro      # Rich stats/text section (types 1–2)
│   ├── ProjectList.astro  # Project grid with keyword filter
│   ├── ProjectDetail.astro  # Project detail page (currently type 1 only)
│   ├── Navigation.astro   # Navbar (types 1–2)
│   ├── Footer.astro
│   ├── LegalPage.astro    # aviso-legal / politica-cookies
│   └── CookieBanner.astro
├── layouts/
│   └── BaseLayout.astro   # Shell: <html>, CSS vars, inline hydration script, nav, footer
├── lib/
│   └── supabase.ts        # Two clients: supabase (anon/RLS) + supabaseAdmin (service role)
├── pages/
│   ├── index.astro                        # Mocklab root redirect/index
│   ├── 404.astro
│   ├── [slug]/index.astro                 # Home page of a site
│   ├── [slug]/[page].astro                # Other pages (proyectos, custom, legal)
│   └── [slug]/proyectos/[project].astro   # Project detail
├── styles/
│   └── global.css         # TailwindCSS import + body-grid utility classes
└── types/
    └── index.ts           # TypeScript interfaces (Site, SitePage, SiteComponent, Project, …)
```

---

## Routing

| URL | File | Notes |
|---|---|---|
| `/{slug}/` | `[slug]/index.astro` | Renders home page components |
| `/{slug}/{page}` | `[slug]/[page].astro` | Proyectos, custom pages, legal |
| `/{slug}/proyectos/{id}` | `[slug]/proyectos/[project].astro` | Project detail |

All pages redirect to `/404` if the site doesn't exist or `published = false`.

---

## Architecture: Dual-Fetch Pattern

**This is the most important non-obvious pattern in the project.**

1. **SSR (build-time):** The Astro page fetches data from Supabase server-side and renders HTML. This ensures content is present for crawlers and non-JS users.

2. **Client-side re-render (runtime):** `BaseLayout.astro` contains a large `<script is:inline>` that runs on every page load. It:
   - Fetches the site record to get fresh colors/fonts (CSS custom properties can be stale from SSR cache)
   - Applies `--color-primary`, `--color-secondary`, `--background-color`, `--font-family`, `--title-font` to `:root`
   - Re-fetches pages and components, then **rebuilds `#page-content` innerHTML** via `buildXxxHtml()` functions
   - Re-renders navigation with fresh data

3. **FOUC prevention:** `body` starts at `opacity: 0`, the script adds `.styles-ready` (→ `opacity: 1`) after applying styles.

4. **`data-preserve`:** Elements with this attribute on `#page-content` children are preserved when the script rebuilds HTML. Used by `ProjectList.astro` and `ProjectDetail.astro` to prevent their Astro-rendered content from being clobbered.

**Consequence:** If you add a new `buildXxxHtml()` function to the inline script, it must mirror exactly what the Astro component renders — they're two separate renderers for the same data.

---

## Supabase Clients

```ts
// src/lib/supabase.ts
supabase      // anon key — respects RLS, used for: sites, site_pages, site_components
supabaseAdmin // service role key — bypasses RLS, used ONLY for: getUserProjects()
```

`getUserProjects` uses the admin client because the `projects` table has RLS that would block anonymous reads.

---

## CSS Custom Properties

Applied by `BaseLayout` (SSR) and refreshed by the inline script (client-side):

| Property | Source |
|---|---|
| `--color-primary` | `site.primary_color` |
| `--color-secondary` | `site.secondary_color` |
| `--background-color` | `site.background_color` |
| `--font-family` | `site.font` |
| `--title-font` | `site.title_font ?? site.font` |

Use these in inline styles: `style="color: var(--color-primary);"`. Don't hardcode colors.

---

## Component Types & Configs

These mirror the `site_components.config` JSON field configured in galia-dashboard:

### `header` — `HeaderSlide[]`
Carousel (max 5 slides). Type 1: centered overlay. Type 2: left-aligned overlay.

### `cta` — `CTAConfig`
```ts
{ type: 1|2|3; title; description; subtitle; text_primary_button; url_primary_button;
  text_secondary_button; url_secondary_button; split_color }
```
Type 1: centered. Type 2: split (color block + text). Type 3: left-aligned.

### `body` — `BodyConfig`
```ts
{ type: 1|2|3|4; description; image_1?; image_2?; image_3? }
```
Types 1/3/4: multi-image grids. Type 2: single wide image. CSS classes `body-grid-{type}` in global.css.

### `content` — `ContentConfig`
```ts
{ type: 1|2; antetitulo?; titulo?; textoIzquierda?; textoDerecha?;
  dato1?; leyenda1?; dato2?; leyenda2?; dato3?; leyenda3?; dato4?; leyenda4?; image? }
```
Type 1: two-column text + stats. Type 2: image left + content right.

### `contact` — `ContactConfig`
```ts
{ type: 1|2; antetitulo?; titulo?; descripcion?; direccion1?; direccion2?;
  form_bg_color?; form_email? }
```
Type 1: info-only layout. Type 2: split with contact form (honeypot anti-spam included).

### `project_list` — `ProjectListConfig`
```ts
{
  layout: "grid-4" | "grid-alternating";
  project_order?: string[];
  hidden_projects?: string[];
  detail_type?: 1 | 2;   // default: 1 — controls ProjectDetail layout
}
```
Only on the `proyectos` page. `hidden_projects` and `project_order` are applied in `[page].astro` before passing to `ProjectList`.

---

## ProjectDetail & `detail_type`

**`detail_type` is configured in galia-dashboard but must be consumed here.**

Currently `ProjectDetail.astro` only implements **type 1** layout (the implicit default):
- Hero image (85vh) → title + metadata → description → gallery (solo/duo rows)

**Type 2 layout (pending implementation):**
- Title + metadata → hero image → alternating text + images (editorial style)

To implement: `[slug]/proyectos/[project].astro` needs to:
1. Fetch the `proyectos` page components to read `project_list.config.detail_type`
2. Pass `detailType` to `ProjectDetail`
3. `ProjectDetail` renders the appropriate layout based on `detailType`

---

## Environment Variables

```
# Server-side (not exposed to client)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Client-side (exposed to browser via inline script)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

`PUBLIC_*` vars are injected into the inline script via `define:vars` in `BaseLayout.astro`.

---

## Development

```bash
pnpm dev      # Dev server at http://localhost:4321
pnpm build    # TypeScript check + Astro build → dist/
pnpm start    # Run built server (node dist/server/entry.mjs)
```

---

## Key Constraints

- **No React/Vue** — pure Astro components + vanilla JS in the inline script.
- **No client-side router** — full page navigations only.
- **`data-preserve`** — any Astro component rendered inside `#page-content` that must survive client-side re-renders needs `data-preserve` on its root element.
- **Inline script mirrors Astro components** — when editing a component's HTML structure, check if it has a `buildXxxHtml()` counterpart in `BaseLayout.astro`'s inline script and keep them in sync.
- **`getSiteBySlug` filters `published = true`** — unpublished sites always 404.
- **`getUserProjects` uses admin client** — do not switch it to the anon client; it will break due to RLS.
