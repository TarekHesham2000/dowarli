"use client";

import type { CSSProperties } from "react";
import { AgencyPdfExportSurface, type AgencyPdfExportSurfaceProps } from "./AgencyPdfExportSurface";

/** Off-screen host for the PDF snapshot — loaded with `next/dynamic({ ssr: false })` from the dashboard. */
const hostStyle: CSSProperties = {
  position: "fixed",
  left: -14000,
  top: 0,
  zIndex: 5,
  pointerEvents: "none",
};

export default function AgencyPdfReportIsland(props: AgencyPdfExportSurfaceProps) {
  return (
    <div style={hostStyle} aria-hidden>
      <AgencyPdfExportSurface {...props} />
    </div>
  );
}
