import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";

/**
 * After admin approves a listing, invokes the Edge Function that matches
 * `saved_searches` and creates notifications (and optional Resend emails).
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const property_id =
    typeof body === "object" && body !== null && "property_id" in body
      ? Number((body as { property_id: unknown }).property_id)
      : NaN;

  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

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
    console.error("[trigger-property-alerts] admin profile", adminErr);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  const role = (adminRow?.role ?? "").toString().trim().toLowerCase();
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data, error: fnErr } = await svc.functions.invoke("property-approved-alerts", {
    body: { property_id },
  });

  if (fnErr) {
    console.error("[trigger-property-alerts] invoke", fnErr.message);
    return NextResponse.json(
      { ok: false, error: "function_invoke_failed", detail: fnErr.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, result: data ?? null });
}
