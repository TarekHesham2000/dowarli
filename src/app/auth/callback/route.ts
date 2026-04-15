import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureBrokerProfileForUser } from "@/lib/authProfile";
import { syncAuthPhoneFromProfileForUserId } from "@/lib/syncAuthPhone";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

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
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?error=config`);
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
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  try {
    await ensureBrokerProfileForUser(user);
    await syncAuthPhoneFromProfileForUserId(user.id);
  } catch (e) {
    console.error("[auth/callback] ensure profile:", e);
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

  return response;
}
