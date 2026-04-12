"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { POINTS_CHANGED_EVENT } from "@/lib/profilePointsSync";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";

const BRAND = "#00d38d";

/**
 * شريط تنقل خفيف — شعار نصي، خلفية بيضاء، أزرار أساسية باللون الأساسي.
 */
export default function Navbar() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applySession = async (uid: string | null) => {
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase.from("profiles").select("role, points").eq("id", uid).maybeSingle();
        if (!mounted) return;
        setRole(typeof data?.role === "string" ? data.role : null);
        setPoints(typeof data?.points === "number" ? data.points : 0);
      } else {
        setRole(null);
        setPoints(0);
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
    router.push("/");
    safeRouterRefresh(router);
  };

  const showDashboard = Boolean(userId && (role === "broker" || role === "admin"));
  const dashboardHref = role === "admin" ? "/admin" : "/dashboard";

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <nav
        role="navigation"
        aria-label="القائمة الرئيسية"
        dir="rtl"
        className="sticky top-0 z-[100] flex h-11 flex-nowrap items-center justify-between gap-2 border-b border-gray-200/60 bg-transparent px-3 sm:h-12 sm:gap-3 sm:px-5"
      >
        <Link
          href="/"
          onClick={closeMobile}
          className="flex min-w-0 shrink items-center py-1 no-underline transition-opacity hover:opacity-90"
          aria-label="دورلي – الصفحة الرئيسية"
        >
          <span
            className="text-xl font-extrabold tracking-tight sm:text-[1.35rem]"
            style={{ color: BRAND, fontFamily: "var(--font-cairo), Cairo, sans-serif" }}
          >
            دورلي
          </span>
        </Link>

        {userId && !loading ? (
          <Link
            href="/wallet"
            className="hidden shrink-0 items-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:border-gray-300 hover:bg-white sm:px-3 sm:text-xs md:flex"
            title="المحفظة والنقاط"
          >
            <span dir="ltr" className="whitespace-nowrap">
              💎 {points}
            </span>
          </Link>
        ) : null}

        <div className="hidden min-h-[34px] min-w-0 flex-nowrap items-center justify-end gap-2 md:flex md:min-w-[200px] lg:min-w-[240px]">
          {loading ? (
            <>
              <div className="h-8 w-20 shrink-0 animate-pulse rounded-lg bg-gray-100" aria-hidden />
              <div className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-gray-100" aria-hidden />
            </>
          ) : userId ? (
            <>
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-center text-[13px] font-bold text-slate-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-600 transition hover:bg-gray-50"
              >
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-center text-[13px] font-bold text-slate-700 transition hover:bg-gray-50"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-lg px-4 py-1.5 text-center text-[13px] font-bold text-white transition hover:opacity-95"
                style={{ backgroundColor: BRAND }}
              >
                تسجيل الدخول
              </Link>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          {userId && !loading ? (
            <Link
              href="/wallet"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 text-[10px] font-bold text-slate-700"
              title="المحفظة"
            >
              <span dir="ltr" className="whitespace-nowrap">
                💎{points}
              </span>
            </Link>
          ) : null}
          {loading ? (
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-gray-100" aria-hidden />
          ) : (
            <button
              type="button"
              className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-slate-600 transition hover:bg-gray-50"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5 shrink-0" strokeWidth={2} /> : <Menu className="h-5 w-5 shrink-0" strokeWidth={2} />}
            </button>
          )}
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-[110] md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="إغلاق القائمة"
          tabIndex={mobileOpen ? 0 : -1}
          onClick={closeMobile}
        />
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
          dir="rtl"
          className={`absolute left-0 top-0 flex h-full w-[min(100%,280px)] max-w-[85vw] flex-col gap-3 border-r border-gray-200 bg-white p-4 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-transform duration-200 ease-out ${
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
                href="/wallet"
                onClick={closeMobile}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-bold text-slate-800"
              >
                💎 المحفظة ({points} نقطة)
              </Link>
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  onClick={closeMobile}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
              >
                تسجيل الخروج
              </button>
            </div>
          ) : !loading ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/register"
                onClick={closeMobile}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                onClick={closeMobile}
                className="rounded-lg px-4 py-3 text-center text-sm font-bold text-white"
                style={{ backgroundColor: BRAND }}
              >
                تسجيل الدخول
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
            </div>
          )}

          <Link
            href="/"
            onClick={closeMobile}
            className="mt-auto border-t border-gray-100 pt-4 text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </>
  );
}
