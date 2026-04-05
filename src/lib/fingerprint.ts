/**
 * fingerprint.ts
 * Device Fingerprinting Utility — دورلي Anti-Fraud System
 *
 * بيولد Device ID فريد لكل جهاز ويخزنه في localStorage
 * لو مش موجود بيعمله، لو موجود بيرجعه
 */

const DEVICE_ID_KEY = 'dwrl_did'

// ── توليد ID عشوائي آمن ───────────────────────────────────────
function generateId(): string {
  // بنستخدم crypto.randomUUID() لو متاح (أحدث المتصفحات)
  // وبنرجع للـ Math.random() كـ fallback
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  // Fallback: توليد UUID v4 يدوي
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ── جمع بصمة الجهاز ─────────────────────────────────────────
function collectFingerprint(): string {
  if (typeof window === 'undefined') return ''

  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
    navigator.platform ?? '',
  ]

  // Hash بسيط لتحويل البصمة لـ string قصيرة
  const raw = parts.join('|')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // تحويل لـ 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// ── الدالة الرئيسية ─────────────────────────────────────────
export function getDeviceId(): string {
  // Server-side rendering: مفيش localStorage
  if (typeof window === 'undefined') return ''

  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)

    if (stored) {
      return stored
    }

    // أول مرة: اعمل ID جديد مكون من UUID + بصمة الجهاز
    const fingerprint = collectFingerprint()
    const uuid = generateId()
    const deviceId = `${uuid}-${fingerprint}`

    localStorage.setItem(DEVICE_ID_KEY, deviceId)
    return deviceId

  } catch {
    // لو localStorage محجوب (Private Mode في بعض المتصفحات)
    return collectFingerprint() || generateId()
  }
}

// ── Validation Functions ─────────────────────────────────────

/**
 * يتحقق إن الـ Device لم يتجاوز حد الإعلانات المجانية
 * @returns true لو مسموح بالنشر، false لو وصل للحد
 */
export async function checkDevicePropertyLimit(
  supabase: any,
  deviceId: string,
  freeLimit: number
): Promise<{ allowed: boolean; count: number }> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .in('status', ['active', 'pending'])

    if (error) {
      console.error('Device property check error:', error)
      return { allowed: true, count: 0 } // Safe fallback
    }

    const count = data ?? 0
    return { allowed: count < freeLimit, count: count as number }

  } catch {
    return { allowed: true, count: 0 }
  }
}

/**
 * يتحقق إن الـ Device لم يتجاوز حد الـ Leads في اليوم
 * @returns true لو مسموح بالإرسال، false لو وصل للحد
 */
export async function checkDeviceLeadsLimit(
  supabase: any,
  deviceId: string,
  dailyLimit: number
): Promise<{ allowed: boolean; count: number }> {
  try {
    const since = new Date()
    since.setHours(since.getHours() - 24)

    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .gte('created_at', since.toISOString())

    if (error) {
      console.error('Device leads check error:', error)
      return { allowed: true, count: 0 }
    }

    return { allowed: (count ?? 0) < dailyLimit, count: count ?? 0 }

  } catch {
    return { allowed: true, count: 0 }
  }
}
