"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PwaInstallContextValue = {
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}

export function PwaInstallProvider({ children }: Readonly<{ children: ReactNode }>) {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const promptInstall = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setIsInstallable(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* non-fatal: install prompt may still appear in some setups */
      });

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const onAppInstalled = () => {
      deferredRef.current = null;
      setIsInstallable(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const value = useMemo(
    () => ({ isInstallable, promptInstall }),
    [isInstallable, promptInstall],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}
