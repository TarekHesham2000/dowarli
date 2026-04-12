"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatSavedSearchSummary } from "@/lib/savedSearchLabel";
import { propertyPathFromRecord } from "@/lib/propertySlug";

type SavedRow = {
  id: string;
  filters: unknown;
  created_at: string;
};

type NotifRow = {
  id: string;
  body: string;
  created_at: string;
  property_id: number;
  saved_search_id: string | null;
  properties?: { slug: string | null } | { slug: string | null }[] | null;
};

export default function DashboardAlertsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searches, setSearches] = useState<SavedRow[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        router.push("/login?next=/dashboard/alerts");
        return;
      }

      const [seRes, nRes] = await Promise.all([
        supabase.from("saved_searches").select("id, filters, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase
          .from("property_alert_notifications")
          .select("id, body, created_at, property_id, saved_search_id, properties(slug)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (seRes.error) {
        setError("تعذّر تحميل التنبيهات. تأكد من تشغيل سكربت قاعدة البيانات.");
        console.error(seRes.error);
        return;
      }
      if (nRes.error) {
        console.error(nRes.error);
      }

      setSearches((seRes.data as SavedRow[]) ?? []);
      setNotifs((nRes.data as NotifRow[]) ?? []);
    } catch (e) {
      console.error(e);
      setError("حدث خطأ أثناء التحميل.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const bySearchId = useMemo(() => {
    const m = new Map<string, NotifRow[]>();
    for (const n of notifs) {
      if (!n.saved_search_id) continue;
      const list = m.get(n.saved_search_id) ?? [];
      list.push(n);
      m.set(n.saved_search_id, list);
    }
    return m;
  }, [notifs]);

  const deleteSearch = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const { error: delErr } = await supabase.from("saved_searches").delete().eq("id", id);
      if (delErr) {
        alert(`تعذّر الحذف: ${delErr.message}`);
        return;
      }
      setSearches((prev) => prev.filter((s) => s.id !== id));
      setNotifs((prev) => prev.map((n) => (n.saved_search_id === id ? { ...n, saved_search_id: null } : n)));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-6 space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
          <div className="h-24 animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-gray-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-16 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">تنبيهاتي</h1>
          <p className="mt-1 text-sm text-slate-600">تطابقات جديدة تصلك عند الموافقة على إعلان يشبه بحثك المحفوظ.</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm no-underline transition hover:bg-gray-50"
        >
          ⟵ إضافة تنبيه من البحث
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      ) : null}

      {searches.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-700">لا توجد تنبيهات محفوظة بعد.</p>
          <p className="mt-2 text-xs text-slate-500">من الصفحة الرئيسية اضغط «نبهني» بعد ضبط البحث لتحفظ معاييرك.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold text-white no-underline" style={{ background: "#00d38d" }}>
            الذهاب للبحث
          </Link>
        </div>
      ) : null}

      <ul className="mt-2 flex list-none flex-col gap-4 p-0">
        {searches.map((s) => {
          const matches = bySearchId.get(s.id) ?? [];
          return (
            <li
              key={s.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100/80"
            >
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug text-slate-900">{formatSavedSearchSummary(s.filters)}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    أُنشئ {new Date(s.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingId === s.id}
                  onClick={() => void deleteSearch(s.id)}
                  className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingId === s.id ? "جاري الحذف…" : "حذف التنبيه"}
                </button>
              </div>

              <div className="bg-[#f9fdfc] px-4 py-3">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">آخر التطابقات</p>
                {matches.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد إشعارات بعد — سنُبلغك عند الموافقة على إعلان مناسب.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {matches.slice(0, 8).map((n) => (
                      <li key={n.id} className="rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-sm">
                        <p className="m-0 text-[13px] leading-relaxed text-slate-800">{n.body}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>{new Date(n.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span>
                          <Link
                            href={propertyPathFromRecord({
                              id: n.property_id,
                              slug: (() => {
                                const p = n.properties;
                                const o = Array.isArray(p) ? p[0] : p;
                                return o?.slug ?? null;
                              })(),
                            })}
                            className="font-bold text-[#00d38d] no-underline hover:underline"
                          >
                            عرض الإعلان
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {matches.length > 8 ? (
                  <p className="mt-2 text-[11px] text-slate-400">وعرض {matches.length - 8} تطابقاً أقدم…</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
