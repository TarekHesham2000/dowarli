"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const REFRESH_FAIL_RE =
  /Invalid\s+Refresh\s+Token|Refresh\s+Token\s+Not\s+Found|refresh_token_not_found|JWT\s+expired|invalid\s+jwt/i;

function clearSupabaseBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      const lower = k.toLowerCase();
      if (lower.includes("supabase") || lower.startsWith("sb-")) drop.push(k);
    }
    drop.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* private mode / blocked storage */
  }
}

function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/signup")
  );
}

function hardRedirectToLogin(): void {
  window.location.assign("/login?reason=session");
}

/**
 * Clears broken client session state and redirects to `/login` when refresh fails,
 * avoiding infinite 400 loops from a stale refresh token.
 */
export function SupabaseAuthRecovery() {
  const pathname = usePathname() ?? "";
  const redirectedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const { error } = await supabase.auth.getSession();
      const msg = error?.message ?? "";
      if (msg && REFRESH_FAIL_RE.test(msg) && !redirectedRef.current && !isAuthPublicPath(pathname)) {
        redirectedRef.current = true;
        clearSupabaseBrowserStorage();
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        hardRedirectToLogin();
      }
    })();
  }, [pathname]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if ((event as string) === "TOKEN_REFRESH_FAILED") {
        if (redirectedRef.current || isAuthPublicPath(pathname)) return;
        redirectedRef.current = true;
        clearSupabaseBrowserStorage();
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        hardRedirectToLogin();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname]);

  return null;
}
