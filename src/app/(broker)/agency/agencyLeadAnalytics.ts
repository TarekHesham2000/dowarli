/** Lead intelligence: property category × transaction type + geography for agency analytics */

export type LeadPropertyAnalytics = {
  unit_type?: string | null;
  listing_purpose?: string | null;
  listing_type?: string | null;
  title?: string | null;
  area?: string | null;
  governorate?: string | null;
  district?: string | null;
};

const RESIDENTIAL_UNITS = new Set(["student", "family", "studio", "shared", "employee"]);

const AR = {
  residential: "سكني",
  commercial: "تجاري",
  land: "أراضي",
  other: "أخرى",
  sale: "بيع",
  rent: "إيجار",
} as const;

export function parseLeadPropertyAnalytics(properties: unknown): LeadPropertyAnalytics {
  if (!properties || typeof properties !== "object") return {};
  const o = Array.isArray(properties) ? properties[0] : properties;
  if (!o || typeof o !== "object") return {};
  const r = o as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  return {
    unit_type: str("unit_type"),
    listing_purpose: str("listing_purpose"),
    listing_type: str("listing_type"),
    title: str("title"),
    area: str("area"),
    governorate: str("governorate"),
    district: str("district"),
  };
}

export function inferTransactionType(p: LeadPropertyAnalytics): "sale" | "rent" {
  const raw = (p.listing_purpose ?? p.listing_type ?? "rent").toString().trim().toLowerCase();
  return raw === "sale" ? "sale" : "rent";
}

/**
 * Heuristic category: app unit types are residential; Arabic/English keywords → land / commercial.
 */
export function inferPropertyCategory(p: LeadPropertyAnalytics): "residential" | "commercial" | "land" | "other" {
  const ut = (p.unit_type ?? "").toLowerCase().trim();
  const title = (p.title ?? "").toLowerCase();
  const area = (p.area ?? "").toLowerCase();
  const blob = `${ut} ${title} ${area}`;

  if (/أرض|ارض|land|plot|قطعة|مزرعة|فدان|acre|زمام|زراعي/i.test(blob)) return "land";
  if (/تجاري|محل|مكتب|commercial|shop|office|معرض|عيادة|clinic|مصنع|factory|مخزن|warehouse|garage|محلات|اداري|إداري/i.test(blob))
    return "commercial";

  if (RESIDENTIAL_UNITS.has(ut)) return "residential";
  if (ut.length > 0) return "other";
  return "residential";
}

export function leadIntelligencePieSegment(p: LeadPropertyAnalytics): string {
  const c = inferPropertyCategory(p);
  const t = inferTransactionType(p);
  const catLabel = AR[c];
  const txnLabel = t === "sale" ? AR.sale : AR.rent;
  return `${catLabel} — ${txnLabel}`;
}

export function aggregateLeadIntelligencePie(rows: LeadPropertyAnalytics[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const seg = leadIntelligencePieSegment(r);
    map.set(seg, (map.get(seg) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type GeoHotBarRow = { name: string; demand: number; governorate: string; district: string };

/** Hot spots: محافظة — حي when district exists */
export function aggregateGeographyHotBar(rows: LeadPropertyAnalytics[], topN = 10): GeoHotBarRow[] {
  const map = new Map<string, GeoHotBarRow>();
  for (const r of rows) {
    const gov = (r.governorate ?? "").trim() || "غير محدد";
    const dist = (r.district ?? "").trim();
    const name = dist ? `${gov} — ${dist}` : gov;
    const prev = map.get(name) ?? { name, demand: 0, governorate: gov, district: dist };
    prev.demand += 1;
    map.set(name, prev);
  }
  return [...map.values()].sort((a, b) => b.demand - a.demand).slice(0, topN);
}

export function leadMatchesPieSegment(properties: unknown, segment: string): boolean {
  return leadIntelligencePieSegment(parseLeadPropertyAnalytics(properties)) === segment;
}

export function leadMatchesGeoBar(properties: unknown, bar: GeoHotBarRow): boolean {
  const p = parseLeadPropertyAnalytics(properties);
  const gov = (p.governorate ?? "").trim() || "غير محدد";
  const dist = (p.district ?? "").trim();
  const label = dist ? `${gov} — ${dist}` : gov;
  return label === bar.name;
}

export type ViewEventRow = {
  created_at: string;
  /** Present when `property_listing_view_events.property_id` is selected */
  property_id?: number | null;
  client_device_hint?: string | null;
};

export type NeighborhoodHeatCell = {
  key: string;
  label: string;
  views: number;
  /** 0–1 for heat styling */
  intensity: number;
};

export type PropertyGeoForViews = {
  governorate: string | null;
  district: string | null;
};

/** Same human label as lead geography bars: «محافظة — حي» or governorate only */
export function neighborhoodLabelFromGeo(p: PropertyGeoForViews): string {
  const gov = (p.governorate ?? "").trim() || "غير محدد";
  const dist = (p.district ?? "").trim();
  return dist ? `${gov} — ${dist}` : gov;
}

/** View counts rolled up by neighborhood (from listing view events × property location). */
export function aggregateViewNeighborhoodHeat(
  events: ViewEventRow[],
  propertyById: ReadonlyMap<number, PropertyGeoForViews>,
  maxCells = 12,
): NeighborhoodHeatCell[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const raw = e.property_id;
    if (raw === undefined || raw === null) continue;
    const pid = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(pid)) continue;
    const prop = propertyById.get(pid);
    if (!prop) continue;
    const label = neighborhoodLabelFromGeo(prop);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCells);
  const max = Math.max(...sorted.map(([, v]) => v), 1);
  return sorted.map(([label, views]) => ({
    key: label,
    label,
    views,
    intensity: views / max,
  }));
}

/** Property id → total listing views in the current event set */
export function aggregateViewsByPropertyId(events: ViewEventRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const e of events) {
    const raw = e.property_id;
    if (raw === undefined || raw === null) continue;
    const pid = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(pid)) continue;
    m.set(pid, (m.get(pid) ?? 0) + 1);
  }
  return m;
}

export function aggregateDeviceMix(events: ViewEventRow[]): { name: string; value: number }[] {
  let m = 0;
  let d = 0;
  let u = 0;
  for (const e of events) {
    const h = (e.client_device_hint ?? "").toLowerCase();
    if (h === "mobile") m += 1;
    else if (h === "desktop") d += 1;
    else u += 1;
  }
  const out: { name: string; value: number }[] = [];
  if (m) out.push({ name: "جوال", value: m });
  if (d) out.push({ name: "سطح مكتب", value: d });
  if (u) out.push({ name: "غير معروف", value: u });
  return out;
}

export function hasDeviceHints(events: ViewEventRow[]): boolean {
  return events.some((e) => e.client_device_hint === "mobile" || e.client_device_hint === "desktop");
}
