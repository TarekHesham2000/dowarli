/**
 * Resolves `agencies.logo_url` for <img src={…} />: full Supabase Storage public URLs
 * and bare object paths inside the `properties` bucket.
 */
export function resolveAgencyLogoPublicUrl(logoUrl: string | null | undefined): string | null {
  const raw = typeof logoUrl === "string" ? logoUrl.trim() : "";
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return null;
  }

  let objectPath = raw.replace(/^\/+/, "");
  if (objectPath.startsWith("storage/v1/object/public/properties/")) {
    objectPath = objectPath.slice("storage/v1/object/public/properties/".length);
  }
  if (!objectPath) return null;

  return `${supabaseUrl}/storage/v1/object/public/properties/${objectPath}`;
}
