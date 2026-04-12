/**
 * URL slug for property pages — Arabic-friendly, unique per row via trailing `-{id}`.
 * Keep in sync with DB trigger `properties_set_slug_trg` in sql/properties_slug_migration.sql.
 */
export function slugifyPropertyTitle(title: string): string {
  const t = title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = t.slice(0, 80);
  return base.length > 0 ? base : "عقار";
}

export function buildPropertySlug(title: string, id: number): string {
  return `${slugifyPropertyTitle(title)}-${id}`;
}

/** Path segment for Next.js `href` / `router.push` (Unicode path, no extra encoding). */
export function propertyPathFromRecord(p: { slug?: string | null; id: number }): string {
  if (p.slug && String(p.slug).trim().length > 0) {
    return `/property/${String(p.slug).trim()}`;
  }
  return `/property/${p.id}`;
}
