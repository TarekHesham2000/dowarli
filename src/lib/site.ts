/**
 * Canonical site URL for metadata, sitemap, and robots.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://dowarly.com).
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

/**
 * Base URL for layout metadata (OG, Twitter, canonical).
 * Prefers NEXT_PUBLIC_SITE_URL; local dev uses localhost; production default is dowarly.com.
 */
export function getMetadataSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "https://dowarly.com";
}

/** Sitemap URL declared in robots.txt for Google Search Console (production domain). */
export function getPublicSitemapUrl(): string {
  return "https://dowarly.com/sitemap.xml";
}
