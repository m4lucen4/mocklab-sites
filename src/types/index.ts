export interface Site {
  id: string;
  user_id: string;
  slug: string;
  studio_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font: string;
  title_font: string | null;
  custom_domain: string | null;
  favicon_url: string | null;
  meta_description: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  navbar_type: number;
  background_color: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SitePage {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  content: string | null;
  position: number;
  visible: boolean;
  show_in_nav: boolean;
  created_at: string;
  updated_at: string;
}

export interface HeaderSlide {
  image_url: string;
  title: string;
  description: string;
  type: 1 | 2;
  text_button: string;
  url_button: string;
}

export interface SiteComponent {
  id: string;
  page_id: string;
  type: string;
  position: number;
  visible: boolean;
  config: unknown;
  created_at: string;
  updated_at: string;
}

export interface BodyConfig {
  description: string;
  image_1?: string;
  image_2?: string;
  image_3?: string;
  type: 1 | 2 | 3 | 4;
}

export interface Project {
  id: string;
  user: string;
  title: string;
  description: string;
  keywords: string;
  category: string | null;
  year: string;
  image_data: Array<{
    url: string;
    status?: string;
    processingResult?: unknown;
  }>;
  created_at?: string;
}
