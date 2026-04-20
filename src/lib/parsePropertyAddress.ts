export type ParsedPropertyAddress = {
  district: string;
  sub_area: string;
  landmark: string;
};

/** When AI fails, derive a non-empty district label for RPC `invalid_location` (needs governorate + district). */
export function fallbackDistrictFromDetailedAddress(detailed: string, governorate: string): string {
  const g = governorate.trim();
  const t = detailed.replace(/\s+/g, " ").trim();
  if (!t) return g || "عام";
  const firstLine = t.split(/\r?\n/)[0]?.split(/[،,]/)[0]?.trim() || t;
  const chunk = firstLine.slice(0, 120).trim();
  return chunk || g || "عام";
}
