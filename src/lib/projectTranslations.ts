import type { Project } from '../types';
import { supportedLanguages, type SiteLanguage } from './siteLanguages';

type TextFields = Pick<Project, 'title' | 'description' | 'keywords'>;
export type ProjectTranslation = {
  language: SiteLanguage;
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
};
export type PublicProjectText = TextFields & {
  id: string;
  originalLanguage?: SiteLanguage;
  translations: ProjectTranslation[];
};

const text = (value: unknown): string => typeof value === 'string' ? value : '';

// Explicit projection: never serialize a complete admin-fetched project.
export function publicProjectText(project: Project, languages: readonly string[] = supportedLanguages): PublicProjectText {
  return {
    id: String(project.id),
    title: text(project.title),
    description: text(project.description),
    keywords: text(project.keywords),
    originalLanguage: project.translation_settings?.original_language,
    translations: (project.translation_settings?.translations ?? [])
      .filter(row => supportedLanguages.includes(row.language) && languages.includes(row.language) &&
        row.language !== project.translation_settings?.original_language)
      .map(row => ({
        language: row.language,
        title: row.title, description: row.description, keywords: row.keywords,
      })),
  };
}

export function projectTextForLanguage(project: PublicProjectText, language: string): TextFields {
  const version = language !== project.originalLanguage &&
    supportedLanguages.includes(language as SiteLanguage)
    ? project.translations.find(row => row.language === language) : undefined;
  const field = (name: keyof TextFields) =>
    text(version?.[name]).trim() ? text(version?.[name]) : text(project[name]);
  return { title: field('title'), description: field('description'), keywords: field('keywords') };
}

export function localizeProject(project: Project, language: string): Project {
  return { ...project, ...projectTextForLanguage(publicProjectText(project), language) };
}

export function projectPreview(value: string, maxWords = 20): string {
  const words = value.trim().split(/\s+/);
  return words.length <= maxWords ? value : words.slice(0, maxWords).join(' ') + '…';
}

export function escapeProjectText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
