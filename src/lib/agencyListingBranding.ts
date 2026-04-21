/** Nested `agencies` row from PostgREST on `properties.select('..., agencies(...)')`. */
export type AgencyJoinRow = {
  logo_url?: string | null;
  name?: string | null;
  slug?: string | null;
};

function firstAgencyRow(agencies: unknown): AgencyJoinRow | null {
  if (agencies == null) return null;
  if (Array.isArray(agencies)) {
    const x = agencies[0];
    return x && typeof x === "object" ? (x as AgencyJoinRow) : null;
  }
  if (typeof agencies === "object") return agencies as AgencyJoinRow;
  return null;
}

/** Logo URL from `public.agencies.logo_url` when the listing is tied to an agency. */
export function agencyLogoUrlFromJoin(agencies: unknown): string | null {
  const o = firstAgencyRow(agencies);
  const u = typeof o?.logo_url === "string" ? o.logo_url.trim() : "";
  return u || null;
}

export function agencyNameFromJoin(agencies: unknown): string | null {
  const o = firstAgencyRow(agencies);
  const n = typeof o?.name === "string" ? o.name.trim() : "";
  return n || null;
}

export function agencySlugFromJoin(agencies: unknown): string | null {
  const o = firstAgencyRow(agencies);
  const s = typeof o?.slug === "string" ? o.slug.trim() : "";
  return s || null;
}
