import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureBrokerProfileForUser } from "@/lib/authProfile";
import { syncAuthPhoneFromProfileForUserId } from "@/lib/syncAuthPhone";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/** Must match `OwnerBrokerAuth` — short-lived cookie set before `signInWithOAuth`. */
const OAUTH_USER_TYPE_COOKIE = "dowarli_oauth_user_type";

function parseOauthUserTypeParam(raw: string | null | undefined): "broker" | "owner" | null {
  if (raw === "owner" || raw === "broker") return raw;
  return null;
}

function redirectWithClearedOauthCookie(origin: string, pathnameAndQuery: string) {
  const res = NextResponse.redirect(new URL(pathnameAndQuery, origin));
  res.cookies.set(OAUTH_USER_TYPE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/**
 * OAuth (Google) redirect target.
 * Configure in Supabase Dashboard → Authentication → URL Configuration:
 * Redirect URLs: `${SITE_URL}/auth/callback`
 * Keep the Facebook provider disabled under Authentication → Providers so it cannot be used outside this UI.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const origin = requestUrl.origin;
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!code) {
    return redirectWithClearedOauthCookie(origin, "/login?error=oauth");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectWithClearedOauthCookie(origin, "/login?error=config");
  }

  type CookieSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };
  const pendingCookies: CookieSet[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectWithClearedOauthCookie(origin, "/login?error=oauth_exchange");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectWithClearedOauthCookie(origin, "/login?error=no_user");
  }

  try {
    await ensureBrokerProfileForUser(user);
    await syncAuthPhoneFromProfileForUserId(user.id);
  } catch (e) {
    console.error("[auth/callback] ensure profile:", e);
  }

  const userTypeFromCookie = parseOauthUserTypeParam(request.cookies.get(OAUTH_USER_TYPE_COOKIE)?.value);
  const userTypeFromQuery = parseOauthUserTypeParam(requestUrl.searchParams.get("user_type"));
  const oauthUserType = userTypeFromCookie ?? userTypeFromQuery;
  if (oauthUserType) {
    const { error: metaErr } = await supabase.auth.updateUser({ data: { user_type: oauthUserType } });
    if (metaErr) {
      console.error("[auth/callback] user_metadata user_type:", metaErr.message);
    }
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("phone, role")
    .eq("id", user.id)
    .maybeSingle();

  const profilePhoneMissing =
    !prof?.phone || !String(prof.phone).replace(/\s|-/g, "").trim();
  const needPhone = prof?.role !== "admin" && profilePhoneMissing;

  const redirectPath = needPhone
    ? `/complete-profile?next=${encodeURIComponent(safeNext)}`
    : safeNext;

  const response = NextResponse.redirect(new URL(redirectPath, origin));
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  response.cookies.set(OAUTH_USER_TYPE_COOKIE, "", { path: "/", maxAge: 0 });

  return response;
}
