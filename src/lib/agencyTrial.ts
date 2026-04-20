import type { SupabaseClient } from "@supabase/supabase-js";

/** Full days remaining for UI (ceil). Null if no active trial end date in the future. */
export function trialDaysRemainingUtc(trialExpiresAt: string | null | undefined): number | null {
  if (!trialExpiresAt || !String(trialExpiresAt).trim()) return null;
  const end = Date.parse(trialExpiresAt);
  if (!Number.isFinite(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isProTrialActive(
  subscriptionStatus: string | null | undefined,
  trialExpiresAt: string | null | undefined,
): boolean {
  if (String(subscriptionStatus).toLowerCase() !== "pro") return false;
  const d = trialDaysRemainingUtc(trialExpiresAt);
  return d !== null && d > 0;
}

/**
 * If Pro trial ended, revert to free (and clear trial). Safe if `plan_type` column is missing.
 * @returns true when a row was updated
 */
export async function expireAgencyProTrialIfNeeded(
  client: SupabaseClient,
  agencyId: string,
  row: { subscription_status?: string | null; trial_expires_at?: string | null },
): Promise<boolean> {
  if (String(row.subscription_status).toLowerCase() !== "pro" || !row.trial_expires_at) return false;
  if (new Date(row.trial_expires_at) > new Date()) return false;

  const base = { subscription_status: "free" as const, trial_expires_at: null as null };
  let patch: Record<string, unknown> = { ...base, plan_type: "free" };
  let { error } = await client.from("agencies").update(patch).eq("id", agencyId);
  if (error && /plan_type|column/i.test(String(error.message ?? ""))) {
    patch = { ...base };
    ({ error } = await client.from("agencies").update(patch).eq("id", agencyId));
  }
  return !error;
}
