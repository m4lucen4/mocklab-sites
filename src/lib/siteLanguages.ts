export const supportedLanguages = ['es', 'en', 'ca'] as const;
export type SiteLanguage = typeof supportedLanguages[number];

type LanguageSettings = {
  enabled_languages?: unknown;
  default_language?: unknown;
  multilanguage?: boolean;
};

// Self-contained so the exact normalizer can also run in the inline renderer.
export function normalizeSiteLanguages(site: LanguageSettings) {
  const supported = ['es', 'en', 'ca'];
  const list = site.enabled_languages;
  const valid = Array.isArray(list) && list.length > 0 &&
    list.every(code => supported.includes(code)) && new Set(list).size === list.length;
  const enabledLanguages = (valid
    ? supported.filter(code => list.includes(code))
    : site.multilanguage === true ? ['es', 'en']
      : [supported.includes(site.default_language as string) ? site.default_language : 'en']) as SiteLanguage[];
  const defaultLanguage = (enabledLanguages.includes(site.default_language as SiteLanguage)
    ? site.default_language : enabledLanguages.includes('en') ? 'en' : enabledLanguages[0]) as SiteLanguage;
  return { enabledLanguages, defaultLanguage, multilanguage: enabledLanguages.length > 1 };
}

export function languageStorageKey(slug: string) {
  return 'site_language:' + slug;
}

export function resolveVisitorLanguage(config: ReturnType<typeof normalizeSiteLanguages>, stored: unknown, legacy: unknown) {
  if (config.enabledLanguages.includes(stored as SiteLanguage)) return stored as SiteLanguage;
  // A rejected site-specific preference must not resurrect an older global choice.
  if (stored == null && config.enabledLanguages.includes(legacy as SiteLanguage)) return legacy as SiteLanguage;
  return config.defaultLanguage;
}

export const translations = {
  en: {
    nav_home: 'Home', nav_projects: 'Projects',
    project_list_title: 'Projects', project_list_filter: 'Filter by category',
    view_grid: 'Grid view', view_list: 'List view', remove_filter: 'Remove filter',
    open_menu: 'Open menu', previous_slide: 'Previous slide', next_slide: 'Next slide',
    contact_name: 'Name *', contact_company: 'Company', contact_email: 'Email *', contact_message: 'Message',
    contact_privacy_text: 'I have read and accept the', contact_privacy_link: 'privacy policy',
    contact_submit: 'Send message', contact_success: 'Message sent successfully!',
    contact_error: 'An error occurred. Please try again.',
    footer_legal: 'Legal Notice', footer_cookies: 'Cookie Policy', footer_manage: 'Manage cookies',
    legal_aviso: 'Legal Notice', legal_cookies: 'Cookie Policy',
    cookie_notice: 'Cookie notice', cookie_enable_analytics: 'Enable analytics cookies', cookie_enable_marketing: 'Enable marketing cookies',
    cookie_banner_desc: 'We use our own and third-party cookies to improve your experience, analyze traffic, and show you relevant content. You can accept, reject, or customize your preferences.',
    cookie_policy_link: 'Cookie policy', cookie_reject: 'Reject all', cookie_customize: 'Customize', cookie_accept: 'Accept all',
    cookie_modal_title: 'Cookie settings',
    cookie_modal_desc: 'Select which cookie categories you want to allow. Necessary cookies are always on because the site cannot function properly without them.',
    cookie_necessary: 'Necessary', cookie_always_on: 'Always on',
    cookie_necessary_desc: 'Essential for the basic functioning of the site. Cannot be disabled.',
    cookie_analytics: 'Analytics',
    cookie_analytics_desc: 'They help us understand how you interact with the site, which pages you visit, and how you arrived. Data is anonymous.',
    cookie_marketing: 'Marketing',
    cookie_marketing_desc: 'They allow us to show you ads and personalized content based on your interests, inside and outside the site.',
    cookie_cancel: 'Cancel', cookie_save: 'Save preferences',
  },
  es: {
    nav_home: 'Inicio', nav_projects: 'Proyectos',
    project_list_title: 'Proyectos', project_list_filter: 'Filtrar por categoría',
    view_grid: 'Vista de cuadrícula', view_list: 'Vista de lista', remove_filter: 'Eliminar filtro',
    open_menu: 'Abrir menú', previous_slide: 'Slide anterior', next_slide: 'Siguiente slide',
    contact_name: 'Nombre *', contact_company: 'Empresa', contact_email: 'Email *', contact_message: 'Mensaje',
    contact_privacy_text: 'He leído y acepto la', contact_privacy_link: 'política de privacidad',
    contact_submit: 'Enviar mensaje', contact_success: '¡Mensaje enviado correctamente!',
    contact_error: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.',
    footer_legal: 'Aviso legal', footer_cookies: 'Política de cookies', footer_manage: 'Gestionar cookies',
    legal_aviso: 'Aviso Legal', legal_cookies: 'Política de Cookies',
    cookie_notice: 'Aviso de cookies', cookie_enable_analytics: 'Activar cookies analíticas', cookie_enable_marketing: 'Activar cookies de marketing',
    cookie_banner_desc: 'Usamos cookies propias y de terceros para mejorar tu experiencia, analizar el tráfico y mostrarte contenido relevante. Puedes aceptar, rechazar o personalizar tus preferencias.',
    cookie_policy_link: 'Política de cookies', cookie_reject: 'Rechazar todo', cookie_customize: 'Personalizar', cookie_accept: 'Aceptar todo',
    cookie_modal_title: 'Configuración de cookies',
    cookie_modal_desc: 'Selecciona qué categorías de cookies quieres permitir. Las cookies necesarias siempre están activas porque el sitio no puede funcionar correctamente sin ellas.',
    cookie_necessary: 'Necesarias', cookie_always_on: 'Siempre activo',
    cookie_necessary_desc: 'Esenciales para el funcionamiento básico del sitio. No pueden desactivarse.',
    cookie_analytics: 'Analíticas',
    cookie_analytics_desc: 'Nos ayudan a entender cómo interactúas con el sitio, qué páginas visitas y cómo llegaste. Los datos son anónimos.',
    cookie_marketing: 'Marketing',
    cookie_marketing_desc: 'Nos permiten mostrarte anuncios y contenido personalizado según tus intereses, dentro y fuera del sitio.',
    cookie_cancel: 'Cancelar', cookie_save: 'Guardar preferencias',
  },
  ca: {
    nav_home: 'Inici', nav_projects: 'Projectes',
    project_list_title: 'Projectes', project_list_filter: 'Filtra per categoria',
    view_grid: 'Vista de quadrícula', view_list: 'Vista de llista', remove_filter: 'Elimina el filtre',
    open_menu: 'Obre el menú', previous_slide: 'Diapositiva anterior', next_slide: 'Diapositiva següent',
    contact_name: 'Nom *', contact_company: 'Empresa', contact_email: 'Correu electrònic *', contact_message: 'Missatge',
    contact_privacy_text: 'He llegit i accepto la', contact_privacy_link: 'política de privacitat',
    contact_submit: 'Envia el missatge', contact_success: 'Missatge enviat correctament!',
    contact_error: "S'ha produït un error. Torna-ho a provar.",
    footer_legal: 'Avís legal', footer_cookies: 'Política de galetes', footer_manage: 'Gestiona les galetes',
    legal_aviso: 'Avís legal', legal_cookies: 'Política de galetes',
    cookie_notice: 'Avís de galetes', cookie_enable_analytics: 'Activa les galetes analítiques', cookie_enable_marketing: 'Activa les galetes de màrqueting',
    cookie_banner_desc: 'Fem servir galetes pròpies i de tercers per millorar la teva experiència, analitzar el trànsit i mostrar-te contingut rellevant. Pots acceptar, rebutjar o personalitzar les teves preferències.',
    cookie_policy_link: 'Política de galetes', cookie_reject: 'Rebutja-les totes', cookie_customize: 'Personalitza', cookie_accept: 'Accepta-les totes',
    cookie_modal_title: 'Configuració de galetes',
    cookie_modal_desc: 'Selecciona quines categories de galetes vols permetre. Les galetes necessàries sempre estan actives perquè el lloc no pot funcionar correctament sense elles.',
    cookie_necessary: 'Necessàries', cookie_always_on: 'Sempre actives',
    cookie_necessary_desc: 'Essencials per al funcionament bàsic del lloc. No es poden desactivar.',
    cookie_analytics: 'Analítiques',
    cookie_analytics_desc: 'Ens ajuden a entendre com interactues amb el lloc, quines pàgines visites i com hi has arribat. Les dades són anònimes.',
    cookie_marketing: 'Màrqueting',
    cookie_marketing_desc: 'Ens permeten mostrar-te anuncis i contingut personalitzat segons els teus interessos, dins i fora del lloc.',
    cookie_cancel: 'Cancel·la', cookie_save: 'Desa les preferències',
  },
};

export function fixedLabel(key: keyof typeof translations.en, language: string = 'en') {
  return (translations[language as SiteLanguage] || translations.en)[key];
}

// Astro define:vars safely serializes strings, not functions. These pure helpers
// are deliberately closure-free; SSR and the browser execute the same contract.
export const languageRuntime = `var normalizeSiteLanguages = ${normalizeSiteLanguages.toString()};
var languageStorageKey = ${languageStorageKey.toString()};
var resolveVisitorLanguage = ${resolveVisitorLanguage.toString()};`;
