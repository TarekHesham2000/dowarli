import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureBrokerProfileForUser } from "@/lib/authProfile";
import { syncAuthPhoneFromProfileForUserId } from "@/lib/syncAuthPhone";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  provisionOAuthSignupAgencyIfBroker,
  shouldApplyGoogleSignupProvisioning,
  type OAuthSignupUserType,
} from "@/lib/oauthSignupProvision";

/** Must match `OwnerBrokerAuth` — short-lived cookies set before `signInWithOAuth`. */
const OAUTH_USER_TYPE_COOKIE = "dowarli_oauth_user_type";
const OAUTH_IS_SIGNUP_COOKIE = "dowarli_oauth_is_signup";

function parseOauthUserTypeParam(raw: string | null | undefined): OAuthSignupUserType | null {
  if (raw === "owner" || raw === "broker") return raw;
  return null;
}

function readIsSignupIntent(request: NextRequest, requestUrl: URL): boolean {
  if (requestUrl.searchParams.get("isSignup") === "true") return true;
  if (request.cookies.get(OAUTH_IS_SIGNUP_COOKIE)?.value === "true") return true;
  return false;
}

function redirectClearedOAuth(origin: string, pathnameAndQuery: string) {
  const res = NextResponse.redirect(new URL(pathnameAndQuery, origin));
  res.cookies.set(OAUTH_USER_TYPE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OAUTH_IS_SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });
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
  const isSignupIntent = readIsSignupIntent(request, requestUrl);
  const signupFail = (suffix: string) => redirectClearedOAuth(origin, `/signup?error=${suffix}`);

  if (!code) {
    return isSignupIntent ? signupFail("oauth") : redirectClearedOAuth(origin, "/login?error=oauth");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return isSignupIntent ? signupFail("config") : redirectClearedOAuth(origin, "/login?error=config");
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
    return isSignupIntent ? signupFail("oauth_exchange") : redirectClearedOAuth(origin, "/login?error=oauth_exchange");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return isSignupIntent ? signupFail("no_user") : redirectClearedOAuth(origin, "/login?error=no_user");
  }

  const applySignupProvisioning = shouldApplyGoogleSignupProvisioning(isSignupIntent, user);

  const userTypeFromCookie = parseOauthUserTypeParam(request.cookies.get(OAUTH_USER_TYPE_COOKIE)?.value);
  const userTypeFromQuery = parseOauthUserTypeParam(requestUrl.searchParams.get("user_type"));
  const oauthUserType: OAuthSignupUserType | null = userTypeFromCookie ?? userTypeFromQuery;

  try {
    await ensureBrokerProfileForUser(user);
  } catch (e) {
    console.error("[auth/callback] ensure profile:", e);
    if (applySignupProvisioning) {
      return signupFail("database_error");
    }
  }

  if (applySignupProvisioning) {
    let svc: ReturnType<typeof getSupabaseServerClient>;
    try {
      svc = getSupabaseServerClient();
    } catch (e) {
      console.error("[auth/callback] service client:", e);
      return signupFail("database_error");
    }

    const { data: profCheck, error: profCheckErr } = await svc
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profCheckErr || !profCheck?.id) {
      return signupFail("database_error");
    }

    const effectiveType: OAuthSignupUserType = oauthUserType ?? "broker";
    const provisioned = await provisionOAuthSignupAgencyIfBroker(svc, user, effectiveType);
    if (!provisioned.ok) {
      console.error("[auth/callback] signup provision:", provisioned.reason);
      return signupFail("database_error");
    }
  }

  try {
    await syncAuthPhoneFromProfileForUserId(user.id);
  } catch (e) {
    console.error("[auth/callback] sync phone:", e);
  }

  if (oauthUserType && (!isSignupIntent || applySignupProvisioning)) {
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
  response.cookies.set(OAUTH_IS_SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });

  return response;
}
