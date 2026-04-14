/** Matches `public.agency_subscription_status` enum */
export type AgencySubscriptionStatus = "free" | "pro" | "expired";

export const AGENCY_CHAT_FREE_TIER_MESSAGE =
  "عذراً، هذه الميزة متاحة فقط للوكلاء المعتمدين.";

export function isAgencyChatPaywalled(
  agencyId: string | null | undefined,
  subscriptionStatus: AgencySubscriptionStatus | null | undefined,
): boolean {
  return Boolean(agencyId?.trim() && subscriptionStatus === "free");
}
