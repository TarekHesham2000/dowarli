"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePwaInstall } from "@/contexts/PwaInstallProvider";

const DISMISS_KEY = "dowarli-pwa-install-banner-dismissed";

const listeners = new Set<() => void>();

function subscribeDismissed(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getDismissedFromStorage(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function notifyDismissedChanged() {
  listeners.forEach((l) => l());
}

export function PwaMobileInstallBanner() {
  const { isInstallable, promptInstall } = usePwaInstall();
  const [isMobile, setIsMobile] = useState(false);

  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    getDismissedFromStorage,
    () => false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    notifyDismissedChanged();
  }, []);

  if (!isMobile || !isInstallable || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="تثبيت التطبيق"
      className="fixed left-0 right-0 top-0 z-[200] flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 shadow-lg"
      style={{
        background: "linear-gradient(90deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)",
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
      }}
    >
      <p
        dir="ltr"
        className="min-w-0 flex-1 text-left text-[13px] leading-snug text-slate-100"
      >
        Install <span className="font-bold text-white">Dowarli</span> for a better experience
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #fb923c 0%, #f97316 42%, #ea580c 100%)",
            boxShadow: "0 2px 14px rgba(234, 88, 12, 0.45)",
          }}
        >
          تثبيت
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
