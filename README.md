# mocklab-sites

Generador de webs estáticas multi-tenant para clientes de la plataforma **Mocklab**. Un único proyecto Astro genera el site de cada cliente a partir de su configuración almacenada en Supabase.

---

## Concepto

El usuario configura su web desde el dashboard React de Mocklab → los datos se guardan en Supabase → este proyecto Astro los consume en build time y genera el site estático correspondiente. Los colores, fuentes y contenido de los componentes se **actualizan en tiempo real** sin rebuild gracias a un script cliente que re-fetchea de Supabase al cargar cada página.

---

## Stack

| Tecnología | Uso |
|---|---|
| Astro 6 (output: static) | Framework SSG multi-tenant |
| Tailwind CSS v4 | Estilos (plugin `@tailwindcss/vite`) |
| Supabase | Base de datos y almacenamiento |
| TypeScript strict | Tipado |
| pnpm | Gestor de paquetes |

---

## Arquitectura de base de datos

### `sites` — Configuración global de cada web

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK al usuario dueño |
| slug | text unique | Subdominio/ruta: `estudio-garcia` |
| studio_name | text | Nombre del estudio |
| logo_url | text | URL del logo |
| primary_color | text | Hex, default `#2D3436` |
| secondary_color | text | Hex, default `#636E72` |
| font | text | Google Font, default `Inter` |
| custom_domain | text nullable | |
| favicon_url | text nullable | |
| meta_description | text nullable | SEO |
| navbar_type | integer | `1` = Menú\|Logo\|Redes · `2` = Logo\|Menú\|Redes |
| instagram_url | text nullable | |
| facebook_url | text nullable | |
| linkedin_url | text nullable | |
| published | boolean | Solo los sites `published=true` se generan |

### `site_pages` — Páginas de cada site

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| site_id | uuid FK → sites.id | |
| title | text | Ej: `Inicio`, `Proyectos` |
| slug | text | Ej: `home`, `proyectos` |
| position | integer | Orden en el menú |
| visible | boolean | |
| show_in_nav | boolean | Si aparece en el navbar |

### `site_components` — Componentes de cada página

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| page_id | uuid FK → site_pages.id | **No existe `site_id`** |
| type | text | `header`, `cta`, `body`, `content`, `project_list` |
| position | integer | Orden de aparición |
| visible | boolean | |
| config | jsonb | Configuración específica del componente |

### `projects` — Proyectos del usuario (solo lectura)

| Campo | Tipo | Notas |
|---|---|---|
| id | integer PK | |
| user | uuid | FK al usuario dueño |
| titulo | text | |
| descripcion | text | |
| keywords | text | Categorías separadas por coma |
| year | text | |
| image_data | jsonb | Array de `{ url, status, processingResult }` — usar solo `url` |

---

## Estructura de rutas generadas

```
/{slug}/                        → Página home (componentes de la página slug="home")
/{slug}/{page}                  → Páginas genéricas (proyectos, etc.)
/{slug}/proyectos/{project-id}  → Detalle de proyecto
```

## Estructura de archivos

```
src/
├── components/
│   ├── Header.astro         → Carrusel/slide de imágenes con texto
│   ├── CTA.astro            → Sección call-to-action (tipos 1, 2, 3)
│   ├── Body.astro           → Sección de imágenes + texto (tipos 1-4)
│   ├── Content.astro        → Sección de texto, datos y estadísticas
│   ├── Navigation.astro     → Navbar fijo (variantes 1 y 2)
│   ├── ProjectList.astro    → Listado de proyectos (grid-4 / grid-alternating)
│   └── ProjectDetail.astro  → Detalle de un proyecto con galería
├── layouts/
│   └── BaseLayout.astro     → Layout base: HTML, meta, CSS vars, script cliente
├── lib/
│   └── supabase.ts          → Cliente Supabase + funciones de query
├── pages/
│   ├── index.astro          → Página raíz (vacía)
│   └── [slug]/
│       ├── index.astro             → Página home del site
│       ├── [page].astro            → Páginas genéricas
│       └── proyectos/
│           └── [project].astro     → Detalle de proyecto
├── styles/
│   └── global.css           → @import "tailwindcss"
└── types/
    └── index.ts             → Interfaces TypeScript
```

---

## Componentes disponibles

### `header`

Config: array de 1 a 5 objetos slide.

```json
{
  "image_url": "https://...",
  "title": "Texto del slide",
  "description": "Descripción",
  "type": 1,
  "text_button": "Ver más",
  "url_button": "#section"
}
```

- `type: 1` — Contenido centrado abajo, gradiente vertical
- `type: 2` — Contenido abajo-izquierda, gradiente horizontal, botón pill negro
- 1 slide → header estático · 2+ slides → carrusel automático con flechas

### `cta`

```json
{
  "type": 1,
  "title": "Título",
  "description": "...",
  "subtitle": "Antetítulo opcional",
  "text_primary_button": "Acción",
  "url_primary_button": "/ruta",
  "text_secondary_button": "Enlace secundario",
  "url_secondary_button": "https://..."
}
```

- `type: 1` — CTA centrado
- `type: 2` — Split: bloque de color izquierda + texto derecha
- `type: 3` — CTA alineado a la izquierda

### `body`

```json
{
  "type": 1,
  "description": "Texto descriptivo",
  "image_1": "https://...",
  "image_2": "https://...",
  "image_3": "https://..."
}
```

- `type: 1` — 2 imágenes + texto (3 columnas)
- `type: 2` — 1 imagen wide + texto (2 columnas)
- `type: 3` — 3 imágenes + texto (4 columnas)
- `type: 4` — 2 imágenes + 1 imagen wide (3 columnas, sin texto)

### `content`

```json
{
  "type": 1,
  "antetitulo": "Subtítulo",
  "titulo": "Título principal",
  "textoIzquierda": "...",
  "textoDerecha": "...",
  "dato1": 120, "leyenda1": "Proyectos",
  "dato2": 15,  "leyenda2": "Años",
  "dato3": 40,  "leyenda3": "Clientes",
  "dato4": 8,   "leyenda4": "Premios"
}
```

- `type: 1` — Texto en dos columnas + estadísticas debajo de cada columna
- `type: 2` — Imagen izquierda + texto/estadísticas derecha

### `project_list` (página de proyectos)

```json
{ "layout": "grid-4" }
```

- `grid-4` — Rejilla uniforme de 4 columnas
- `grid-alternating` — Patrón asimétrico: fila impar 1/4+1/4+1/2, fila par 1/2+1/4+1/4

Si no existe el componente, usa `grid-4` por defecto.

---

## Actualización dinámica (sin rebuild)

El `BaseLayout.astro` incluye un script inline que al cargar cada página:

1. Fetchea de Supabase: `primary_color`, `secondary_color`, `font`, `navbar_type`, `logo_url`, `instagram_url`, `facebook_url`, `linkedin_url`
2. Aplica colores y fuente como CSS custom properties en `<html>`
3. Fetchea todas las páginas visibles del site → re-renderiza el navbar completo
4. Localiza la página actual → fetchea sus componentes → re-renderiza `header`, `cta`, `body`, `content`

**Lo que se actualiza en tiempo real** (sin rebuild): colores, fuente, contenido de todos los componentes, navbar type, redes sociales.

**Lo que requiere rebuild**: añadir/eliminar páginas, cambiar slugs, publicar un nuevo site, añadir nuevos proyectos.

Las CSS custom properties usadas en los componentes son:
- `var(--color-primary)` — color principal
- `var(--color-secondary)` — color secundario
- `var(--font-family)` — fuente tipográfica

---

## Variables de entorno

Crear un `.env` en la raíz (ya está en `.gitignore`):

```env
# Server-side (build time)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key

# Client-side (prefijo PUBLIC_ obligatorio para Astro)
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Las variables sin prefijo se usan en `getStaticPaths` (server). Las `PUBLIC_` se inyectan en el script cliente del browser vía `define:vars`.

---

## Comandos

```bash
pnpm install        # Instalar dependencias
pnpm dev            # Servidor de desarrollo en localhost:4321
pnpm build          # Generar sitios estáticos en ./dist/
pnpm preview        # Previsualizar el build localmente
```

---

## Añadir un nuevo componente

1. Crear `src/components/MiComponente.astro` con prop `config`
2. Añadir el tipo de config en `src/types/index.ts`
3. Renderizarlo en `src/pages/[slug]/index.astro` y `[page].astro` con `component.type === "mi-componente"`
4. Añadir `buildMiComponenteHtml(config)` en el script cliente de `BaseLayout.astro` para que también se actualice dinámicamente
5. Registrar el nuevo tipo en el `components.forEach` del script cliente

---

## RLS en Supabase

Los sites generados usan la **anon key**, por lo que las tablas deben tener políticas RLS de lectura pública para los datos publicados:

- `sites`: lectura pública donde `published = true`
- `site_pages`: lectura pública donde `visible = true`
- `site_components`: lectura pública donde `visible = true`
- `projects`: lectura pública (o filtrada por `user` del site)
