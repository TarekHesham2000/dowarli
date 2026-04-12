"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { POINTS_CHANGED_EVENT } from "@/lib/profilePointsSync";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";

/**
 * شريط التنقل العام — يتزامن مع جلسة Supabase ويعرض أزرار الضيف أو المستخدم بدون رمشة أولية.
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
        className="sticky top-0 z-[100] flex h-[58px] flex-nowrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/75 px-3 backdrop-blur-xl sm:h-[70px] sm:gap-3 sm:px-6 md:px-8"
      >
        <Link
          href="/"
          onClick={closeMobile}
          className="flex min-w-0 max-w-[min(52vw,168px)] shrink items-center rounded-lg py-1.5 no-underline transition-opacity duration-200 hover:opacity-[0.92] sm:max-w-[200px] sm:px-2 md:max-w-none md:px-3"
          aria-label="دَورلي – الصفحة الرئيسية"
        >
          <Image
            src="/images/full-logo.png"
            alt="دَورلي — Dowarly"
            width={220}
            height={44}
            className="h-8 w-full max-h-9 object-contain object-center sm:h-10 sm:max-h-[2.5rem] md:w-auto"
            priority
            quality={75}
          />
        </Link>

        {userId && !loading ? (
          <Link
            href="/wallet"
            className="hidden shrink-0 items-center rounded-full border border-emerald-500/35 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-950/45 sm:px-3 sm:text-xs md:flex"
            title="المحفظة والنقاط"
          >
            <span dir="ltr" className="whitespace-nowrap">
              💎 {points} Points
            </span>
          </Link>
        ) : null}

        {/* Desktop / tablet — min-w يثبت العرض تقريباً بين حالتَي ضيف/مستخدم */}
        <div className="hidden min-h-[38px] min-w-0 flex-nowrap items-center justify-end gap-2 md:flex md:min-w-[210px] md:gap-2.5 lg:min-w-[260px] lg:gap-3">
          {loading ? (
            <>
              <div
                className="h-9 w-[5.75rem] shrink-0 animate-pulse rounded-xl bg-slate-700/55 ring-1 ring-white/5"
                aria-hidden
              />
              <div
                className="h-9 w-24 shrink-0 animate-pulse rounded-xl bg-slate-700/45 ring-1 ring-white/5"
                aria-hidden
              />
            </>
          ) : userId ? (
            <>
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  className="whitespace-nowrap rounded-xl border border-amber-500/45 bg-amber-950/20 px-4 py-2 text-center text-[13px] font-bold text-amber-100 transition hover:border-amber-400/70 hover:bg-amber-950/40"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-[13px] font-bold text-slate-200 transition hover:border-amber-500/35 hover:bg-amber-950/25 hover:text-amber-50"
              >
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="nav-link whitespace-nowrap rounded-xl border-[1.5px] border-emerald-500/50 px-[22px] py-2 text-center text-[13px] font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-950/25"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-xl bg-gradient-to-l from-amber-600 to-emerald-700 px-[22px] py-2 text-center text-[13px] font-bold text-white shadow-lg shadow-amber-900/30 transition hover:brightness-110"
              >
                تسجيل الدخول
              </Link>
            </>
          )}
        </div>

        {/* Mobile — نقاط + القائمة */}
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          {userId && !loading ? (
            <Link
              href="/wallet"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-950/35 px-2 text-[10px] font-bold text-emerald-200"
              title="المحفظة"
            >
              <span dir="ltr" className="whitespace-nowrap">
                💎{points}
              </span>
            </Link>
          ) : null}
          {loading ? (
            <div
              className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-700/55 ring-1 ring-white/5"
              aria-hidden
            />
          ) : (
            <button
              type="button"
              className="flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] p-2 text-slate-200 transition hover:border-emerald-500/35 hover:bg-emerald-950/20 hover:text-emerald-100"
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

      {/* شريط جانبي — أقل من md */}
      <div
        className={`fixed inset-0 z-[110] md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
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
          className={`absolute left-0 top-0 flex h-full w-[min(100%,300px)] max-w-[85vw] flex-col gap-3 border-r border-white/10 bg-slate-950/98 p-4 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <span className="text-sm font-bold text-slate-300" style={{ fontFamily: "'Cairo', sans-serif" }}>
              القائمة
            </span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="إغلاق"
              onClick={closeMobile}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!loading && userId ? (
            <div className="flex flex-col gap-2.5">
              <Link
                href="/wallet"
                onClick={closeMobile}
                className="rounded-xl border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 text-center text-sm font-bold text-emerald-100"
              >
                💎 المحفظة ({points} نقطة)
              </Link>
              {showDashboard ? (
                <Link
                  href={dashboardHref}
                  onClick={closeMobile}
                  className="rounded-xl border border-amber-500/45 bg-amber-950/20 px-4 py-3 text-center text-sm font-bold text-amber-100"
                >
                  لوحة التحكم
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-200"
              >
                تسجيل الخروج
              </button>
            </div>
          ) : !loading ? (
            <div className="flex flex-col gap-2.5">
              <Link
                href="/register"
                onClick={closeMobile}
                className="rounded-xl border-[1.5px] border-emerald-500/50 bg-emerald-950/15 px-4 py-3 text-center text-sm font-bold text-emerald-300"
              >
                انضم كمالك
              </Link>
              <Link
                href="/login"
                onClick={closeMobile}
                className="rounded-xl bg-gradient-to-l from-amber-600 to-emerald-700 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-amber-900/30"
              >
                تسجيل الدخول
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="h-12 animate-pulse rounded-xl bg-slate-700/50" />
              <div className="h-12 animate-pulse rounded-xl bg-slate-700/40" />
            </div>
          )}

          <Link
            href="/"
            onClick={closeMobile}
            className="mt-auto border-t border-white/10 pt-4 text-center text-xs font-semibold text-slate-500 hover:text-slate-300"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </>
  );
}
