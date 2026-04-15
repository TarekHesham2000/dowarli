import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { normalizePlatformSettings, PLATFORM_SETTINGS_DEFAULTS } from "@/lib/platformSettings";

/** Public read of singleton platform settings (costs / promos) for UI. */
export async function GET() {
  try {
    const svc = getSupabaseServerClient();
    const { data, error } = await svc.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error) {
      console.error("[platform-settings]", error);
      return NextResponse.json({ settings: PLATFORM_SETTINGS_DEFAULTS });
    }
    return NextResponse.json({ settings: normalizePlatformSettings(data as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ settings: PLATFORM_SETTINGS_DEFAULTS });
  }
}
