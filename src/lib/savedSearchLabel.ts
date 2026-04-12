import type { SavedSearchFiltersV1 } from "@/lib/matchSavedSearch";

const UNIT_LABELS: Record<string, string> = {
  student: "سكن طلاب",
  family: "سكن عائلي",
  studio: "ستوديو",
  shared: "مشترك",
  employee: "سكن موظفين",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function isV1Filters(x: unknown): x is SavedSearchFiltersV1 {
  if (!isPlainObject(x)) return false;
  const o = x;
  return o.v === 1 && typeof o.searchQuery === "string" && isPlainObject(o.parsed);
}

/** Short Arabic summary for dashboard / lists (e.g. «شقة في التجمع — أقل من 3 مليون»). */
export function formatSavedSearchSummary(filters: unknown): string {
  if (!isV1Filters(filters)) {
    try {
      return typeof filters === "object" && filters !== null
        ? JSON.stringify(filters).slice(0, 120)
        : "تنبيه محفوظ";
    } catch {
      return "تنبيه محفوظ";
    }
  }

  const { parsed, activeFilter, searchQuery } = filters;
  const unitKey = activeFilter && activeFilter !== "all" ? activeFilter : parsed.unitType || "";
  const unitLabel = unitKey ? (UNIT_LABELS[unitKey] ?? unitKey) : "";

  const parts: string[] = [];
  if (unitLabel) parts.push(unitLabel);
  if (parsed.area?.trim()) parts.push(`في ${parsed.area.trim()}`);
  if (parsed.maxPrice != null && Number.isFinite(parsed.maxPrice)) {
    parts.push(`أقل من ${parsed.maxPrice.toLocaleString("ar-EG")} ج.م`);
  }

  const structured = parts.join(" — ");
  const q = searchQuery.replace(/\s+/g, " ").trim();
  if (structured && q.length > 0 && q.length <= 90) {
    return `${structured} (${q})`;
  }
  if (structured) return structured;
  if (q.length > 0) return q.length > 100 ? `${q.slice(0, 97)}…` : q;
  return "تنبيه بحث";
}
