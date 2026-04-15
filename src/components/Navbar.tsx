"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { POINTS_CHANGED_EVENT } from "@/lib/profilePointsSync";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";
import SiteBrandLogo from "@/components/brand/SiteBrandLogo";

const BRAND = "#00d38d";
const ADD_PROPERTY_BTN =
  "inline-flex shrink-0 items-center justify-center rounded-lg bg-[#00d38d] px-3 py-2 text-center text-[12px] font-black text-white shadow-md shadow-emerald-600/20 no-underline transition hover:bg-[#00bf7f] sm:px-4 sm:text-[13px]";

/**
 * شريط تنقل — سطح المكتب: صف مع flex-wrap ومسافات؛ الجوال: زر همبرغر + درج.
 */
export default function Navbar() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** null = not loaded yet (avoid flashing wrong agency link) */
  const [hasAgency, setHasAgency] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = async (uid: string | null) => {
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase.from("profiles").select("role, points").eq("id", uid).maybeSingle();
        if (!mounted) return;
        const r = typeof data?.role === "string" ? data.role : null;
        setRole(r);
        setPoints(typeof data?.points === "number" ? data.points : 0);
        if (r === "broker" || r === "admin") {
          const { data: ag } = await supabase.from("agencies").select("id").eq("owner_id", uid).maybeSingle();
          if (!mounted) return;
          setHasAgency(Boolean(ag?.id));
        } else {
          setHasAgency(null);
        }
      } else {
        setRole(null);
        setPoints(0);
        setHasAgency(null);
      }
      setLoading(false);
    };

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      await applySession(user?.id ?? null);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const refetchPoints = async () => {
      const { data } = await supabase.from("profiles").select("points").eq("id", userId).maybeSingle();
      if (typeof data?.points === "number") setPoints(data.points);
    };

    const onCustom = () => {
      void refetchPoints();
    };
    window.addEventListener(POINTS_CHANGED_EVENT, onCustom);

    const channel = supabase
      .channel(`nav-profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { points?: unknown })?.points;
          if (typeof next === "number") setPoints(next);
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener(POINTS_CHANGED_EVENT, onCustom);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setMobileOpen(false);
    await supabase.auth.signOut();
    setUserId(null);
    setRole(null);
    setPoints(0);
    setHasAgency(null);
    router.push("/");
    safeRouterRefresh(router);
  };

  const showDashboard = Boolean(userId && (role === "broker" || role === "admin"));
  const dashboardHref = role === "admin" ? "/admin" : "/dashboard";
  const showBrokerTools = role === "broker" || role === "admin";

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <nav
        role="navigation"
        aria-label="القائمة الرئيسية"
        dir="rtl"
        className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-gray-200/60 bg-white/95 px-3 py-2 backdrop-blur-sm sm:px-4 md:min-h-[52px] md:py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial md:gap-3">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-700 shadow-sm transition hover:bg-gray-50 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="main-nav-drawer"
            aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
          </button>

          <Link
            href="/"
            onClick={closeMobile}
            className="flex min-w-0 shrink items-center py-0.5 no-underline transition-opacity hover:opacity-90"
            aria-label="دورلي – الصفحة الرئيسية"
          >
            <SiteBrandLogo layout="horizontal" />
          </Link>
          {showBrokerTools && !loading ? (
            <Link
              href="/broker/add-property"
              onClick={closeMobile}
              className={`${ADD_PROPERTY_BTN} ms-auto h-10 min-w-[40px] px-0 md:hidden`}
              aria-label="إضافة عقار"
              title="إضافة عقار"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
            </Link>
          ) : null}
        </div>

        {/* Desktop: لا تتداخل — flex-wrap + gap */}
        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-2 md:flex lg:gap-3">
          <Link
            href="/agencies"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 no-underline transition hover:bg-gray-50"
          >
            الوكالات
          </Link>
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" aria-hidden />
          ) : userId ? (
            <>
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 no-underline transition hover:bg-gray-50"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              {showBrokerTools ? (
                <>
                  {hasAgency === null ? (
                    <div className="h-9 w-[5.5rem] animate-pulse rounded-lg bg-gray-100" aria-hidden />
                  ) : (
                    <Link
                      href={hasAgency ? "/agency" : "/become-an-agency"}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 no-underline transition hover:bg-gray-50"
                    >
                      {hasAgency ? "وكالتي" : "أنشئ وكالة"}
                    </Link>
                  )}
                  <Link href="/broker/add-property" className={`${ADD_PROPERTY_BTN} hidden md:inline-flex`}>
                    + إضافة عقار
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 no-underline transition hover:bg-gray-50"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-[13px] font-bold text-white no-underline transition hover:opacity-95"
                style={{ backgroundColor: BRAND }}
              >
                تسجيل الدخول
              </Link>
            </>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {userId && !loading ? (
            <>
              <Link
                href="/wallet"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-white sm:px-3 sm:text-xs"
                title="المحفظة والنقاط"
              >
                <span dir="ltr" className="whitespace-nowrap">
                  💎 {points}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-gray-50"
              >
                خروج
              </button>
            </>
          ) : null}
        </div>
      </nav>

      {/* Mobile drawer — كل الروابط هنا لتجنب الزحام */}
      <div
        className={`fixed inset-0 z-[110] md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="إغلاق القائمة"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={closeMobile}
        />
        <div
          id="main-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
          dir="rtl"
          className={`absolute left-0 top-0 flex h-full w-[min(100%,300px)] max-w-[90vw] flex-col gap-2 border-r border-gray-200 bg-white p-4 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-xl transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <span className="text-sm font-bold text-slate-600" style={{ fontFamily: "var(--font-cairo), sans-serif" }}>
              القائمة
            </span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-gray-100 hover:text-slate-700"
              aria-label="إغلاق"
              onClick={closeMobile}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!loading && userId ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/agencies"
                onClick={closeMobile}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
              >
                دليل الوكالات
              </Link>
              <Link
                href="/wallet"
                onClick={closeMobile}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
              >
                💎 المحفظة ({points} نقطة)
              </Link>
              {showDashboard && role === "broker" ? (
                <Link
                  href="/dashboard/alerts"
                  onClick={closeMobile}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
                >
                  التنبيهات
                </Link>
              ) : null}
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  onClick={closeMobile}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              {showBrokerTools ? (
                <>
                  {hasAgency === null ? (
                    <div className="h-12 animate-pulse rounded-xl bg-gray-100" aria-hidden />
                  ) : (
                    <Link
                      href={hasAgency ? "/agency" : "/become-an-agency"}
                      onClick={closeMobile}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
                    >
                      {hasAgency ? "وكالتي" : "أنشئ وكالة"}
                    </Link>
                  )}
                  <Link href="/broker/add-property" onClick={closeMobile} className={`${ADD_PROPERTY_BTN} w-full py-3 text-sm`}>
                    + إضافة عقار
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
              >
                تسجيل الخروج
              </button>
            </div>
          ) : !loading ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/agencies"
                onClick={closeMobile}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
              >
                دليل الوكالات
              </Link>
              <Link
                href="/register"
                onClick={closeMobile}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 no-underline"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                onClick={closeMobile}
                className="rounded-xl px-4 py-3 text-center text-sm font-bold text-white no-underline"
                style={{ backgroundColor: BRAND }}
              >
                تسجيل الدخول
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
            </div>
          )}

          <Link
            href="/"
            onClick={closeMobile}
            className="mt-auto border-t border-gray-100 pt-4 text-center text-xs font-semibold text-slate-400 no-underline hover:text-slate-600"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </>
  );
}
