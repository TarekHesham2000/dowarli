"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GeoHotBarRow, NeighborhoodHeatCell } from "./agencyLeadAnalytics";

/** Neon / financial dashboard palette: teal, violet, gold */
export const CHART_NEON = {
  teal: "#2dd4bf",
  tealDeep: "#0d9488",
  purple: "#a78bfa",
  purpleDeep: "#7c3aed",
  gold: "#fbbf24",
  goldDeep: "#d97706",
  grid: "#334155",
  tick: "#94a3b8",
} as const;

const PIE_COLORS = [
  CHART_NEON.teal,
  CHART_NEON.purpleDeep,
  CHART_NEON.gold,
  CHART_NEON.tealDeep,
  CHART_NEON.purple,
  CHART_NEON.goldDeep,
  "#5eead4",
  "#c4b5fd",
];

const BAR_GRADIENT_IDS = ["barFillTeal", "barFillPurple", "barFillGold"] as const;

type SeriesRow = { label: string; views: number; leads: number };
export type PieRow = { name: string; value: number };

const tooltipDark = {
  contentStyle: {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(167, 139, 250, 0.35)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#f1f5f9",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  },
  labelStyle: { color: "#e2e8f0" },
};

const anim = { isAnimationActive: true, animationDuration: 900, animationEasing: "ease-out" as const };

function pieTooltipTotal(data: readonly PieRow[]) {
  return data.reduce((s, d) => s + d.value, 0) || 1;
}

type LineProps = { data: SeriesRow[]; animKey: string };
export function ViewsLeadsLineChart({ data, animKey }: LineProps) {
  return (
    <div dir="ltr" className="h-[280px] w-full min-w-0">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vlLineViews" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_NEON.purple} />
              <stop offset="100%" stopColor={CHART_NEON.teal} />
            </linearGradient>
            <linearGradient id="vlLineLeads" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_NEON.teal} />
              <stop offset="100%" stopColor={CHART_NEON.gold} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEON.grid} opacity={0.55} />
          <XAxis dataKey="label" tick={{ fill: CHART_NEON.tick, fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
          <YAxis
            tick={{ fill: CHART_NEON.tick, fontSize: 11 }}
            axisLine={{ stroke: "#475569" }}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <Tooltip {...tooltipDark} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
          <Line
            type="monotone"
            dataKey="views"
            name="مشاهدات"
            stroke="url(#vlLineViews)"
            strokeWidth={2.8}
            connectNulls={false}
            dot={{ r: 3, fill: CHART_NEON.purple, stroke: "#0f172a", strokeWidth: 1 }}
            activeDot={{ r: 6, fill: CHART_NEON.teal }}
            {...anim}
          />
          <Line
            type="monotone"
            dataKey="leads"
            name="طلبات"
            stroke="url(#vlLineLeads)"
            strokeWidth={2.8}
            connectNulls={false}
            dot={{ r: 3, fill: CHART_NEON.gold, stroke: "#0f172a", strokeWidth: 1 }}
            activeDot={{ r: 6, fill: CHART_NEON.tealDeep }}
            {...anim}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type ViewsOnlyProps = { data: SeriesRow[]; animKey: string };

/** Single-series area: listing views over time (growth curve). */
export function PropertyViewsTrendChart({ data, animKey }: ViewsOnlyProps) {
  return (
    <div dir="ltr" className="h-[300px] w-full min-w-0">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="viewsTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_NEON.teal} stopOpacity={0.45} />
              <stop offset="55%" stopColor={CHART_NEON.purpleDeep} stopOpacity={0.12} />
              <stop offset="100%" stopColor={CHART_NEON.gold} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="viewsTrendStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_NEON.teal} />
              <stop offset="50%" stopColor={CHART_NEON.purple} />
              <stop offset="100%" stopColor={CHART_NEON.gold} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={CHART_NEON.grid} opacity={0.5} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_NEON.tick, fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
          <YAxis
            tick={{ fill: CHART_NEON.tick, fontSize: 11 }}
            axisLine={{ stroke: "#475569" }}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <Tooltip
            {...tooltipDark}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              return [`${v}`, "مشاهدات"];
            }}
          />
          <Area
            type="monotone"
            dataKey="views"
            name="مشاهدات"
            stroke="url(#viewsTrendStroke)"
            strokeWidth={2.6}
            fill="url(#viewsTrendFill)"
            activeDot={{ r: 7, fill: CHART_NEON.gold, stroke: "#0f172a", strokeWidth: 2 }}
            {...anim}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type PieProps = {
  data: PieRow[];
  animKey: string;
  onSliceClick?: (segmentName: string, value: number) => void;
};

export function LeadIntelligencePieChart({ data, animKey, onSliceClick }: PieProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <p className="m-0 text-sm font-bold text-slate-400">لا توجد بيانات في الفترة المحددة</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">جرّب توسيع نطاق التاريخ أو انتظر وصول طلبات جديدة.</p>
      </div>
    );
  }
  const total = pieTooltipTotal(data);
  return (
    <div dir="ltr" className="h-[320px] w-full min-w-0">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <PieChart>
          <defs>
            <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={96}
            paddingAngle={2.2}
            label={(props: { name?: string; percent?: number }) =>
              `${props.name ?? ""} (${((props.percent ?? 0) * 100).toFixed(0)}٪)`
            }
            labelLine={{ stroke: "#64748b" }}
            cursor="pointer"
            {...anim}
            onClick={(slice) => {
              const d = slice as { name?: string; value?: number };
              if (d?.name) onSliceClick?.(d.name, Number(d.value ?? 0));
            }}
          >
            {data.map((_, i) => (
              <Cell
                key={String(i)}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="#020617"
                strokeWidth={1.5}
                style={{ filter: "url(#pieGlow)" }}
              />
            ))}
          </Pie>
          <Tooltip
            {...tooltipDark}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v} طلب (${pct}٪)`, "العدد"];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type GeoBarProps = {
  data: GeoHotBarRow[];
  animKey: string;
  onBarClick?: (row: GeoHotBarRow) => void;
};

export function GeographyHotBarChart({ data, animKey, onBarClick }: GeoBarProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <p className="m-0 text-sm font-bold text-slate-400">لا توجد بيانات في الفترة المحددة</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">الطلبات ستُجمّع هنا حسب المحافظة والحي.</p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.demand), 1);
  return (
    <div dir="ltr" className="h-[340px] w-full min-w-0">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 4, bottom: 8 }} barCategoryGap={10}>
          <defs>
            {BAR_GRADIENT_IDS.map((gid, i) => (
              <linearGradient key={gid} id={gid} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={i === 0 ? CHART_NEON.teal : i === 1 ? CHART_NEON.purple : CHART_NEON.gold} />
                <stop
                  offset="100%"
                  stopColor={i === 0 ? CHART_NEON.tealDeep : i === 1 ? CHART_NEON.purpleDeep : CHART_NEON.goldDeep}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEON.grid} horizontal={false} opacity={0.55} />
          <XAxis
            type="number"
            tick={{ fill: CHART_NEON.tick, fontSize: 11 }}
            allowDecimals={false}
            axisLine={{ stroke: "#475569" }}
            domain={[0, max + Math.max(1, Math.ceil(max * 0.08))]}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tick={{ fill: CHART_NEON.tick, fontSize: 10 }}
            axisLine={{ stroke: "#475569" }}
            tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 24)}…` : v)}
          />
          <Tooltip
            {...tooltipDark}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const sum = data.reduce((s, d) => s + d.demand, 0) || 1;
              const pct = ((v / sum) * 100).toFixed(1);
              return [`${v} استفسار (${pct}٪ من الإجمالي)`, "الطلبات"];
            }}
          />
          <Bar
            dataKey="demand"
            name="الطلبات"
            radius={[0, 10, 10, 0]}
            cursor="pointer"
            {...anim}
            onClick={(barData) => {
              const d = barData as { name?: string; demand?: number };
              const hit = data.find((x) => x.name === d.name);
              if (hit) onBarClick?.(hit);
            }}
          >
            {data.map((_, i) => (
              <Cell key={String(i)} fill={`url(#${BAR_GRADIENT_IDS[i % BAR_GRADIENT_IDS.length]})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type DeviceProps = { data: PieRow[]; animKey: string };

export function DeviceMixMiniChart({ data, animKey }: DeviceProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="m-0 text-xs font-bold text-slate-400">لا توجد بيانات أجهزة بعد</p>
        <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-slate-500">
          نفّذ sql/property_listing_view_device_hint.sql وافتح الإعلان من الجوال أو الكمبيوتر — ستظهر المقارنة هنا تلقائياً.
        </p>
      </div>
    );
  }
  const total = pieTooltipTotal(data);
  const fills = [CHART_NEON.purple, CHART_NEON.teal, CHART_NEON.gold];
  return (
    <div dir="ltr" className="mx-auto h-[220px] w-full min-w-0 max-w-lg">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 10, left: 10, bottom: 32 }} barCategoryGap={18}>
          <defs>
            <linearGradient id="deviceBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_NEON.purple} />
              <stop offset="100%" stopColor={CHART_NEON.tealDeep} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEON.grid} vertical={false} opacity={0.45} />
          <XAxis dataKey="name" tick={{ fill: CHART_NEON.tick, fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
          <YAxis tick={{ fill: CHART_NEON.tick, fontSize: 11 }} allowDecimals={false} domain={[0, "auto"]} />
          <Tooltip
            {...tooltipDark}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v} (${pct}٪)`, "مشاهدات"];
            }}
          />
          <Bar dataKey="value" name="المشاهدات" radius={[10, 10, 4, 4]} {...anim}>
            {data.map((_, i) => (
              <Cell key={String(i)} fill={i === 0 ? "url(#deviceBar)" : fills[i % fills.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type HeatmapProps = { cells: NeighborhoodHeatCell[]; animKey: string };

/** CSS grid «heatmap»: intensity from relative listing views per neighborhood */
export function NeighborhoodHeatmapGrid({ cells, animKey }: HeatmapProps) {
  if (cells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 py-12 text-center">
        <p className="m-0 text-sm font-bold text-slate-400">لا توجد مشاهدات مرتبطة بمواقع في الفترة</p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          عند زيارة صفحات إعلاناتك تُحسب المشاهدات حسب محافظة وحي العقار (مثل القاهرة الجديدة، الشيخ زايد، …).
        </p>
      </div>
    );
  }
  return (
    <div key={animKey} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cells.map((cell) => {
        const t = CHART_NEON.teal;
        const p = CHART_NEON.purpleDeep;
        const i = cell.intensity;
        return (
          <div
            key={cell.key}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] p-4 shadow-lg shadow-black/30 transition hover:border-teal-400/35"
            style={{
              background: `linear-gradient(145deg, rgba(45,212,191,${0.06 + i * 0.38}) 0%, rgba(124,58,237,${0.05 + i * 0.28}) 48%, rgba(251,191,36,${0.04 + i * 0.2}) 100%)`,
              boxShadow: i >= 0.85 ? `0 0 28px rgba(45,212,191,0.18), inset 0 1px 0 rgba(255,255,255,0.06)` : undefined,
            }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
              style={{ background: `radial-gradient(circle, ${t} 0%, transparent 70%)` }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-8 left-0 h-20 w-20 rounded-full opacity-30 blur-2xl"
              style={{ background: `radial-gradient(circle, ${p} 0%, transparent 70%)` }}
              aria-hidden
            />
            <p className="relative line-clamp-3 text-xs font-bold leading-snug text-slate-100">{cell.label}</p>
            <p className="relative mt-3 text-2xl font-black tabular-nums text-white">{cell.views}</p>
            <p className="relative mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">مشاهدة للإعلانات</p>
            <div
              className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950/50"
              role="presentation"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-gradient-to-l from-amber-300 via-violet-400 to-teal-300"
                style={{ width: `${Math.round(i * 100)}%`, opacity: 0.85 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
