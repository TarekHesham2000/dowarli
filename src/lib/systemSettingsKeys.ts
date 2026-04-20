/** Keys in `public.system_settings` (key/value store). */
export const SYSTEM_SETTINGS_KEYS = {
  wallet_phone: "wallet_phone",
  instapay_id: "instapay_id",
  ad_duration_days: "ad_duration_days",
} as const;

/** @deprecated use SYSTEM_SETTINGS_KEYS */
export const PAYMENT_SETTING_KEYS = {
  wallet_phone: SYSTEM_SETTINGS_KEYS.wallet_phone,
  instapay_id: SYSTEM_SETTINGS_KEYS.instapay_id,
} as const;
