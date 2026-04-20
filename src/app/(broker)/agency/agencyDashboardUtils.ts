export type DateRangeKey = "today" | "7d" | "30d" | "year";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "7d", label: "٧ أيام" },
  { key: "30d", label: "٣٠ يوماً" },
  { key: "year", label: "سنة" },
];

export function rangeStartMs(key: DateRangeKey, now = new Date()): number {
  const t = now.getTime();
  if (key === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (key === "7d") return t - 7 * 86400000;
  if (key === "30d") return t - 30 * 86400000;
  return t - 365 * 86400000;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Bucket key + short Arabic-friendly label for charts */
export function buildTimeBuckets(
  range: DateRangeKey,
  now = new Date(),
): { key: string; label: string }[] {
  const start = rangeStartMs(range, now);

  if (range === "today") {
    const slots = 6;
    const out: { key: string; label: string }[] = [];
    for (let i = 0; i < slots; i++) {
      const fromH = i * 4;
      const toH = Math.min((i + 1) * 4, 24);
      out.push({
        key: `slot-${i}`,
        label: `${fromH}–${toH}س`,
      });
    }
    return out;
  }

  if (range === "year") {
    const out: { key: string; label: string }[] = [];
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
      out.push({
        key,
        label: d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit", timeZone: "UTC" }),
      });
    }
    return out;
  }

  /* 7d / 30d: one bucket per UTC calendar day so keys match Postgres ISO timestamps (…T…Z).slice(0,10) */
  const keys: { key: string; label: string }[] = [];
  const c = new Date(start);
  c.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(now);
  endDay.setUTCHours(23, 59, 59, 999);
  while (c <= endDay) {
    const key = c.toISOString().slice(0, 10);
    const labelDate = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate()));
    keys.push({
      key,
      label:
        range === "30d"
          ? labelDate.toLocaleDateString("ar-EG", { day: "numeric", month: "short", timeZone: "UTC" })
          : labelDate.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    });
    c.setUTCDate(c.getUTCDate() + 1);
  }
  return keys;
}

function slotIndexForToday(tsMs: number, dayStartMs: number): number {
  const h = Math.floor((tsMs - dayStartMs) / 3600000);
  const clamped = Math.max(0, Math.min(23, h));
  return Math.min(5, Math.floor(clamped / 4));
}

export function aggregateSeries(
  range: DateRangeKey,
  viewTimes: string[],
  leadTimes: string[],
  now = new Date(),
): { label: string; views: number; leads: number }[] {
  const buckets = buildTimeBuckets(range, now);
  const viewsMap = new Map<string, number>();
  const leadsMap = new Map<string, number>();
  for (const b of buckets) {
    viewsMap.set(b.key, 0);
    leadsMap.set(b.key, 0);
  }

  const dayStartMs = rangeStartMs("today", now);

  for (const iso of viewTimes) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t) || t < rangeStartMs(range, now) || t > now.getTime()) continue;
    let k: string;
    if (range === "today") {
      k = `slot-${slotIndexForToday(t, dayStartMs)}`;
    } else if (range === "year") {
      k = iso.length >= 7 ? iso.slice(0, 7) : "";
      if (!k) continue;
    } else {
      k = iso.slice(0, 10);
    }
    if (viewsMap.has(k)) {
      viewsMap.set(k, (viewsMap.get(k) ?? 0) + 1);
    }
  }

  for (const iso of leadTimes) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t) || t < rangeStartMs(range, now) || t > now.getTime()) continue;
    let k: string;
    if (range === "today") {
      k = `slot-${slotIndexForToday(t, dayStartMs)}`;
    } else if (range === "year") {
      k = iso.length >= 7 ? iso.slice(0, 7) : "";
      if (!k) continue;
    } else {
      k = iso.slice(0, 10);
    }
    if (leadsMap.has(k)) {
      leadsMap.set(k, (leadsMap.get(k) ?? 0) + 1);
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    views: Number(viewsMap.get(b.key) ?? 0),
    leads: Number(leadsMap.get(b.key) ?? 0),
  }));
}

const UNIT_LABELS: Record<string, string> = {
  student: "وحدات طلاب",
  family: "عائلي",
  studio: "استوديو",
  shared: "مشترك",
  employee: "موظفين",
  all: "أخرى",
};

export function unitTypeLabel(u: string): string {
  const t = (u || "").trim().toLowerCase();
  return UNIT_LABELS[t] || (t ? t : "غير محدد");
}

export function aggregatePieByUnitType(
  rows: { unit_type?: string | null }[],
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = (r.unit_type ?? "").trim().toLowerCase() || "other";
    const label = unitTypeLabel(raw);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

/** First image URL from `properties.images` (string[] in DB). */
export function firstPropertyImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const x of images) {
    if (typeof x === "string" && x.trim()) return x.trim();
  }
  return null;
}

export function aggregateBarByLocation(
  rows: { governorate?: string | null; district?: string | null; area?: string | null }[],
  topN = 8,
): { name: string; demand: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const loc =
      (r.governorate && r.governorate.trim()) ||
      (r.district && r.district.trim()) ||
      (r.area && r.area.trim()) ||
      "غير محدد";
    map.set(loc, (map.get(loc) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, demand]) => ({ name, demand }))
    .sort((a, b) => b.demand - a.demand)
    .slice(0, topN);
}
