import { createClient } from "@supabase/supabase-js";
import type { Site, SitePage, SiteComponent, Project } from "../types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Server-side client: bypasses RLS for reads from SSR pages
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getSiteBySlug(slug: string): Promise<Site | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) return null;
  return data as Site;
}

export async function getPublishedSites(): Promise<Site[]> {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("published", true);

  if (error) throw new Error(`Error fetching sites: ${error.message}`);
  return data as Site[];
}

export async function getSitePages(siteId: string): Promise<SitePage[]> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("*")
    .eq("site_id", siteId)
    .eq("visible", true)
    .order("position", { ascending: true });

  if (error) throw new Error(`Error fetching pages: ${error.message}`);
  return data as SitePage[];
}

export async function getPageComponents(pageId: string): Promise<SiteComponent[]> {
  const { data, error } = await supabase
    .from("site_components")
    .select("*")
    .eq("page_id", pageId)
    .eq("visible", true)
    .order("position", { ascending: true });

  if (error) throw new Error(`Error fetching components: ${error.message}`);
  return data as SiteComponent[];
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user", userId);

  if (error) throw new Error(`Error fetching projects: ${error.message}`);
  return data as Project[];
}
