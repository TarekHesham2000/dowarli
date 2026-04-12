"use client";

import type { CSSProperties } from "react";

/** Preset sizes for AdSense-style slots; swap `data-ad-slot` when you connect a real unit. */
export type AdBannerLayout = "leaderboard" | "rectangle" | "in-feed" | "detail";

const LAYOUT_BOX: Record<AdBannerLayout, CSSProperties> = {
  leaderboard: {
    minHeight: 90,
    width: "100%",
  },
  rectangle: {
    minHeight: 250,
    width: "100%",
    maxWidth: 300,
    marginInline: "auto",
  },
  "in-feed": {
    minHeight: 200,
    width: "100%",
  },
  detail: {
    minHeight: 100,
    width: "100%",
  },
};

export type AdBannerProps = {
  slotId: string;
  layout: AdBannerLayout;
  /** When the parent is the horizontal property scroller, match card width. */
  scrollerItem?: boolean;
  className?: string;
};

export default function AdBanner({
  slotId,
  layout,
  scrollerItem = false,
  className = "",
}: Readonly<AdBannerProps>) {
  const outerStyle: CSSProperties =
    scrollerItem && layout === "in-feed"
      ? {
          flex: "0 0 min(86vw, 320px)",
          width: "min(86vw, 320px)",
          maxWidth: "min(86vw, 320px)",
          scrollSnapAlign: "center",
          scrollSnapStop: "always",
        }
      : layout === "in-feed"
        ? { gridColumn: "1 / -1" }
        : {};

  return (
    <aside
      className={`rounded-2xl border border-slate-200/90 bg-slate-100/95 shadow-sm dark:border-slate-600/40 dark:bg-slate-800/90 ${className}`.trim()}
      style={{
        ...outerStyle,
        padding: "10px 12px 12px",
        boxSizing: "border-box",
      }}
      aria-label="إعلان ممول"
      data-ad-placeholder="true"
      data-ad-slot={slotId}
    >
      <p
        className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        إعلان ممول
      </p>
      {/* Google AdSense: uncomment + set data-ad-client when ready
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-XXXXXXXX"
        data-ad-slot={slotId}
        data-ad-format={layout === "in-feed" ? "fluid" : "auto"}
        data-full-width-responsive="true"
      />
      */}
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/80 text-center dark:border-slate-500/50 dark:bg-slate-900/50"
        style={{
          ...LAYOUT_BOX[layout],
          boxSizing: "border-box",
        }}
      >
        <span
          className="px-3 text-[11px] font-medium text-slate-400 dark:text-slate-500"
          style={{ fontFamily: "'Cairo', sans-serif", lineHeight: 1.5 }}
        >
          مساحة إعلان
          <br />
          <span className="text-[10px] opacity-80" dir="ltr">
            slot: {slotId}
          </span>
        </span>
      </div>
    </aside>
  );
}
