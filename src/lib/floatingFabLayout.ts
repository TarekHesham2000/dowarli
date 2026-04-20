/**
 * Shared layout for fixed FABs (AI chat + WhatsApp) so they stack vertically
 * with safe-area insets and consistent z-ordering.
 */
export const FLOATING_FAB_SIZE = "3.5rem" as const; // Tailwind h-14 / w-14
export const FLOATING_FAB_GAP = "1rem" as const;

/** AI chat launcher — closest to the bottom edge (thumb reach). */
export const FLOATING_CHAT_FAB_BOTTOM = `calc(1.25rem + env(safe-area-inset-bottom, 0px))` as const;

/**
 * WhatsApp / secondary FAB — stacked above the chat FAB with a 1rem gap.
 * (~80px+ from bottom on typical phones before safe-area.)
 */
export const FLOATING_WHATSAPP_FAB_BOTTOM =
  `calc(1.25rem + ${FLOATING_FAB_SIZE} + ${FLOATING_FAB_GAP} + env(safe-area-inset-bottom, 0px))` as const;

/** Desktop chat sheet: anchor above the stacked FAB column. */
export const FLOATING_CHAT_PANEL_SM_BOTTOM =
  `calc(1.25rem + ${FLOATING_FAB_SIZE} + 0.75rem + env(safe-area-inset-bottom, 0px))` as const;

/** Secondary FAB (WhatsApp) — below chat FAB so AI stays fully interactive. */
export const Z_INDEX_FLOATING_WHATSAPP = 9985;
