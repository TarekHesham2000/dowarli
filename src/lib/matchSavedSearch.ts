/**
 * Keep in sync with `supabase/functions/property-approved-alerts/index.ts` matcher.
 */
export type SavedSearchFiltersV1 = {
  v: 1;
  searchQuery: string;
  activeFilter: string;
  parsed: {
    area: string;
    district?: string;
    governorate?: string;
    maxPrice: number | null;
    unitType: string;
    keywords: string;
  };
};

export type PropertyMatchFields = {
  area: string;
  governorate?: string | null;
  district?: string | null;
  landmark?: string | null;
  price: number;
  unit_type: string;
  title: string;
  description: string;
  address: string;
};

export function propertyMatchesSavedSearch(
  prop: PropertyMatchFields,
  filters: SavedSearchFiltersV1,
): boolean {
  const { parsed, activeFilter } = filters;
  const dist = (parsed.district || "").replace(/\s+/g, " ").trim();
  const gov = (parsed.governorate || "").replace(/\s+/g, " ").trim();
  const locHay =
    `${prop.governorate ?? ""} ${prop.district ?? ""} ${prop.area ?? ""}`.replace(/\s+/g, " ");

  if (dist && !locHay.includes(dist)) return false;
  if (gov && !locHay.includes(gov)) {
    if (!(dist && locHay.includes(dist))) return false;
  }
  if (!dist && !gov && parsed.area && !locHay.includes(parsed.area)) return false;
  if (parsed.maxPrice != null && Number(prop.price) > parsed.maxPrice) return false;

  const effectiveUnit =
    activeFilter && activeFilter !== "all" ? activeFilter : parsed.unitType || "";
  if (effectiveUnit && String(prop.unit_type) !== effectiveUnit) return false;

  const kw = (parsed.keywords || "").replace(/\s+/g, " ").trim();
  if (kw.length > 2) {
    const hay =
      `${prop.title} ${prop.description} ${prop.address} ${prop.landmark ?? ""}`.toLowerCase();
    const blob = kw.toLowerCase();
    if (!hay.includes(blob)) return false;
  }
  return true;
}
