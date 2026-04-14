"use client";

import type { CSSProperties } from "react";
import type { PieRow } from "./AgencyDashboardCharts";
import type { GeoHotBarRow } from "./agencyLeadAnalytics";

export type AgencyLineSeriesRow = { label: string; views: number; leads: number };

export type AgencyPdfExportSurfaceProps = {
  readonly agencyName: string;
  readonly dateRangeLabel: string;
  readonly generatedAtLabel: string;
  readonly totalViews: number;
  readonly totalLeads: number;
  readonly leadToViewRatioPct: number | null;
  readonly activeListingsCount: number;
  readonly propCount: number;
  readonly lineSeries: readonly AgencyLineSeriesRow[];
  readonly barData: readonly GeoHotBarRow[];
  readonly pieData: readonly PieRow[];
  readonly deviceMix: readonly PieRow[];
};

/* html2canvas/jsPDF: avoid Tailwind/CSS that compiles to lab()/oklch() — hex/rgb only. */
const C = {
  pageBg: "#f8fafc",
  text: "#0f172a",
  textMuted: "#475569",
  textDim: "#64748b",
  border: "#cbd5e1",
  borderLight: "#e2e8f0",
  white: "#ffffff",
  indigo: "#3730a3",
  indigoLight: "#4338ca",
  indigoBg: "#e0e7ff",
  emeraldBg: "#d1fae5",
  amberBg: "#fef3c7",
  amberBorder: "#f59e0b",
  amberText: "#78350f",
  amberTextSoft: "#92400e",
  theadGray: "#e2e8f0",
};

const cellBorder: CSSProperties = { border: `1px solid ${C.borderLight}` };

/** Snapshot for PDF — no utility classes (Tailwind v4 → lab/oklch breaks html2canvas). */
export function AgencyPdfExportSurface({
  agencyName,
  dateRangeLabel,
  generatedAtLabel,
  totalViews,
  totalLeads,
  leadToViewRatioPct,
  activeListingsCount,
  propCount,
  lineSeries,
  barData,
  pieData,
  deviceMix,
}: AgencyPdfExportSurfaceProps) {
  const ratioText = leadToViewRatioPct !== null ? `${leadToViewRatioPct}٪` : "—";
  const lineTail = lineSeries.slice(-10);

  const page: CSSProperties = {
    boxSizing: "border-box",
    width: 720,
    padding: 40,
    backgroundColor: C.pageBg,
    color: C.text,
    fontFamily: "system-ui, 'Segoe UI', Tahoma, sans-serif",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <div id="dashboard-report-content" dir="rtl" style={page}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          borderBottom: `1px solid ${C.border}`,
          paddingBottom: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: C.indigoLight }}>
            Dowarli — تقرير أداء
          </p>
          <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 900, color: C.text }}>{agencyName}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textMuted }}>
            الفترة: <span style={{ fontWeight: 700 }}>{dateRangeLabel}</span>
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textDim }}>أُنشئ في {generatedAtLabel}</p>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${C.amberBorder}`,
            background: `linear-gradient(135deg, #fffbeb 0%, ${C.amberBg} 100%)`,
            padding: "12px 16px",
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.amberTextSoft }}>ملخص سريع</p>
          <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 900, color: C.amberText }}>{totalLeads}</p>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.amberTextSoft }}>طلبات</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
        {[
          { k: "مشاهدات", v: String(totalViews) },
          { k: "طلبات", v: String(totalLeads) },
          { k: "نسبة الطلب للمشاهدة", v: ratioText },
          { k: "إعلانات نشطة", v: `${activeListingsCount} / ${propCount}` },
        ].map((c) => (
          <div
            key={c.k}
            style={{
              borderRadius: 8,
              border: `1px solid ${C.borderLight}`,
              backgroundColor: C.white,
              padding: "8px 12px",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textDim }}>{c.k}</p>
            <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 900, color: C.text }}>{c.v}</p>
          </div>
        ))}
      </div>

      <h2
        style={{
          margin: "32px 0 8px",
          paddingBottom: 6,
          borderBottom: `1px solid ${C.borderLight}`,
          fontSize: 13,
          fontWeight: 900,
          color: C.indigo,
        }}
      >
        المشاهدات والطلبات (آخر نقاط)
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: C.theadGray, textAlign: "right" }}>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>الفترة</th>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>مشاهدات</th>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>طلبات</th>
          </tr>
        </thead>
        <tbody>
          {lineTail.map((r) => (
            <tr key={r.label} style={{ backgroundColor: C.white }}>
              <td style={{ ...cellBorder, padding: "6px 8px" }}>{r.label}</td>
              <td style={{ ...cellBorder, padding: "6px 8px", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                {r.views}
              </td>
              <td style={{ ...cellBorder, padding: "6px 8px", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                {r.leads}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2
        style={{
          margin: "24px 0 8px",
          paddingBottom: 6,
          borderBottom: `1px solid ${C.borderLight}`,
          fontSize: 13,
          fontWeight: 900,
          color: C.indigo,
        }}
      >
        المناطق الأكثر طلباً
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: C.emeraldBg, textAlign: "right" }}>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>المنطقة</th>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>الطلبات</th>
          </tr>
        </thead>
        <tbody>
          {barData.slice(0, 12).map((r) => (
            <tr key={r.name} style={{ backgroundColor: C.white }}>
              <td style={{ ...cellBorder, padding: "6px 8px" }}>{r.name}</td>
              <td style={{ ...cellBorder, padding: "6px 8px", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                {r.demand}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2
        style={{
          margin: "24px 0 8px",
          paddingBottom: 6,
          borderBottom: `1px solid ${C.borderLight}`,
          fontSize: 13,
          fontWeight: 900,
          color: C.indigo,
        }}
      >
        توزيع الطلبات (فئات)
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: C.indigoBg, textAlign: "right" }}>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>الفئة</th>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>العدد</th>
          </tr>
        </thead>
        <tbody>
          {pieData.slice(0, 14).map((r) => (
            <tr key={r.name} style={{ backgroundColor: C.white }}>
              <td style={{ ...cellBorder, padding: "6px 8px" }}>{r.name}</td>
              <td style={{ ...cellBorder, padding: "6px 8px", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2
        style={{
          margin: "24px 0 8px",
          paddingBottom: 6,
          borderBottom: `1px solid ${C.borderLight}`,
          fontSize: 13,
          fontWeight: 900,
          color: C.indigo,
        }}
      >
        أجهزة المشاهدات
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: C.amberBg, textAlign: "right" }}>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>الجهاز</th>
            <th style={{ ...cellBorder, padding: "6px 8px", fontWeight: 700 }}>المشاهدات</th>
          </tr>
        </thead>
        <tbody>
          {deviceMix.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ ...cellBorder, padding: "10px 8px", color: C.textDim }}>
                لا بيانات أجهزة في الفترة
              </td>
            </tr>
          ) : (
            deviceMix.map((r) => (
              <tr key={r.name} style={{ backgroundColor: C.white }}>
                <td style={{ ...cellBorder, padding: "6px 8px" }}>{r.name}</td>
                <td style={{ ...cellBorder, padding: "6px 8px", fontFamily: "ui-monospace, monospace" }} dir="ltr">
                  {r.value}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p
        style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
          textAlign: "center",
          fontSize: 10,
          color: C.textDim,
        }}
      >
        Dowarli — تقرير تلقائي للاستخدام الداخلي. الأرقام وفق الفترة المحددة في لوحة الوكالة.
      </p>
    </div>
  );
}
