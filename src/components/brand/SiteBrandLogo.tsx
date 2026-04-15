"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Building2, Shield } from "lucide-react";

/** Must match `public/images/` exactly (case-sensitive on Linux). */
export const SITE_LOGO_SRC = "/images/full-logo.png";

type SiteBrandLogoProps = {
  layout: "horizontal" | "icon";
  className?: string;
};

/**
 * Site logo from `/public/images/full-logo.png` with text/icon fallback if the asset fails (CDN, case, deploy).
 */
export default function SiteBrandLogo({ layout, className }: SiteBrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (layout === "horizontal") {
    if (failed) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight sm:text-[1.35rem] ${className ?? ""}`}
          style={{ color: "#00d38d", fontFamily: "var(--font-cairo), Cairo, sans-serif" }}
          role="img"
          aria-label="Dowarly"
        >
          <Building2 className="h-6 w-6 shrink-0 opacity-90 sm:h-7 sm:w-7" aria-hidden strokeWidth={2} />
          دورلي
        </span>
      );
    }
    return (
      <span className={`relative inline-flex h-8 items-center sm:h-9 ${className ?? ""}`}>
        <Image
          src={SITE_LOGO_SRC}
          alt="Dowarly"
          width={132}
          height={36}
          className="h-7 w-auto max-h-8 object-contain object-center sm:h-8"
          onError={onError}
          priority
        />
      </span>
    );
  }

  if (failed) {
    return (
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ${className ?? ""}`}
        role="img"
        aria-label="Dowarly"
      >
        <Shield className="size-5" aria-hidden />
      </div>
    );
  }
  return (
    <div className={`relative size-10 shrink-0 overflow-hidden rounded-xl bg-emerald-500/20 ${className ?? ""}`}>
      <Image
        src={SITE_LOGO_SRC}
        alt="Dowarly"
        fill
        className="object-contain p-1.5"
        sizes="40px"
        onError={onError}
      />
    </div>
  );
}
