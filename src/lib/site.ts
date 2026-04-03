/**
 * Canonical site URL for metadata, sitemap, and robots.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://agrly.vercel.app).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }

  return "http://localhost:3000";
}
