import { AD_POST_COST_RENT, AD_POST_COST_SALE, type ListingPurpose } from "@/lib/pointsConfig";

export type PlatformSettingsRow = {
  id: number;
  ad_post_cost_sale: number;
  ad_post_cost_rent: number;
  free_listing_limit: number;
  promo_discount_percentage: number;
  sale_mode_enabled: boolean;
  sale_mode_bonus_points_percent: number;
  updated_at?: string;
};

export const PLATFORM_SETTINGS_DEFAULTS: PlatformSettingsRow = {
  id: 1,
  ad_post_cost_sale: AD_POST_COST_SALE,
  ad_post_cost_rent: AD_POST_COST_RENT,
  free_listing_limit: 2,
  promo_discount_percentage: 0,
  sale_mode_enabled: false,
  sale_mode_bonus_points_percent: 0,
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function normalizePlatformSettings(row: Partial<PlatformSettingsRow> | null | undefined): PlatformSettingsRow {
  const d = PLATFORM_SETTINGS_DEFAULTS;
  if (!row) return { ...d };
  return {
    id: 1,
    ad_post_cost_sale: Math.max(0, Math.floor(num(row.ad_post_cost_sale, d.ad_post_cost_sale))),
    ad_post_cost_rent: Math.max(0, Math.floor(num(row.ad_post_cost_rent, d.ad_post_cost_rent))),
    free_listing_limit: Math.max(0, Math.floor(num(row.free_listing_limit, d.free_listing_limit))),
    promo_discount_percentage: Math.min(100, Math.max(0, num(row.promo_discount_percentage, d.promo_discount_percentage))),
    sale_mode_enabled: bool(row.sale_mode_enabled, d.sale_mode_enabled),
    sale_mode_bonus_points_percent: Math.min(500, Math.max(0, num(row.sale_mode_bonus_points_percent, d.sale_mode_bonus_points_percent))),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

/** Point cost after optional sale-mode discount (matches DB handle_admin_approval). */
export function effectiveListingActivationPoints(
  purpose: ListingPurpose,
  settings: PlatformSettingsRow,
): number {
  const base = purpose === "sale" ? settings.ad_post_cost_sale : settings.ad_post_cost_rent;
  if (!settings.sale_mode_enabled || settings.promo_discount_percentage <= 0) return Math.max(0, base);
  const discounted = Math.floor(base * (1 - settings.promo_discount_percentage / 100));
  return Math.max(1, discounted);
}

/** Bonus points when crediting wallet purchases (admin confirms points package). */
export function applySaleModeBonusToPointsDelta(delta: number, settings: PlatformSettingsRow): number {
  if (delta <= 0 || !settings.sale_mode_enabled || settings.sale_mode_bonus_points_percent <= 0) return delta;
  const extra = Math.floor((delta * settings.sale_mode_bonus_points_percent) / 100);
  return delta + extra;
}
