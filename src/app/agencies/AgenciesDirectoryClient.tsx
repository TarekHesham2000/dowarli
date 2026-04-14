"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/shared/Footer";

export type AgencyListRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  bio: string | null;
  active_listings_count: number;
};

export default function AgenciesDirectoryClient({ initial }: { initial: AgencyListRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return initial;
    return initial.filter((a) => a.name.toLowerCase().includes(n));
  }, [initial, q]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f8fafc]">
        <div className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-10 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">دليل الوكالات</h1>
            <p className="mt-2 text-sm text-slate-600">وكالات معتمدة على دَورلي — تصفّح العروض والتواصل عبر المنصة</p>
            <div className="mx-auto mt-6 max-w-md">
              <label htmlFor="agency-search" className="sr-only">
                بحث باسم الوكالة
              </label>
              <input
                id="agency-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث باسم الوكالة…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-10">
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-600">
              {initial.length === 0
                ? "لا توجد وكالات معتمدة في الدليل حالياً."
                : "لا توجد نتائج مطابقة للبحث."}
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/agency/${a.slug}`}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-emerald-300/60 hover:shadow-md no-underline"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-slate-100">
                      {a.logo_url ? (
                        <Image src={a.logo_url} alt={a.name} fill className="object-cover" sizes="64px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center" aria-hidden>
                          <Building2 className="h-8 w-8 text-emerald-700/50" strokeWidth={1.75} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-base font-extrabold text-slate-900">{a.name}</p>
                      <p className="mt-1 text-xs font-bold text-emerald-800">
                        {a.active_listings_count > 0
                          ? `${a.active_listings_count.toLocaleString("ar-EG")} إعلاناً نشطاً`
                          : "لا إعلانات نشطة حالياً"}
                      </p>
                      {a.bio ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{a.bio}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">عرض صفحة الوكالة</p>
                      )}
                    </div>
                    <span className="shrink-0 text-emerald-600 text-sm font-bold">←</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
