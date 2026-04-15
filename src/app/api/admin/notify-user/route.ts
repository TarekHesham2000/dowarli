import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";

type Body = { user_id?: string; title?: string; body?: string };

export async function POST(request: Request) {
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
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!targetId || !title || !text) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
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

  const { data: target, error: tgtErr } = await svc.from("profiles").select("id").eq("id", targetId).maybeSingle();
  if (tgtErr || !target) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const { error: insErr } = await svc.from("user_system_notifications").insert({
    user_id: targetId,
    title,
    body: text,
  });

  if (insErr) {
    console.error("[admin/notify-user]", insErr);
    return NextResponse.json({ ok: false, error: "insert_failed", message: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
