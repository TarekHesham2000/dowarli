/**
 * Keep in sync with `supabase/functions/property-approved-alerts/index.ts` matcher.
 */
export type SavedSearchFiltersV1 = {
  v: 1;
  searchQuery: string;
  activeFilter: string;
  parsed: {
    area: string;
    maxPrice: number | null;
    unitType: string;
    keywords: string;
  };
};

export type PropertyMatchFields = {
  area: string;
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
  if (parsed.area) {
    const hay = String(prop.area ?? "");
    if (!hay.includes(parsed.area)) return false;
  }
  if (parsed.maxPrice != null && Number(prop.price) > parsed.maxPrice) return false;

  const effectiveUnit =
    activeFilter && activeFilter !== "all" ? activeFilter : parsed.unitType || "";
  if (effectiveUnit && String(prop.unit_type) !== effectiveUnit) return false;

  const kw = (parsed.keywords || "").replace(/\s+/g, " ").trim();
  if (kw.length > 2) {
    const hay = `${prop.title} ${prop.description} ${prop.address}`.toLowerCase();
    const blob = kw.toLowerCase();
    if (!hay.includes(blob)) return false;
  }
  return true;
}
