/** Local Egyptian mobile without country code (11 digits). */
export const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)\d{8}$/;

export function toE164Egypt(localDigits: string): string {
  const c = localDigits.replace(/\s|-/g, "");
  if (c.startsWith("+20")) return c;
  if (c.startsWith("0") && c.length === 11) return `+20${c.slice(1)}`;
  return `+20${c}`;
}

export function validateEgyptianPhone(phone: string): string | null {
  const cleaned = phone.replace(/\s|-/g, "");
  if (!cleaned) return "أدخل رقم الموبايل";
  if (!EGYPTIAN_PHONE_REGEX.test(cleaned)) {
    return "رقم غير صالح — استخدم 010/011/012/015 متبوعًا بـ 8 أرقام";
  }
  return null;
}
