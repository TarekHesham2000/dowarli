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
      className="flex h-[52px] min-w-[140px] shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 transition-colors hover:border-[#00d38d]/35 hover:bg-gray-50"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[10px] font-black tracking-wider text-[#00d38d]">{abbr}</span>
        <span className="text-[11px] font-bold text-slate-600">{name}</span>
      </div>
    </div>
  );
}

export default function PartnerMarquee({ className = "" }: Readonly<{ className?: string }>) {
  const row = [...PARTNERS, ...PARTNERS];

  return (
    <section
      className={`partner-marquee-section overflow-hidden border-y border-gray-100 bg-gray-50 py-6 ${className}`.trim()}
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
