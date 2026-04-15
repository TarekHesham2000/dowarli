"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import SiteBrandLogo from "@/components/brand/SiteBrandLogo";

const ADD_PROPERTY_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-[#00d38d] px-3 py-2 text-[12px] font-black text-white shadow-md shadow-emerald-600/25 no-underline transition hover:bg-[#00bf7f] sm:px-4 sm:text-[13px]";

const NAV_CORE = [
  { href: "/dashboard", label: "الرئيسية", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/alerts", label: "تنبيهاتي", match: (p: string) => p.startsWith("/dashboard/alerts") },
  { href: "/agency", label: "وكالتي", match: (p: string) => p === "/agency" },
  { href: "/wallet", label: "المحفظة", match: () => false },
] as const;

export default function DashboardHeader() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-200/80"
      style={{
        background: "linear-gradient(180deg, rgba(0, 211, 141, 0.13) 0%, rgba(0, 211, 141, 0.06) 42%, #ffffff 100%)",
      }}
    >
      <div className="mx-auto flex min-h-[48px] max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:min-h-[52px] sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:bg-gray-50 md:hidden"
            aria-expanded={open}
            aria-controls="broker-dash-drawer"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
          </button>
          <Link
            href="/"
            className="shrink-0 rounded-lg py-1 no-underline transition-opacity hover:opacity-90"
            aria-label="دورلي – الصفحة الرئيسية"
          >
            <SiteBrandLogo layout="horizontal" />
          </Link>
          <span className="hidden rounded-full border border-gray-200 bg-white/80 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600 sm:inline sm:text-[11px]">
            لوحة الوسيط
          </span>
        </div>

        {/* Desktop — flex-wrap + gap لتفادي التداخل */}
        <nav
          aria-label="لوحة الوسيط"
          className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:flex lg:gap-2.5"
        >
          {NAV_CORE.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-2.5 py-2 text-[12px] font-bold no-underline sm:px-3 sm:text-[13px] ${
                  active ? "bg-white/90 text-slate-900 shadow-sm ring-1 ring-gray-200/80" : "text-slate-600 hover:bg-white/60"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <Link href="/broker/add-property" className={ADD_PROPERTY_CLASS}>
            + إضافة عقار
          </Link>
        </nav>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          aria-label="إغلاق القائمة"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          id="broker-dash-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة لوحة الوسيط"
          dir="rtl"
          className={`absolute left-0 top-0 flex h-full w-[min(100%,300px)] max-w-[90vw] flex-col gap-2 border-r border-gray-200 bg-white p-4 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="text-sm font-bold text-slate-600">القائمة</span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-gray-100"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {NAV_CORE.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/broker/add-property"
              onClick={() => setOpen(false)}
              className={`${ADD_PROPERTY_CLASS} w-full py-3 text-sm`}
            >
              + إضافة عقار
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
