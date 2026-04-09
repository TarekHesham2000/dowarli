import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * OAuth (Google / Facebook) redirect target.
 * Configure in Supabase Dashboard → Authentication → URL Configuration:
 * Redirect URLs: `${SITE_URL}/auth/callback`
 */
function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.given_name === "string" &&
      `${meta.given_name} ${typeof meta.family_name === "string" ? meta.family_name : ""}`.trim()) ||
    "";
  if (full) return full;
  return user.email?.split("@")[0]?.trim() || "مالك";
}

/** جوجل: avatar_url / picture نصي — فيسبوك: picture كائن { data: { url } } أو نص */
function avatarUrlFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown>;
  const a = meta.avatar_url;
  if (typeof a === "string" && a.startsWith("http")) return a;
  const p = meta.picture;
  if (typeof p === "string" && p.startsWith("http")) return p;
  if (p && typeof p === "object" && p !== null && "data" in p) {
    const url = (p as { data?: { url?: string } }).data?.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

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

  let response = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  const name = displayNameFromUser(user);
  const avatarUrl = avatarUrlFromUser(user);
  const email = user.email?.trim().toLowerCase() ?? null;

  try {
    const admin = getSupabaseServerClient();
    const { data: row } = await admin
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!row) {
      const insertPayload: Record<string, unknown> = {
        id: user.id,
        name,
        phone: null,
        role: "broker",
        wallet_balance: 0,
      };
      if (email) insertPayload.email = email;
      if (avatarUrl) insertPayload.avatar_url = avatarUrl;

      const { error: insertError } = await admin.from("profiles").insert(insertPayload);
      if (insertError && insertError.code !== "23505") {
        console.error("[auth/callback] profile insert:", insertError.message);
      }
    } else {
      const patch: Record<string, unknown> = {};
      const rowName = typeof row.name === "string" ? row.name.trim() : "";
      if (name && (!rowName || rowName === "مالك")) patch.name = name;
      if (email && !row.email) patch.email = email;
      if (avatarUrl && !row.avatar_url) patch.avatar_url = avatarUrl;
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await admin.from("profiles").update(patch).eq("id", user.id);
        if (upErr) console.error("[auth/callback] profile update:", upErr.message);
      }
    }
  } catch (e) {
    console.error("[auth/callback] ensure profile:", e);
  }

  return response;
}
