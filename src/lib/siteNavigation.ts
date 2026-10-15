import type { Site, SitePage, SiteComponent } from '../types';

// Self-contained functions are serialized below: SSR and inline JS use identical rules.
export function normalizeAnchorId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.startsWith('#') ? value.slice(1) : value;
  const reserved = ['page-content', 'mobile-menu', 'menu-toggle', 'btn-view-grid', 'btn-view-list', 'keyword-select', 'active-pills', 'view-grid', 'view-list'];
  return /^[a-z][a-z0-9-]{0,79}$/.test(id) && !reserved.includes(id) &&
    !['cookie-', 'toggle-', 'contact-'].some(prefix => id.startsWith(prefix)) ? id : null;
}

export function homeAnchorId(component: SiteComponent, home: SitePage | undefined, components: SiteComponent[]): string | null {
  if (home?.slug !== 'home' || (home.page_type != null && home.page_type !== 'page') || home.visible !== true ||
    component.page_id !== home.id || component.visible !== true) return null;
  const id = normalizeAnchorId(component.anchor_id);
  // Fail closed for inconsistent duplicate metadata rather than emitting duplicate DOM IDs.
  return id && components.filter(c => c.page_id === home.id && normalizeAnchorId(c.anchor_id) === id).length === 1 ? id : null;
}

export function pageHref(site: Pick<Site, 'id' | 'slug'>, page: SitePage, pages: SitePage[], homeComponents: SiteComponent[]): string | null {
  if (page.site_id !== site.id || page.visible !== true) return null;
  const base = '/' + encodeURIComponent(site.slug) + '/';
  if (page.page_type === 'home_anchor') {
    const home = pages.find(p => p.site_id === site.id && p.slug === 'home' && (p.page_type == null || p.page_type === 'page'));
    const target = homeComponents.find(c => c.id === page.target_component_id);
    const id = target && homeAnchorId(target, home, homeComponents);
    return id ? base + '#' + id : null;
  }
  if (page.page_type && page.page_type !== 'page') return null;
  return page.slug === 'home' ? base : base + encodeURIComponent(page.slug);
}

export const navigationRuntime = [normalizeAnchorId, homeAnchorId, pageHref]
  .map(fn => fn.toString()).join('\n');
