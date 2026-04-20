const PRODUCTION_PUBLIC = "https://dowarly.com";

function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

/**
 * Request-time site origin (links, redirects). Uses env / Vercel / localhost.
 * Sitemap, layout metadata, and robots use hardcoded https://dowarly.com.
 */
/**
 * Origin for Supabase `redirectTo` (must match Dashboard → Auth → Redirect URLs exactly).
 * Uses `NEXT_PUBLIC_SITE_URL` when set; otherwise the browser’s current origin (local dev),
 * then falls back to `getSiteUrl()` on the server.
 */
export function getOAuthCallbackOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(withProto).origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof globalThis !== "undefined" && globalThis.location?.origin) {
    return globalThis.location.origin;
  }
  try {
    return new URL(getSiteUrl()).origin;
  } catch {
    return "http://localhost:3000";
  }
}

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

