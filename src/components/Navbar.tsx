"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * شريط التنقل العام — يتزامن مع جلسة Supabase ويعرض أزرار الضيف أو المستخدم بدون رمشة أولية.
 */
export default function Navbar() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = async (uid: string | null) => {
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
        if (!mounted) return;
        setRole(typeof data?.role === "string" ? data.role : null);
      } else {
        setRole(null);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setRole(null);
    router.push("/");
    router.refresh();
  };

  const showDashboard = Boolean(userId && (role === "broker" || role === "admin"));
  const dashboardHref = role === "admin" ? "/admin" : "/dashboard";

  return (
    <nav
      role="navigation"
      aria-label="القائمة الرئيسية"
      dir="rtl"
      className="sticky top-0 z-[100] flex h-[70px] items-center justify-between border-b border-white/10 bg-slate-950/75 px-4 backdrop-blur-xl sm:px-8"
    >
      <Link
        href="/"
        className="flex shrink-0 items-center rounded-xl px-3 py-2 no-underline transition-opacity duration-200 hover:opacity-[0.92]"
        aria-label="دَورلي – الصفحة الرئيسية"
      >
        <Image
          src="/images/full-logo.png"
          alt="دَورلي — Dowarly"
          width={220}
          height={44}
          className="h-9 w-auto max-h-10 object-contain object-center sm:h-10 sm:max-h-[2.5rem]"
          priority
          quality={75}
        />
      </Link>

      {/* min-w يثبت العرض تقريباً بين حالتَي ضيف/مستخدم ويقلل تحرك التخطيط */}
      <div className="flex min-h-[38px] min-w-[210px] items-center justify-end gap-2.5 transition-opacity duration-200 ease-out sm:min-w-[260px]">
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
    </nav>
  );
}
