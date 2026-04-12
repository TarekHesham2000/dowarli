import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureBrokerProfileForUser } from "@/lib/authProfile";
import { syncAuthPhoneFromProfileForUserId } from "@/lib/syncAuthPhone";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/**
 * Syncs auth.users session → public.profiles (create, patch, or link legacy row by email).
 * Uses SUPABASE_SERVICE_ROLE_KEY via getSupabaseServerClient() — not the anon key.
 * Call after password or OAuth sign-in while cookies hold the session.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anon, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await ensureBrokerProfileForUser(user);
    await syncAuthPhoneFromProfileForUserId(user.id);
  } catch (e) {
    console.error("[ensure-profile]", e);
    return NextResponse.json({ ok: false, error: "ensure_failed" }, { status: 500 });
  }

  return response;
}
