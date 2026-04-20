import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { SYSTEM_SETTINGS_KEYS } from "@/lib/systemSettingsKeys";

function parseAdDurationDays(raw: string | undefined): number {
  const n = parseInt(String(raw ?? "").replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 3650) return n;
  return 30;
}

/** Public read: wallet, InstaPay, ad duration (no auth). */
export async function GET() {
  const envWallet = process.env.NEXT_PUBLIC_DOWARLI_WALLET_PHONE?.trim() || "";
  let wallet_phone = envWallet;
  let instapay_id = "";
  let ad_duration_days = 30;

  try {
    const svc = getSupabaseServerClient();
    const { data, error } = await svc
      .from("system_settings")
      .select("key, value")
      .in("key", [
        SYSTEM_SETTINGS_KEYS.wallet_phone,
        SYSTEM_SETTINGS_KEYS.instapay_id,
        SYSTEM_SETTINGS_KEYS.ad_duration_days,
      ]);

    if (!error && data?.length) {
      for (const row of data) {
        const k = String((row as { key?: string }).key ?? "");
        const v = String((row as { value?: string }).value ?? "").trim();
        if (k === SYSTEM_SETTINGS_KEYS.wallet_phone && v) wallet_phone = v;
        if (k === SYSTEM_SETTINGS_KEYS.instapay_id) instapay_id = v;
        if (k === SYSTEM_SETTINGS_KEYS.ad_duration_days) {
          ad_duration_days = parseAdDurationDays(v);
        }
      }
    }
  } catch {
    /* missing service env, table, or RLS */
  }

  if (!wallet_phone) {
    wallet_phone = "01000000000";
  }

  return NextResponse.json({ wallet_phone, instapay_id, ad_duration_days });
}
