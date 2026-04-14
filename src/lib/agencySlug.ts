/** Slug for new agencies: lowercase English letters, digits, single hyphens between segments. */
export function isValidAgencySlugAscii(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (s.length < 2 || s.length > 120) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

/** Suggest an ASCII slug from a name (Arabic names fall back to a short random suffix). */
export function suggestedAgencySlugAsciiFromName(name: string): string {
  const t = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (t.length >= 2) return t.slice(0, 80);
  return `agency-${Math.random().toString(36).slice(2, 8)}`;
}

/** URL-safe slug segment for agencies (Arabic + Latin + digits + hyphen). */
export function suggestedAgencySlugFromName(name: string): string {
  const t = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = t.slice(0, 80);
  return base.length > 0 ? base : "agency";
}

export function isValidAgencySlug(slug: string): boolean {
  const s = slug.trim();
  if (s.length < 2 || s.length > 120) return false;
  return /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(s);
}
