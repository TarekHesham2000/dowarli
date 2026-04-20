"use client";

import Link from "next/link";
import { useState } from "react";
import type { HomeAgencyPartner } from "@/lib/fetchHomeAgencyPartners";

function agencyNameInitials(name: string): string {
  const t = name.trim();
  if (!t) return "؟";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function AgencyLogoTile({ partner, linkHref }: Readonly<{ partner: HomeAgencyPartner; linkHref: string }>) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTryImg = Boolean(partner.logoUrl) && !loadFailed;
  const abbr = agencyNameInitials(partner.name);

  return (
    <Link
      href={linkHref}
      className="group flex h-[56px] min-w-[150px] shrink-0 items-center justify-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 no-underline transition hover:border-[#00d38d]/40 hover:bg-gray-50"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
        {canTryImg && partner.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase + dynamic onError reverts to initials
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="h-full w-full object-contain p-0.5"
            sizes="40px"
            onError={() => {
              setLoadFailed(true);
            }}
          />
        ) : (
          <span
            className="text-center text-[11px] font-black leading-none tracking-tight text-[#00a86b]"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {abbr}
          </span>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-right text-[11px] font-bold text-slate-600 group-hover:text-slate-800">
        {partner.name}
      </span>
    </Link>
  );
}

type PartnerMarqueeProps = {
  className?: string;
  /** From server; empty = hide block */
  partners: HomeAgencyPartner[];
};

export default function PartnerMarquee({ className = "", partners }: Readonly<PartnerMarqueeProps>) {
  if (partners.length === 0) {
    return null;
  }

  const row = [...partners, ...partners];

  return (
    <section
      className={`partner-marquee-section overflow-hidden border-y border-gray-100 bg-gray-50 py-6 ${className}`.trim()}
      aria-label="شركاء دَورلي"
    >
      <p
        className="mb-3 text-center text-[11px] font-bold text-slate-500"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        شركاء معتمدون على دَورلي
      </p>
      <div className="relative partner-marquee-mask" dir="ltr">
        <div className="partner-marquee-track flex w-max gap-4 pr-4">
          {row.map((p, i) => (
            <AgencyLogoTile key={`${p.id}-${i}`} partner={p} linkHref={`/agency/${encodeURIComponent(p.slug)}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
