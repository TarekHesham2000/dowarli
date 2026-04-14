/** Arabic-Indic (U+0660–U+0669) + Persian digits (U+06F0–U+06F9) → ASCII digits */
const DIGIT_TRANSLATE_FROM =
  "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669" +
  "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
const DIGIT_TRANSLATE_TO = "01234567890123456789";

function normalizeDigitsToAscii(s: string): string {
  let out = "";
  for (const ch of s) {
    const i = DIGIT_TRANSLATE_FROM.indexOf(ch);
    out += i >= 0 ? DIGIT_TRANSLATE_TO.charAt(i) : ch;
  }
  return out;
}

/** Eleven consecutive digits (Egyptian mobile length) after digit normalization. */
const ELEVEN_DIGITS = /\d{11}/;

export const BLOCK_PHONE_IN_LISTING_MESSAGE =
  "ممنوع وضع أرقام تليفونات لضمان تسجيل بيانات العميل في الـ CRM الخاص بك.";

export function listingTextContainsPhoneSequence(title: string, description: string): boolean {
  const blob = normalizeDigitsToAscii(`${title}\n${description}`);
  return ELEVEN_DIGITS.test(blob);
}
