import type { CSSProperties } from "react";

/** Canonical primary colors (stored in `agencies.theme_color`). */
export const AGENCY_THEME_DEFAULT = "#00d38d" as const;

export const AGENCY_THEME_PRESETS = [
  {
    key: "gold",
    labelAr: "ذهبي فاخر",
    labelEn: "Gold Premium",
    color: "#D4AF37" as const,
  },
  {
    key: "royal",
    labelAr: "أزرق ملكي",
    labelEn: "Royal Blue",
    color: "#1E3A8A" as const,
  },
  {
    key: "emerald",
    labelAr: "زمردي عصري",
    labelEn: "Modern Emerald",
    color: "#10B981" as const,
  },
  {
    key: "classic",
    labelAr: "كلاسيكي (دَورلي)",
    labelEn: "Classic Dark",
    color: "#00d38d" as const,
  },
] as const;

export type AgencyThemePreset = (typeof AGENCY_THEME_PRESETS)[number];

const ALLOWED = new Map(
  AGENCY_THEME_PRESETS.map((p) => [p.color.toLowerCase(), p.color] as const),
);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Clamp stored value to one of the four presets (defensive). */
export function normalizeAgencyThemeColor(input: string | null | undefined): string {
  const t = (input ?? "").trim().toLowerCase();
  if (!t) return AGENCY_THEME_DEFAULT;
  return ALLOWED.get(t) ?? AGENCY_THEME_DEFAULT;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(normalizeAgencyThemeColor(hex));
  if (!rgb) return 0.5;
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text/icon color on top of primary buttons. */
export function agencyOnPrimaryColor(hex: string): string {
  return relativeLuminance(hex) < 0.42 ? "#f8fafc" : "#05261a";
}

/**
 * CSS variables for `/agency/[slug]` — scoped by wrapping a subtree with this style.
 */
export function agencyLandingThemeStyle(hex: string): CSSProperties {
  const primary = normalizeAgencyThemeColor(hex);
  const rgb = hexToRgb(primary);
  const on = agencyOnPrimaryColor(primary);
  if (!rgb) {
    return {
      ["--agency-primary" as string]: AGENCY_THEME_DEFAULT,
      ["--agency-on-primary" as string]: "#05261a",
    };
  }
  const { r, g, b } = rgb;
  return {
    ["--agency-primary" as string]: primary,
    ["--agency-on-primary" as string]: on,
    ["--agency-primary-rgb" as string]: `${r}, ${g}, ${b}`,
    ["--agency-primary-a10" as string]: `rgba(${r},${g},${b},0.1)`,
    ["--agency-primary-a14" as string]: `rgba(${r},${g},${b},0.14)`,
    ["--agency-primary-a35" as string]: `rgba(${r},${g},${b},0.35)`,
    ["--agency-primary-shadow" as string]: `0 10px 26px -12px rgba(${r},${g},${b},0.55)`,
    ["--agency-primary-shadow-lg" as string]: `0 20px 40px -20px rgba(${r},${g},${b},0.55)`,
    ["--agency-primary-fab-ring" as string]: `0 16px 40px -12px rgba(${r},${g},${b},0.55), 0 0 0 4px rgba(${r},${g},${b},0.15)`,
  };
}
