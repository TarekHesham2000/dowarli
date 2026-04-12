import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/**
 * Adds points to a broker profile. Verifies the caller is admin using the
 * server-side session (cookies), then updates via service role so a broken
 * browser Supabase client (e.g. invalid refresh token) does not block approval.
 */
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
          /* Route handlers may not always allow set; middleware usually refreshes */
        }
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: userErr?.message },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const p_user_id =
    typeof body === "object" && body !== null && "p_user_id" in body
      ? String((body as { p_user_id: unknown }).p_user_id)
      : "";
  const p_deltaRaw =
    typeof body === "object" && body !== null && "p_delta" in body
      ? Number((body as { p_delta: unknown }).p_delta)
      : NaN;

  if (!p_user_id || !Number.isFinite(p_deltaRaw) || p_deltaRaw === 0) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const p_delta = Math.trunc(p_deltaRaw);

  let svc;
  try {
    svc = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const { data: adminRow, error: adminErr } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr) {
    console.error("[admin/add-points] admin profile", adminErr);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  const role = (adminRow?.role ?? "").toString().trim().toLowerCase();
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: target, error: tgtErr } = await svc
    .from("profiles")
    .select("id, points")
    .eq("id", p_user_id)
    .maybeSingle();

  if (tgtErr) {
    console.error("[admin/add-points] target", tgtErr);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const nextPts = Math.max(0, (target.points ?? 0) + p_delta);
  const { error: upErr } = await svc
    .from("profiles")
    .update({ points: nextPts })
    .eq("id", p_user_id);

  if (upErr) {
    console.error("[admin/add-points] update", upErr);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
