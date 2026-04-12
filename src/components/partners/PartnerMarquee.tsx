"use client";

const PARTNERS = [
  { name: "Mountain View", abbr: "MV" },
  { name: "Palm Hills", abbr: "PH" },
  { name: "SODIC", abbr: "SD" },
  { name: "Emaar Egypt", abbr: "EE" },
  { name: "Orascom", abbr: "OR" },
  { name: "Hassan Allam", abbr: "HA" },
  { name: "Madinet Nasr", abbr: "MN" },
  { name: "Sixth of October", abbr: "6O" },
  { name: "Tatweer Misr", abbr: "TM" },
  { name: "Hyde Park", abbr: "HP" },
] as const;

function LogoTile({ name, abbr }: Readonly<{ name: string; abbr: string }>) {
  return (
    <div
      className="flex h-[52px] min-w-[140px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-5 backdrop-blur-sm transition-colors hover:border-emerald-500/25 hover:bg-white/[0.09]"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[10px] font-black tracking-wider text-emerald-400/90">{abbr}</span>
        <span className="text-[11px] font-bold text-slate-300">{name}</span>
      </div>
    </div>
  );
}

export default function PartnerMarquee({ className = "" }: Readonly<{ className?: string }>) {
  const row = [...PARTNERS, ...PARTNERS];

  return (
    <section
      className={`partner-marquee-section overflow-hidden border-y border-white/[0.06] bg-slate-950/40 py-5 ${className}`.trim()}
      aria-label="شركاء ومجتمعات عقارية"
    >
      <p
        className="mb-3 text-center text-[11px] font-bold text-slate-500"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        شركاء موثوقون · أسماء للعرض التوضيحي
      </p>
      <div className="relative partner-marquee-mask" dir="ltr">
        <div className="partner-marquee-track flex w-max gap-4 pr-4">
          {row.map((p, i) => (
            <LogoTile key={`${p.name}-${i}`} name={p.name} abbr={p.abbr} />
          ))}
        </div>
      </div>
    </section>
  );
}
