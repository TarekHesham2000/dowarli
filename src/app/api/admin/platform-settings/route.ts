import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import {
  normalizePlatformSettings,
  PLATFORM_SETTINGS_DEFAULTS,
  type PlatformSettingsRow,
} from "@/lib/platformSettings";

type PatchBody = Partial<
  Pick<
    PlatformSettingsRow,
    | "ad_post_cost_sale"
    | "ad_post_cost_rent"
    | "free_listing_limit"
    | "promo_discount_percentage"
    | "sale_mode_enabled"
    | "sale_mode_bonus_points_percent"
  >
>;

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

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
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

  const { data: cur } = await svc.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  const base = normalizePlatformSettings(cur as PlatformSettingsRow | null);

  const merged: PlatformSettingsRow = {
    ...base,
    ...(typeof body.ad_post_cost_sale === "number" ? { ad_post_cost_sale: body.ad_post_cost_sale } : {}),
    ...(typeof body.ad_post_cost_rent === "number" ? { ad_post_cost_rent: body.ad_post_cost_rent } : {}),
    ...(typeof body.free_listing_limit === "number" ? { free_listing_limit: body.free_listing_limit } : {}),
    ...(typeof body.promo_discount_percentage === "number"
      ? { promo_discount_percentage: body.promo_discount_percentage }
      : {}),
    ...(typeof body.sale_mode_enabled === "boolean" ? { sale_mode_enabled: body.sale_mode_enabled } : {}),
    ...(typeof body.sale_mode_bonus_points_percent === "number"
      ? { sale_mode_bonus_points_percent: body.sale_mode_bonus_points_percent }
      : {}),
  };

  const row = {
    id: 1,
    ad_post_cost_sale: merged.ad_post_cost_sale,
    ad_post_cost_rent: merged.ad_post_cost_rent,
    free_listing_limit: merged.free_listing_limit,
    promo_discount_percentage: merged.promo_discount_percentage,
    sale_mode_enabled: merged.sale_mode_enabled,
    sale_mode_bonus_points_percent: merged.sale_mode_bonus_points_percent,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: upErr } = await svc
    .from("platform_settings")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (upErr) {
    console.error("[admin/platform-settings]", upErr);
    return NextResponse.json({ ok: false, error: "update_failed", message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    settings: normalizePlatformSettings((updated as PlatformSettingsRow) ?? PLATFORM_SETTINGS_DEFAULTS),
  });
}
