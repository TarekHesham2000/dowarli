"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BRAND = "#00d38d";

const NAV = [
  { href: "/dashboard", label: "الرئيسية", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/alerts", label: "تنبيهاتي", match: (p: string) => p.startsWith("/dashboard/alerts") },
  { href: "/broker/add-property", label: "إضافة عقار", match: () => false },
  { href: "/wallet", label: "المحفظة", match: () => false },
] as const;

export default function DashboardHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="sticky top-0 z-50 flex h-11 items-center justify-between border-b border-gray-200/80 px-4 sm:h-12 sm:px-5"
      style={{
        background: "linear-gradient(180deg, rgba(0, 211, 141, 0.13) 0%, rgba(0, 211, 141, 0.06) 42%, #ffffff 100%)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0 rounded-lg py-1 no-underline transition-opacity hover:opacity-90">
          <span className="text-lg font-extrabold tracking-tight" style={{ color: BRAND }}>
            دورلي
          </span>
        </Link>
        <span className="hidden rounded-full border border-gray-200 bg-white/80 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600 sm:inline sm:text-[11px]">
          لوحة الوسيط
        </span>
      </div>
      <nav aria-label="لوحة الوسيط" className="flex max-w-[65vw] flex-wrap items-center justify-end gap-0.5 sm:max-w-none sm:gap-1">
        {NAV.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-bold no-underline sm:px-3 sm:text-[13px] ${
                active ? "bg-white/90 text-slate-900 shadow-sm ring-1 ring-gray-200/80" : "text-slate-600 hover:bg-white/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
