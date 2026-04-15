import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";

type Body = { user_id?: string; role?: string };

/**
 * Sets `profiles.role` for a user (e.g. broker vs end-user). Does not grant `admin` from the client.
 */
export async function PATCH(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* ignore */
        }
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const targetId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const nextRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
  if (!targetId || !nextRole) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  if (nextRole === "admin") {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  if (!["user", "broker"].includes(nextRole)) {
    return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  }

  let svc: ReturnType<typeof getSupabaseServerClient>;
  try {
    svc = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const { data: actor, error: actorErr } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (actorErr || !isAdminProfile(actor)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (targetId === user.id) {
    return NextResponse.json({ ok: false, error: "cannot_change_self" }, { status: 400 });
  }

  const { error: upErr } = await svc.from("profiles").update({ role: nextRole }).eq("id", targetId);
  if (upErr) {
    console.error("[admin/user-role]", upErr);
    return NextResponse.json({ ok: false, error: "update_failed", message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
