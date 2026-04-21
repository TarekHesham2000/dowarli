/**
 * Shared layout for fixed FABs (AI chat + WhatsApp) so they stack vertically
 * with safe-area insets and consistent z-ordering.
 */
export const FLOATING_FAB_SIZE = "3.5rem" as const; // Tailwind h-14 / w-14
export const FLOATING_FAB_GAP = "1rem" as const;

/** Same breakpoint as `ChatBot` — FABs lift above the home mobile tab bar. */
export const FLOATING_FAB_MOBILE_MAX_WIDTH_PX = 768 as const;

/** Home mobile bottom tab bar (icons + padding), excluding device safe-area. */
export const MOBILE_BOTTOM_NAV_RESERVE = "4.5rem" as const;

/** Gap above the nav so FABs do not cover “الرئيسية / بحث” labels (~22px). */
const MOBILE_FAB_NAV_CLEARANCE = "1.375rem" as const;

/** AI chat launcher — desktop: close to corner. */
export const FLOATING_CHAT_FAB_BOTTOM = `calc(1.25rem + env(safe-area-inset-bottom, 0px))` as const;

/**
 * AI chat launcher — narrow viewports: ~5.9rem (~94px) + safe-area from the
 * bottom edge so it clears the fixed bottom nav.
 */
export const FLOATING_CHAT_FAB_BOTTOM_MOBILE =
  `calc(${MOBILE_BOTTOM_NAV_RESERVE} + ${MOBILE_FAB_NAV_CLEARANCE} + env(safe-area-inset-bottom, 0px))` as const;

/**
 * WhatsApp / secondary FAB — desktop: stacked above the chat FAB with a 1rem gap.
 * (~80px+ from bottom on typical phones before safe-area.)
 */
export const FLOATING_WHATSAPP_FAB_BOTTOM =
  `calc(1.25rem + ${FLOATING_FAB_SIZE} + ${FLOATING_FAB_GAP} + env(safe-area-inset-bottom, 0px))` as const;

/**
 * WhatsApp — mobile: stays on the left; bottom offset stacks it above the chat
 * FAB (which sits on the right) so the two columns do not collide vertically.
 */
export const FLOATING_WHATSAPP_FAB_BOTTOM_MOBILE =
  `calc(${MOBILE_BOTTOM_NAV_RESERVE} + ${MOBILE_FAB_NAV_CLEARANCE} + ${FLOATING_FAB_SIZE} + ${FLOATING_FAB_GAP} + env(safe-area-inset-bottom, 0px))` as const;

/** Desktop chat sheet: anchor above the stacked FAB column. */
export const FLOATING_CHAT_PANEL_SM_BOTTOM =
  `calc(1.25rem + ${FLOATING_FAB_SIZE} + 0.75rem + env(safe-area-inset-bottom, 0px))` as const;

/**
 * z-index stack (high enough to sit above sticky headers ~200, below nothing critical):
 * bottom nav < FABs < mobile chat backdrop < chat panel.
 */
export const Z_INDEX_MOBILE_BOTTOM_NAV = 10000;

export const Z_INDEX_FLOATING_CHAT = 10020;

export const Z_INDEX_FLOATING_WHATSAPP = 10025;

export const Z_INDEX_CHAT_BACKDROP_MOBILE = 10030;

export const Z_INDEX_CHAT_PANEL = 10035;
