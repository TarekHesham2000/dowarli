/**
 * Arabic → Latin (approx.) for URL-safe agency slugs.
 * NFKC is applied first so ligatures / presentation forms map to base letters.
 */
const ARABIC_TO_LATIN: Readonly<Record<string, string>> = {
  "\u0621": "",
  "\u0622": "aa",
  "\u0623": "a",
  "\u0624": "w",
  "\u0625": "i",
  "\u0626": "y",
  "\u0627": "a",
  "\u0628": "b",
  "\u0629": "h",
  "\u062a": "t",
  "\u062b": "th",
  "\u062c": "j",
  "\u062d": "h",
  "\u062e": "kh",
  "\u062f": "d",
  "\u0630": "dh",
  "\u0631": "r",
  "\u0632": "z",
  "\u0633": "s",
  "\u0634": "sh",
  "\u0635": "s",
  "\u0636": "d",
  "\u0637": "t",
  "\u0638": "z",
  "\u0639": "a",
  "\u063a": "gh",
  "\u0641": "f",
  "\u0642": "q",
  "\u0643": "k",
  "\u0644": "l",
  "\u0645": "m",
  "\u0646": "n",
  "\u0647": "h",
  "\u0648": "w",
  "\u0649": "a",
  "\u064a": "y",
  "\u0640": "",
  "\u0671": "a",
  "\u067e": "p",
  "\u0686": "ch",
  "\u0698": "zh",
  "\u06a9": "k",
  "\u06af": "g",
  "\u06cc": "y",
  "\u06c0": "h",
};

function transliterateArabicToLatin(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFKC")) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x0660 && cp <= 0x0669) {
      out += String.fromCodePoint(cp - 0x0660 + 0x0030);
      continue;
    }
    const mapped = ARABIC_TO_LATIN[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Slug for new agencies: lowercase English letters, digits, single hyphens between segments. */
export function isValidAgencySlugAscii(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (s.length < 2 || s.length > 120) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

/** Suggest an ASCII slug from a name (Arabic is transliterated; then Latin slugify). */
export function suggestedAgencySlugAsciiFromName(name: string): string {
  const translit = transliterateArabicToLatin(name.trim());
  const t = translit
    .replace(/[\u064B-\u065F\u0670\u0610-\u061A]/g, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (t.length >= 2) return t.slice(0, 80);
  return `agency-${Math.random().toString(36).slice(2, 8)}`;
}

/** URL-safe slug segment for agencies (Arabic + Latin + digits + hyphen). */
export function suggestedAgencySlugFromName(name: string): string {
  const t = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = t.slice(0, 80);
  return base.length > 0 ? base : "agency";
}

export function isValidAgencySlug(slug: string): boolean {
  const s = slug.trim();
  if (s.length < 2 || s.length > 120) return false;
  return /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(s);
}
