import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/** Supabase project ref from `https://<ref>.supabase.co` — used to clear auth-token cookies. */
export function supabaseProjectRefFromUrl(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl.trim()).hostname.toLowerCase();
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Remove chunked `sb-<ref>-auth-token` cookies from the outgoing response so a bad refresh
 * token cannot loop forever.
 */
export function clearSupabaseAuthCookiesOnResponse(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string,
): void {
  const ref = supabaseProjectRefFromUrl(supabaseUrl);
  if (!ref) return;
  const prefix = `sb-${ref}-auth-token`;
  for (const { name } of request.cookies.getAll()) {
    if (name === prefix || name.startsWith(`${prefix}.`)) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }
}

const REFRESH_AUTH_ERR_RE =
  /Invalid\s+Refresh\s+Token|Refresh\s+Token\s+Not\s+Found|refresh_token_not_found|JWT\s+expired|invalid\s+jwt/i;

export type UpdateSessionResult = {
  response: NextResponse;
  /** Present when `getUser()` succeeds (JWT validated / session usable). */
  userId: string | null;
  /** Raw auth error from `getUser()`, if any. */
  authErrorMessage: string | null;
};

/**
 * Refreshes the Supabase session and syncs auth cookies on the response.
 * Call from Next.js `proxy` (edge) on every matched request — see `proxy.ts`.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: NextResponse.next({ request }),
      userId: null,
      authErrorMessage: null,
    };
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options as CookieOptions | undefined);
        });
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const msg = authError?.message ?? "";
  if (msg && REFRESH_AUTH_ERR_RE.test(msg)) {
    clearSupabaseAuthCookiesOnResponse(request, supabaseResponse, supabaseUrl);
    return {
      response: supabaseResponse,
      userId: null,
      authErrorMessage: msg,
    };
  }

  return {
    response: supabaseResponse,
    userId: user?.id ?? null,
    authErrorMessage: authError ? msg : null,
  };
}

/** Copy Set-Cookie state from session refresh response onto another NextResponse (e.g. redirect). */
export function copyCookiesToResponse(from: NextResponse, to: NextResponse): void {
  for (const c of from.cookies.getAll()) {
    const { name, value, ...opts } = c;
    if (Object.keys(opts).length > 0) {
      to.cookies.set(name, value, opts as CookieOptions);
    } else {
      to.cookies.set(name, value);
    }
  }
}

/**
 * Read-only Supabase client for edge route guards after `updateSession` — writes any refreshed
 * cookies onto the same `sessionResponse` you will return (or merge into a redirect).
 */
export function createServerClientForRouteGuards(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions | undefined);
        });
      },
    },
  });
}
