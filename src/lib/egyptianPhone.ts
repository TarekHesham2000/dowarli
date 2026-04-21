/**
 * Egyptian mobile validation (local 01x — Vodafone / Etisalat / Orange / WE).
 * Accepts optional +20 / 20 prefix and spacing; normalizes to 11-digit local form.
 */

/** Strict local mobile (11 digits, 010/011/012/015). */
export const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)\d{8}$/

export const EGYPTIAN_MOBILE_HINT_AR =
  "يجب أن يبدأ الرقم بـ 010 أو 011 أو 012 أو 015 ويتكوّن من 11 رقماً (أو +20 مع نفس المجموعة)."

/** Strip spaces/dashes. */
export function stripPhoneInput(input: string): string {
  return input.replace(/\s|-/g, "").trim()
}

/**
 * Returns canonical local form `01xxxxxxxxx` or `null` if invalid.
 */
export function toLocalEgyptianMobile(input: string): string | null {
  let d = stripPhoneInput(input).replace(/\D/g, "")
  if (d.startsWith("20") && d.length >= 12) d = "0" + d.slice(2)
  if (d.length === 10 && d.startsWith("1")) d = "0" + d
  if (EGYPTIAN_PHONE_REGEX.test(d)) return d
  return null
}

export function isValidEgyptianMobileInput(input: string): boolean {
  return toLocalEgyptianMobile(input) !== null
}

/** E.164 for Supabase Auth (`+20…` without leading zero). */
export function toE164Egypt(localOrInput: string): string {
  const local = toLocalEgyptianMobile(localOrInput)
  if (local) return `+20${local.slice(1)}`
  const d = stripPhoneInput(localOrInput).replace(/\D/g, "")
  if (d.startsWith("20")) return `+${d}`
  if (d.startsWith("0")) return `+20${d.slice(1)}`
  return `+20${d}`
}

/** `null` = valid; otherwise Arabic error message. */
export function validateEgyptianPhone(input: string): string | null {
  if (!stripPhoneInput(input)) return "أدخل رقم الهاتف"
  if (toLocalEgyptianMobile(input)) return null
  return `رقم الهاتف غير صحيح. ${EGYPTIAN_MOBILE_HINT_AR}`
}
