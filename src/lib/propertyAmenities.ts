/** Keys stored in `properties.amenities` (jsonb). */
export const AMENITY_KEYS = [
  'gas',
  'electricity_meter',
  'water_meter',
  'parking',
  'elevator',
  'security_services',
] as const
export type AmenityKey = (typeof AMENITY_KEYS)[number]

export type PropertyAmenitiesState = Record<AmenityKey, boolean>

export const AMENITY_DEFINITIONS: Record<AmenityKey, { labelAr: string; icon: string }> = {
  gas: { labelAr: 'غاز طبيعي', icon: '🔥' },
  electricity_meter: { labelAr: 'عداد كهرباء', icon: '⚡' },
  water_meter: { labelAr: 'عداد مياه', icon: '💧' },
  parking: { labelAr: 'موقف سيارات', icon: '🅿️' },
  elevator: { labelAr: 'أسانسير', icon: '🛗' },
  security_services: { labelAr: 'خدمات أمن', icon: '🛡️' },
}

export function emptyAmenitiesState(): PropertyAmenitiesState {
  return AMENITY_KEYS.reduce((acc, k) => {
    acc[k] = false
    return acc
  }, {} as PropertyAmenitiesState)
}

export function parseStoredAmenities(raw: unknown): PropertyAmenitiesState {
  const base = emptyAmenitiesState()
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  for (const k of AMENITY_KEYS) {
    if (o[k] === true) base[k] = true
  }
  return base
}

export function hasActiveAmenity(a: PropertyAmenitiesState): boolean {
  return AMENITY_KEYS.some((k) => a[k])
}

/** Persist only `true` keys to keep payload small. */
export function toAmenitiesJson(a: PropertyAmenitiesState): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const k of AMENITY_KEYS) {
    if (a[k]) out[k] = true
  }
  return out
}

/** Agency workspace owner OR explicit profile roles (when used in DB). */
export function canEditPremiumPropertyAmenities(
  isAgencyPublisher: boolean,
  profileRole: string | null | undefined,
): boolean {
  if (isAgencyPublisher) return true
  const r = (profileRole ?? '').toLowerCase().trim()
  return r === 'agency' || r === 'company'
}
