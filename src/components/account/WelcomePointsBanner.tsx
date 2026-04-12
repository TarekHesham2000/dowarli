"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const MESSAGE = "مبروك! حصلت على 100 نقطة هدية لبدء نشر إعلاناتك";

/**
 * One-time toast/banner after registration (profiles.welcome_points_banner_seen = false).
 */
export default function WelcomePointsBanner() {
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: row, error } = await supabase
        .from("profiles")
        .select("welcome_points_banner_seen")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error) return;
      if (row?.welcome_points_banner_seen === false) setVisible(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledge = async () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setVisible(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ welcome_points_banner_seen: true }).eq("id", user.id);
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[240] w-[min(100vw-1.5rem,26rem)] -translate-x-1/2 rounded-2xl border border-emerald-500/40 bg-slate-950/95 px-4 py-3.5 text-center shadow-xl backdrop-blur-md md:bottom-6"
    >
      <p className="mb-2 text-sm font-extrabold leading-relaxed text-emerald-100">{MESSAGE}</p>
      <button
        type="button"
        onClick={() => void acknowledge()}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
      >
        حسناً
      </button>
    </div>
  );
}
