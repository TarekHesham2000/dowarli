import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import { SYSTEM_SETTINGS_KEYS } from "@/lib/systemSettingsKeys";

type Body = { wallet_phone?: string; instapay_id?: string; ad_duration_days?: number | string };

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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
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

  let svc: ReturnType<typeof getSupabaseServerClient>;
  try {
    svc = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const { data: actor, error: actorErr } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actorErr || !isAdminProfile(actor)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const rows: { key: string; value: string; updated_at: string }[] = [];

  if (typeof body.wallet_phone === "string") {
    rows.push({ key: SYSTEM_SETTINGS_KEYS.wallet_phone, value: body.wallet_phone.trim(), updated_at: now });
  }
  if (typeof body.instapay_id === "string") {
    rows.push({ key: SYSTEM_SETTINGS_KEYS.instapay_id, value: body.instapay_id.trim(), updated_at: now });
  }
  if (body.ad_duration_days !== undefined && body.ad_duration_days !== null) {
    const n = parseInt(String(body.ad_duration_days).replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 3650) {
      rows.push({
        key: SYSTEM_SETTINGS_KEYS.ad_duration_days,
        value: String(n),
        updated_at: now,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields" }, { status: 400 });
  }

  const { error: upErr } = await svc.from("system_settings").upsert(rows, { onConflict: "key" });
  if (upErr) {
    console.error("[admin/payment-settings]", upErr);
    return NextResponse.json(
      { ok: false, error: "update_failed", message: upErr.message },
      { status: 500 },
    );
  }

  const { data: fresh } = await svc
    .from("system_settings")
    .select("key, value")
    .in("key", [
      SYSTEM_SETTINGS_KEYS.wallet_phone,
      SYSTEM_SETTINGS_KEYS.instapay_id,
      SYSTEM_SETTINGS_KEYS.ad_duration_days,
    ]);

  const envWallet = process.env.NEXT_PUBLIC_DOWARLI_WALLET_PHONE?.trim() || "";
  let wallet_phone = envWallet;
  let instapay_id = "";
  let ad_duration_days = 30;
  for (const row of fresh ?? []) {
    const k = String((row as { key?: string }).key ?? "");
    const v = String((row as { value?: string }).value ?? "").trim();
    if (k === SYSTEM_SETTINGS_KEYS.wallet_phone && v) wallet_phone = v;
    if (k === SYSTEM_SETTINGS_KEYS.instapay_id) instapay_id = v;
    if (k === SYSTEM_SETTINGS_KEYS.ad_duration_days && v) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 1) ad_duration_days = Math.min(3650, n);
    }
  }
  if (!wallet_phone) wallet_phone = "01000000000";

  return NextResponse.json({ ok: true, wallet_phone, instapay_id, ad_duration_days });
}
