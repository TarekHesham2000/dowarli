import Link from "next/link";
import type { ReactNode } from "react";
import Footer from "@/components/shared/Footer";

export default function InfoPageShell({
  title,
  subtitle,
  children,
}: Readonly<{
  title: string;
  subtitle?: string;
  children: ReactNode;
}>) {
  return (
    <div
      className="min-h-screen bg-[#f9fdfc] text-slate-800"
      dir="rtl"
      style={{ fontFamily: "var(--font-cairo), Cairo, system-ui, sans-serif" }}
    >
      <div
        className="border-b border-gray-200/80 bg-gradient-to-b from-emerald-50/90 via-white to-[#f9fdfc]"
        style={{ background: "linear-gradient(180deg, rgba(0,211,141,0.12) 0%, #ffffff 55%, #f9fdfc 100%)" }}
      >
        <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-lg font-extrabold text-[#00d38d] no-underline">
            دورلي
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 no-underline shadow-sm transition hover:bg-gray-50"
          >
            الرئيسية
          </Link>
        </header>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
          style={{ boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}
        >
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">{children}</div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
