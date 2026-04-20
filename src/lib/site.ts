const PRODUCTION_PUBLIC = "https://dowarly.com";

function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

/**
 * Request-time site origin (links, redirects). Uses env / Vercel / localhost.
 * Sitemap, layout metadata, and robots use hardcoded https://dowarly.com.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }

  return "http://localhost:3000";
}

/**
 * Canonical HTTPS origin for public agency links, Open Graph, and WhatsApp previews.
 * Avoids long *.vercel.app URLs: previews still advertise dowarly.com unless overridden by env.
 */
export function getCanonicalPublicSiteUrl(): string {
  const canonical = process.env.NEXT_PUBLIC_CANONICAL_SITE_URL?.trim();
  if (canonical) return stripTrailingSlash(canonical);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return stripTrailingSlash(site);

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.protocol}//${window.location.host}`;
    }
    if (host === "dowarly.com" || host === "www.dowarly.com") {
      return PRODUCTION_PUBLIC;
    }
    return PRODUCTION_PUBLIC;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return PRODUCTION_PUBLIC;
}

/** Full public URL for an agency landing page (always canonical host outside local dev). */
export function buildAgencyPublicUrl(slug: string): string {
  const base = stripTrailingSlash(getCanonicalPublicSiteUrl());
  return `${base}/agency/${slug.trim()}`;
}

/** If `url` is relative, prefix with `base`; otherwise return trimmed absolute URL. */
export function toAbsolutePublicUrl(url: string, base: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const b = stripTrailingSlash(base);
  if (t.startsWith("//")) return `https:${t}`;
  return t.startsWith("/") ? `${b}${t}` : `${b}/${t}`;
}

