"use client";

import {
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
import type { GeoHotBarRow } from "./agencyLeadAnalytics";

/** Premium palette: indigo, emerald, gold accents */
const PIE_COLORS = [
  "#6366f1",
  "#4f46e5",
  "#10b981",
  "#059669",
  "#d97706",
  "#f59e0b",
  "#818cf8",
  "#34d399",
];

type SeriesRow = { label: string; views: number; leads: number };
export type PieRow = { name: string; value: number };

const tooltipDark = {
  contentStyle: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#f1f5f9",
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
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
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
            stroke="#6366f1"
            strokeWidth={2.5}
            connectNulls={false}
            dot={{ r: 3, stroke: "#312e81", strokeWidth: 1 }}
            activeDot={{ r: 5 }}
            {...anim}
          />
          <Line
            type="monotone"
            dataKey="leads"
            name="طلبات"
            stroke="#10b981"
            strokeWidth={2.5}
            connectNulls={false}
            dot={{ r: 3, stroke: "#064e3b", strokeWidth: 1 }}
            activeDot={{ r: 5 }}
            {...anim}
          />
        </LineChart>
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
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={92}
            paddingAngle={2}
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
              <Cell key={String(i)} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0f172a" strokeWidth={1} />
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
    <div dir="ltr" className="h-[320px] w-full min-w-0">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.6} />
          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} axisLine={{ stroke: "#475569" }} domain={[0, max + 1]} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={{ stroke: "#475569" }}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
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
            radius={[0, 8, 8, 0]}
            cursor="pointer"
            {...anim}
            onClick={(barData) => {
              const d = barData as { name?: string; demand?: number };
              const hit = data.find((x) => x.name === d.name);
              if (hit) onBarClick?.(hit);
            }}
          >
            {data.map((_, i) => (
              <Cell key={String(i)} fill={i % 2 === 0 ? "#4f46e5" : "#d97706"} />
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
  return (
    <div dir="ltr" className="h-[200px] w-full min-w-0 max-w-md mx-auto">
      <ResponsiveContainer key={animKey} width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#475569" }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} domain={[0, "auto"]} />
          <Tooltip
            {...tooltipDark}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v} (${pct}٪)`, "مشاهدات"];
            }}
          />
          <Bar dataKey="value" name="المشاهدات" fill="#d97706" radius={[8, 8, 0, 0]} {...anim} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
