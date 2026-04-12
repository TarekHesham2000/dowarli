import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";

/** Properties are loaded from Supabase on each request (not frozen at build time). */
export const dynamic = "force-dynamic";

type StaticRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[0]["changeFrequency"]>;
  priority: number;
};

const STATIC_ROUTES: StaticRoute[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/search", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.75 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.5 },
  { path: "/login", changeFrequency: "monthly", priority: 0.4 },
  { path: "/register", changeFrequency: "monthly", priority: 0.55 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path === "" ? "/" : path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  let propertyEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = createSupabaseAnonServer();
    const { data, error } = await supabase
      .from("properties")
      .select("id, slug, created_at")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(20_000);

    if (!error && data?.length) {
      propertyEntries = data.map((p) => {
        const row = p as { id: number; slug?: string | null; created_at?: string | null };
        const slug = typeof row.slug === "string" && row.slug.trim() ? row.slug.trim() : null;
        const pathSeg = slug ?? String(row.id);
        return {
          url: `${base}/property/${pathSeg}`,
          lastModified: row.created_at ? new Date(row.created_at) : now,
          changeFrequency: "daily" as const,
          priority: 0.85,
        };
      });
    }
  } catch {
    propertyEntries = [];
  }

  return [...staticEntries, ...propertyEntries];
}
