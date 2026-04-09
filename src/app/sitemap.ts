import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const paths = [
    "",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/login",
    "/register",
  ];

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  let propertyEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = createSupabaseAnonServer();
    const { data } = await supabase.from("properties").select("id, created_at").eq("status", "active");
    propertyEntries =
      data?.map((p) => ({
        url: `${base}/property/${p.id}`,
        lastModified: p.created_at ? new Date(p.created_at as string) : now,
        changeFrequency: "weekly" as const,
        priority: 0.85,
      })) ?? [];
  } catch {
    propertyEntries = [];
  }

  return [...staticEntries, ...propertyEntries];
}
