import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminProfile } from "@/lib/isAdmin";
import {
  copyCookiesToResponse,
  createServerClientForRouteGuards,
  updateSession,
} from "@/lib/supabase/middleware";

/**
 * Next.js 16+: edge handler lives in **`proxy.ts`** (not `middleware.ts` — both files cannot coexist).
 * Session refresh uses the same cookie contract as `@supabase/ssr` + `updateSession`.
 *
 * @see https://nextjs.org/docs/app/getting-started/proxy
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function proxy(request: NextRequest) {
  const { response: sessionResponse, userId } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!userId) {
      const login = NextResponse.redirect(new URL("/login", request.url));
      copyCookiesToResponse(sessionResponse, login);
      return login;
    }
    const supabase = createServerClientForRouteGuards(request, sessionResponse);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!isAdminProfile(profile)) {
      const dash = NextResponse.redirect(new URL("/dashboard", request.url));
      copyCookiesToResponse(sessionResponse, dash);
      return dash;
    }
  }

  if (pathname.startsWith("/broker") || pathname.startsWith("/dashboard")) {
    if (!userId) {
      const login = NextResponse.redirect(new URL("/login", request.url));
      copyCookiesToResponse(sessionResponse, login);
      return login;
    }
    const supabase = createServerClientForRouteGuards(request, sessionResponse);
    const { data: brokerProf } = await supabase
      .from("profiles")
      .select("phone, role")
      .eq("id", userId)
      .maybeSingle();
    const phoneMissing =
      !brokerProf?.phone || !String(brokerProf.phone).replace(/\s|-/g, "").trim();
    if (brokerProf?.role !== "admin" && phoneMissing) {
      const u = new URL("/complete-profile", request.url);
      u.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      const complete = NextResponse.redirect(u);
      copyCookiesToResponse(sessionResponse, complete);
      return complete;
    }
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Refresh auth cookies on (almost) all navigations so the browser never keeps a stale
     * refresh token without a matching HttpOnly cookie — excludes static assets only.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
