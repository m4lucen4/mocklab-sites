import { projectTextForLanguage, projectPreview, type PublicProjectText } from './projectTranslations';

const detailVariants = new WeakMap<HTMLElement, Map<string, DocumentFragment>>();
let bound = false;

function activeLanguage() {
  return (window as Window & { __siteLang?: string }).__siteLang || document.documentElement.lang;
}

export function applyProjectTranslations() {
  const language = activeLanguage();
  document.querySelectorAll<HTMLElement>('[data-project-texts]').forEach(root => {
    let projects: PublicProjectText[];
    try {
      projects = JSON.parse(root.dataset.projectTexts || '[]');
      if (!Array.isArray(projects)) return;
    } catch { return; }
    const byId = new Map(projects.map(project => [String(project.id), project]));
    root.querySelectorAll<HTMLElement>('[data-project-id]').forEach(card => {
      const project = byId.get(card.dataset.projectId || '');
      if (!project) return;
      const localized = projectTextForLanguage(project, language);
      card.querySelectorAll<HTMLElement>('[data-project-title]').forEach(el => { el.textContent = localized.title; });
      card.querySelectorAll<HTMLImageElement>('img').forEach(img => { img.alt = localized.title; });
      card.querySelectorAll<HTMLElement>('[data-project-description]').forEach(el => {
        el.textContent = projectPreview(localized.description, Number(el.dataset.projectDescriptionLimit) || 20);
        el.hidden = !localized.description.trim();
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-project-detail-language]').forEach(root => {
    const active = root.querySelector<HTMLElement>('[data-project-detail-active]');
    if (!active) return;
    let variants = detailVariants.get(root);
    if (!variants) {
      variants = new Map();
      const original = document.createDocumentFragment();
      active.childNodes.forEach(node => original.appendChild(node.cloneNode(true)));
      variants.set(root.dataset.projectDetailLanguage || '', original);
      root.querySelectorAll<HTMLTemplateElement>('template[data-project-detail-template]').forEach(template => {
        variants!.set(template.dataset.projectDetailTemplate || '', template.content.cloneNode(true) as DocumentFragment);
      });
      detailVariants.set(root, variants);
    }
    if (root.dataset.projectDetailLanguage === language) return;
    const variant = variants.get(language);
    if (!variant) return;
    active.replaceChildren(variant.cloneNode(true));
    root.dataset.projectDetailLanguage = language;
  });
}

export function initializeProjectTranslations() {
  if (!bound) {
    window.addEventListener('site:languagechange', applyProjectTranslations);
    bound = true;
  }
  // A restored language may have been applied before this module loaded.
  applyProjectTranslations();
}
