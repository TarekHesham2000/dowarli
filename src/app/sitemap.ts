import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseAnonServer } from "@/lib/supabaseAnonServer";

/** Properties are loaded from Supabase on each request (not frozen at build time). */
export const dynamic = "force-dynamic";

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
  priority: number;
}[] = [
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

    if (error) {
      console.error("[sitemap] properties:", error.message);
    } else {
      propertyEntries =
        data?.map((p) => {
          const slug = typeof (p as { slug?: string | null }).slug === "string" && (p as { slug: string }).slug.trim()
            ? (p as { slug: string }).slug.trim()
            : null;
          const pathSeg = slug ?? String((p as { id: number }).id);
          return {
            url: `${base}/property/${pathSeg}`,
            lastModified: (p as { created_at?: string }).created_at
              ? new Date((p as { created_at: string }).created_at)
              : now,
            changeFrequency: "daily" as const,
            priority: 0.85,
          };
        }) ?? [];
    }
  } catch (e) {
    console.error("[sitemap]", e);
  }

  return [...staticEntries, ...propertyEntries];
}
