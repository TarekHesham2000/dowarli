'use client'
import { Suspense, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import AdBanner from '@/components/ads/AdBanner'
import OwnerBrokerAuth from '@/components/owner/OwnerBrokerAuth'

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type UnitType    = 'student' | 'family' | 'studio' | 'shared' | 'employee'
type RentalUnit  = 'bed' | 'room' | null

type Property = {
  id:           number
  title:        string
  description:  string
  price:        number
  area:         string
  address:      string
  unit_type:    UnitType
  images:       string[]
  status:       string
  video_url:    string | null   // ✨ جديد
  rental_unit:  RentalUnit      // ✨ جديد
  beds_count:   number | null   // ✨ جديد
  profiles:     { name: string; phone: string } | { name: string; phone: string }[]
  availability_status?: string
  report_count?: number
  last_verified_at?: string
  owner_id?: string
  listing_type?: string | null
  listing_purpose?: string | null
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<UnitType, string> = {
  student:  'سكن طلاب',
  family:   'سكن عائلي',
  studio:   'ستوديو',
  shared:   'مشترك',
  employee: 'سكن موظفين',
}

const TYPE_META: Record<UnitType, { icon: string; accent: string; glow: string }> = {
  student:  { icon: '🎓', accent: '#2eb865', glow: 'rgba(27,120,60,0.25)'  },
  family:   { icon: '🏡', accent: '#60a5fa', glow: 'rgba(96,165,250,0.25)'  },
  studio:   { icon: '🛋️', accent: '#c084fc', glow: 'rgba(192,132,252,0.25)' },
  shared:   { icon: '🤝', accent: '#fb923c', glow: 'rgba(251,146,60,0.25)'  },
  employee: { icon: '💼', accent: '#eab308', glow: 'rgba(234,179,8,0.25)'   },
}

// الفئات التي تدعم rental_unit / beds_count
const SHARED_UNIT_TYPES = new Set<UnitType>(['student', 'shared', 'employee'])

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** استخراج بيانات المالك بأمان سواء Object أو Array */
function getProfile(profiles: Property['profiles']): { name: string; phone: string } {
  if (!profiles) return { name: '', phone: '' }
  if (Array.isArray(profiles)) return profiles[0] ?? { name: '', phone: '' }
  return profiles
}

function effectiveListingKind(p: Pick<Property, 'listing_type' | 'listing_purpose'>): 'rent' | 'sale' {
  const raw = (p.listing_type ?? p.listing_purpose ?? 'rent').toString().trim().toLowerCase()
  return raw === 'sale' ? 'sale' : 'rent'
}

/** تحويل الرقم المصري لصيغة دولية */
function toInternationalEG(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('20')) return clean
  if (clean.startsWith('0'))  return '2' + clean
  return '2' + clean
}

/**
 * استخراج embed URL من رابط الفيديو
 * لماذا هنا وليس في add-property فقط؟
 * → المالك حفظ الرابط الأصلي في الـ DB، فنحتاج نحوّله مرة ثانية للعرض
 */
function getEmbedUrl(url: string | null): string | null {
  if (!url?.trim()) return null
  const u = url.trim()

  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`

  const tt = u.match(/tiktok\.com\/(?:@[\w.]+\/video\/|vm\/|v\/|t\/)(\d+|[a-zA-Z0-9]+)/)
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`

  const gd = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`

  if (u.includes('facebook.com') || u.includes('fb.watch'))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=0`

  return null
}

/** هل الفيديو TikTok؟ (portrait ratio) */
function isTikTokUrl(url: string | null): boolean {
  return !!url?.toLowerCase().includes('tiktok')
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────
export default function PropertyPageClient() {
  const { id }  = useParams()
  const router  = useRouter()

  const [property, setProperty]           = useState<Property | null>(null)
  const [loading, setLoading]             = useState(true)
  const [activeImg, setActiveImg]         = useState(0)
  const [leadForm, setLeadForm]           = useState({ name: '', phone: '' })
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadLoading, setLeadLoading]     = useState(false)
  const [imgLoaded, setImgLoaded]         = useState(false)
  const [phoneError, setPhoneError]       = useState('')
  const [spamBlocked, setSpamBlocked]     = useState(false)
  const [reportBusy, setReportBusy]       = useState(false)
  const [toast, setToast]                 = useState<{ message: string; tone: 'ok' | 'err' } | null>(null)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [reportReason, setReportReason]   = useState('العقار غير متاح أو مؤجر')

  const propertyPath = `/property/${typeof id === 'string' ? id : Array.isArray(id) ? id[0] ?? '' : ''}`

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── تحميل العقار ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('properties')
        .select(`
          id, title, description, price, area, address,
          unit_type, images, status,
          video_url, rental_unit, beds_count,
          listing_type, listing_purpose,
          availability_status, report_count, last_verified_at, owner_id,
          profiles(name, phone)
        `)
        .eq('id', id)
        .single()
      setProperty(data as unknown as Property)
      setLoading(false)
    }
    load()
  }, [id])

  // ── إرسال طلب التواصل ────────────────────────────────────
  const handleLeadSubmit = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!property) return
    setPhoneError('')

    // 1. Validation رقم الهاتف المصري
    const EGYPTIAN_PHONE_REGEX = /^(010|011|012|015)\d{8}$/
    const cleanedPhone = leadForm.phone.replace(/\s|-/g, '')

    if (!EGYPTIAN_PHONE_REGEX.test(cleanedPhone)) {
      setPhoneError('عفواً، رقم الهاتف غير صحيح. يجب أن يبدأ بـ 010، 011، 012 أو 015 ويتكون من 11 رقم.')
      return
    }

    setLeadLoading(true)

    // 2. Anti-Spam: هل أرسل لنفس العقار في آخر 24 ساعة؟
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property.id)
      .eq('client_phone', cleanedPhone)
      .gte('created_at', cutoff)

    if (recentCount && recentCount > 0) {
      setLeadLoading(false)
      setSpamBlocked(true)
      return
    }

    // 3. إرسال البيانات
    await supabase.from('leads').insert({
      property_id:  property.id,
      client_name:  leadForm.name,
      client_phone: cleanedPhone,
    })

    setLeadSubmitted(true)
    setLeadLoading(false)

    // 4. فتح واتساب بالصيغة الدولية
    setTimeout(() => {
      const prof    = getProfile(property.profiles)
      const waPhone = toInternationalEG(prof.phone ?? '')
      const message = `أنا مهتم بالعقار "${property.title}" في ${property.area}.\nالاسم: ${leadForm.name}\nرقم الهاتف: ${cleanedPhone}`
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message), '_blank')
    }, 500)
  }, [property, leadForm])

  const showToast = useCallback((message: string, tone: 'ok' | 'err') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 4800)
  }, [])

  const openReportFlow = useCallback(() => {
    if (!property) return
    if (!sessionUserId) {
      setAuthModalOpen(true)
      return
    }
    if (property.owner_id && sessionUserId === property.owner_id) {
      showToast('لا يمكنك الإبلاغ عن إعلانك الخاص.', 'err')
      return
    }
    setReasonModalOpen(true)
  }, [property, sessionUserId, showToast])

  const submitPropertyReport = useCallback(async () => {
    if (!property?.id || reportBusy) return
    setReportBusy(true)
    try {
      const { data, error } = await supabase.rpc('report_property_unavailable', {
        p_property_id: property.id,
        p_reason: reportReason.trim() || 'غير متاح',
      })
      if (error) {
        showToast(error.message || 'تعذّر إرسال البلاغ.', 'err')
        return
      }
      const res = data as { ok?: boolean; error?: string } | null
      if (!res?.ok) {
        if (res?.error === 'already_reported') {
          showToast('سبق أن أرسلت بلاغاً عن هذا العقار.', 'err')
        } else if (res?.error === 'own_listing') {
          showToast('لا يمكنك الإبلاغ عن إعلانك الخاص.', 'err')
        } else {
          showToast('تعذّر إرسال البلاغ.', 'err')
        }
        return
      }
      setReasonModalOpen(false)
      showToast('شكراً لك — سجّلنا بلاغك وسنراجع الإعلان.', 'ok')
      const { data: fresh } = await supabase
        .from('properties')
        .select('availability_status, report_count')
        .eq('id', property.id)
        .single()
      if (fresh) {
        setProperty((prev) =>
          prev ? { ...prev, ...(fresh as Pick<Property, 'availability_status' | 'report_count'>) } : prev,
        )
      }
    } finally {
      setReportBusy(false)
    }
  }, [property, reportBusy, reportReason, showToast])

  // ══════════════════════════════════════════════════════════
  //  SKELETON LOADER
  // ══════════════════════════════════════════════════════════
  if (loading) return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box;}
        body { background: #020617; font-family: 'Cairo', sans-serif; }
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .sk {
          background: linear-gradient(90deg,
            rgba(255,255,255,.04) 25%,
            rgba(255,255,255,.10) 37%,
            rgba(255,255,255,.04) 63%
          );
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 768px) {
          .sk-grid { grid-template-columns: 1fr !important; }
          .sk-hero { height: 260px !important; }
        }
      `}</style>
      <div dir="rtl" style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 120% 80% at 100% 0%, rgba(6,78,59,.15) 0%, #020617 55%)', color: '#f8fafc' }}>
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(2,6,23,.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 2rem', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sk" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <div className="sk" style={{ width: 100, height: 22 }} />
          </div>
          <div className="sk" style={{ width: 80, height: 36, borderRadius: 12 }} />
        </nav>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem 6rem' }}>
          <div style={{ marginBottom: '1.75rem', display: 'flex', gap: 10 }}>
            <div className="sk" style={{ width: 100, height: 28, borderRadius: 99 }} />
            <div className="sk" style={{ width: 130, height: 28, borderRadius: 99 }} />
          </div>
          <div className="sk-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>
            <div>
              <div className="sk sk-hero" style={{ width: '100%', height: 440, borderRadius: 24, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[0,1,2].map(i => <div key={i} className="sk" style={{ width: 72, height: 54, borderRadius: 10, flexShrink: 0 }} />)}
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="sk" style={{ width: '70%', height: 32, marginBottom: 10 }} />
                <div className="sk" style={{ width: '50%', height: 18 }} />
              </div>
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="sk" style={{ width: 120, height: 20, marginBottom: '1.1rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 16px' }}>
                      <div className="sk" style={{ width: '60%', height: 12, marginBottom: 8 }} />
                      <div className="sk" style={{ width: '80%', height: 18 }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '1.5rem' }}>
                <div className="sk" style={{ width: 100, height: 20, marginBottom: '0.85rem' }} />
                {[0,1,2].map(i => <div key={i} className="sk" style={{ width: i === 2 ? '55%' : '100%', height: 14, marginBottom: 8 }} />)}
              </div>
            </div>
            <div>
              <div style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem', marginBottom: '1rem' }}>
                <div className="sk" style={{ width: 90, height: 28, borderRadius: 99, marginBottom: '1rem' }} />
                <div className="sk" style={{ width: '75%', height: 26, marginBottom: 8 }} />
                <div className="sk" style={{ width: '55%', height: 16, marginBottom: '1.25rem' }} />
                <div className="sk" style={{ width: '100%', height: 80, borderRadius: 16 }} />
              </div>
              <div style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem' }}>
                <div className="sk" style={{ width: 140, height: 22, marginBottom: 8 }} />
                <div className="sk" style={{ width: '80%', height: 14, marginBottom: '1.25rem' }} />
                <div className="sk" style={{ width: '100%', height: 1, marginBottom: '1.25rem' }} />
                <div className="sk" style={{ width: '100%', height: 46, borderRadius: 12, marginBottom: 10 }} />
                <div className="sk" style={{ width: '100%', height: 46, borderRadius: 12, marginBottom: 10 }} />
                <div className="sk" style={{ width: '100%', height: 52, borderRadius: 14 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ══════════════════════════════════════════════════════════
  //  NOT FOUND
  // ══════════════════════════════════════════════════════════
  if (!property) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', fontFamily: "'Cairo', sans-serif", direction: 'rtl' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🏚️</div>
        <p style={{ color: '#94a3b8', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>الإعلان غير موجود</p>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 24 }}>ربما تم حذف الإعلان أو الرابط غير صحيح</p>
        <button onClick={() => router.push('/')} style={{ background: 'var(--brand-gradient-chat)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 0 24px rgba(27,120,60,0.4)' }}>
          العودة للرئيسية
        </button>
      </div>
    </div>
  )

  // ── Derived values ────────────────────────────────────────
  const meta      = TYPE_META[property.unit_type] ?? TYPE_META.family
  const hasImg    = property.images?.length > 0
  const profile   = getProfile(property.profiles)
  const embedUrl  = getEmbedUrl(property.video_url)
  const isTikTok  = isTikTokUrl(property.video_url)

  const isSaleListing = effectiveListingKind(property) === 'sale'
  // هل نعرض تفاصيل الإيجار التفصيلية؟ (إيجار فقط)
  const showRentalDetails =
    !isSaleListing && SHARED_UNIT_TYPES.has(property.unit_type) && property.rental_unit
  const availability = property.availability_status ?? "available"
  const showAvailabilityBanner =
    property.status === "active" && availability !== "available"

  // بناء قائمة Details ديناميكياً — لماذا؟
  // → بدل ما نكتب if/else في الـ JSX، نبني الـ array مرة وتتعمل map نظيف
  const detailItems: { label: string; value: string; icon: string }[] = [
    { label: 'المنطقة',         value: property.area,                    icon: '📍' },
    { label: 'نوع الوحدة',      value: TYPE_LABELS[property.unit_type],  icon: meta.icon },
    { label: 'العنوان التفصيلي', value: property.address,                icon: '🗺️' },
    {
      label: isSaleListing ? 'سعر البيع' : 'السعر الشهري',
      value: `${property.price?.toLocaleString()} ج.م`,
      icon: '💰',
    },
  ]

  // ✨ نضيف تفاصيل الإيجار لو موجودة
  if (showRentalDetails) {
    detailItems.push({
      label: 'نوع الإيجار',
      value: property.rental_unit === 'bed' ? 'سرير' : 'أوضة كاملة',
      icon: property.rental_unit === 'bed' ? '🛏️' : '🚪',
    })
    if (property.rental_unit === 'bed' && property.beds_count) {
      detailItems.push({
        label: 'عدد الأسرّة المتاحة',
        value: `${property.beds_count} ${property.beds_count === 1 ? 'سرير' : 'أسرّة'}`,
        icon: '🔢',
      })
    }
  }

  // ══════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box }
        html { scroll-behavior: smooth; }
        body { background: #020617; font-family: 'Cairo', sans-serif; }
        ::-webkit-scrollbar       { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--brand-500); border-radius: 99px; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes wa-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.45)} 60%{box-shadow:0 0 0 12px rgba(37,211,102,0)} }
        .fade-up   { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
        .fade-up-2 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.1s both; }
        .fade-up-3 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.2s both; }
        .fade-up-4 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.3s both; }
        .fade-up-5 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.4s both; }
        .thumb:hover { opacity:.85; transform:scale(1.04); }
        .thumb { transition: opacity .2s, transform .2s, border-color .2s; }
        .wa-btn { animation: wa-pulse 2.2s ease infinite; }
        .wa-btn:hover { filter: brightness(1.1); transform:translateY(-1px); }
        .back-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .detail-item:hover { background: rgba(27,120,60,0.06) !important; border-color: rgba(27,120,60,0.2) !important; }
        input:focus { border-color: var(--brand-500) !important; box-shadow: 0 0 0 3px rgba(27,120,60,0.12) !important; outline: none !important; }
        @media (max-width: 768px) {
          .grid-layout { grid-template-columns: 1fr !important; }
          .sticky-col  { position: static !important; }
          .hero-img    { height: 260px !important; }
        }
      `}</style>

      <div dir="rtl" style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 120% 80% at 100% 0%, rgba(6,78,59,.18) 0%, #020617 55%)', color: '#f8fafc' }}>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key="prop-toast"
              role="status"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className={`fixed bottom-4 left-1/2 z-[220] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-lg backdrop-blur-md ${
                toast.tone === 'ok'
                  ? 'border-emerald-500/40 bg-slate-950/95 text-emerald-100 shadow-emerald-900/30'
                  : 'border-red-500/35 bg-slate-950/95 text-red-200 shadow-red-950/30'
              }`}
            >
              {toast.message}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Ambient glow */}
        <div aria-hidden style={{ position: 'fixed', bottom: 0, left: 0, width: 460, height: 460, background: 'radial-gradient(circle, rgba(27,120,60,.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* ══ NAV ══ */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(2,6,23,.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 2rem', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '6px 14px', borderRadius: 12 }}>
            <Image
              src="/images/full-logo.png"
              alt="دَورلي — Dowarly"
              width={200}
              height={40}
              className="h-9 w-auto max-h-9 object-contain"
              priority
              quality={75}
            />
          </a>
          <button onClick={() => router.back()} className="back-btn" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s' }}>
            ← رجوع
          </button>
        </nav>

        {/* ══ CONTENT ══ */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem 6rem', position: 'relative', zIndex: 1 }}>

          {/* Breadcrumb */}
          <div className="fade-up" style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${meta.accent}18`, border: `1px solid ${meta.accent}40`, borderRadius: 99, fontSize: 12, fontWeight: 700, color: meta.accent, padding: '5px 14px' }}>
              {meta.icon} {TYPE_LABELS[property.unit_type]}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.35)', borderRadius: 99, fontSize: 12, fontWeight: 700, color: isSaleListing ? '#fbbf24' : '#86efac', padding: '5px 14px' }}>
              {isSaleListing ? '🏷️ بيع' : '🔑 إيجار'}
            </span>
            {/* ✨ rental_unit badge في الـ breadcrumb */}
            {showRentalDetails && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 99, fontSize: 12, fontWeight: 700, color: '#60a5fa', padding: '5px 14px' }}>
                {property.rental_unit === 'bed' ? '🛏️ إيجار سرير' : '🚪 أوضة كاملة'}
              </span>
            )}
            <span style={{ color: '#334155', fontSize: 13 }}>·</span>
            <span style={{ color: '#475569', fontSize: 13 }}>📍 {property.area}</span>
          </div>

          {showAvailabilityBanner ? (
            <div
              className="fade-up mb-5 rounded-2xl border border-amber-500/40 bg-amber-950/35 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              {availability === "rented"
                ? "هذا الإعلان مُعلَن كغير متاح حالياً (مؤجر). يمكنك تصفّح إعلانات أخرى من الرئيسية."
                : "هذا الإعلان قيد المراجعة بسبب بلاغات التوافر. قد يظهر حتى يتحقق فريقنا."}
            </div>
          ) : null}

          {/* ── Two-column grid ── */}
          <div className="grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>

            {/* ── LEFT COLUMN ── */}
            <div>

              {/* Hero image */}
              <div className="fade-up hero-img" style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', height: 440, marginBottom: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                {hasImg ? (
                  <>
                    <Image
                      src={property.images[activeImg]}
                      alt={property.title}
                      fill
                      sizes="(max-width:768px) 100vw, 660px"
                      loading="eager"
                      priority
                      style={{ objectFit: 'cover', transition: activeImg === 0 ? 'none' : 'opacity .35s', opacity: imgLoaded ? 1 : 0 }}
                      onLoad={() => setImgLoaded(true)}
                    />
                    <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,6,23,.65) 0%, transparent 50%)' }} />
                    {property.images.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(2,6,23,.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 12px' }}>
                        {activeImg + 1} / {property.images.length}
                      </div>
                    )}
                    {/* ✨ لو في فيديو، نعرض badge عليه */}
                    {embedUrl && (
                      <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(124,58,237,.85)', backdropFilter: 'blur(8px)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#fff', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        ▶ فيديو متاح
                      </div>
                    )}
                  </>
                ) : (
                  <div aria-hidden style={{ height: '100%', background: 'linear-gradient(135deg, rgba(27,120,60,.08), rgba(5,150,105,.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 90 }}>🏠</div>
                )}
              </div>

              {/* Thumbnails */}
              {property.images.length > 1 && (
                <div className="fade-up-2" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 24 }}>
                  {property.images.map((img, i) => (
                    <button key={i} onClick={() => { setActiveImg(i); setImgLoaded(false) }} className="thumb"
                      style={{ flexShrink: 0, width: 72, height: 54, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === activeImg ? meta.accent : 'transparent'}`, cursor: 'pointer', background: 'none', padding: 0, position: 'relative', boxShadow: i === activeImg ? `0 0 12px ${meta.glow}` : 'none' }}>
                      <Image src={img} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}

              {/* ✨ VIDEO EMBED ─────────────────────────────────────────
                  لماذا نضعه هنا (بعد الصور) وليس في الـ sidebar؟
                  → الفيديو محتوى بصري كبير — مكانه الطبيعي في عمود المحتوى
                  → الـ sidebar للتفاعل (سعر + تواصل) يبقى ثابت أثناء التمرير
              ──────────────────────────────────────────────────────── */}
              {embedUrl && (
                <div className="fade-up-2" style={{ marginBottom: 24 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(124,58,237,.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🎬</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>جولة مرئية للعقار</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,.1)', border: '1px solid rgba(192,132,252,.25)', borderRadius: 99, padding: '2px 10px' }}>
                      {isTikTok ? 'TikTok' : 'فيديو'}
                    </span>
                  </div>

                  {/* Iframe container — نحافظ على الـ aspect ratio */}
                  <div style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,.08)',
                    background: '#000',
                    position: 'relative',
                    // TikTok portrait (9:16) ← → YouTube landscape (16:9)
                    paddingBottom: isTikTok ? '177.78%' : '56.25%',
                    // لو TikTok نحدد عرض أصغر عشان ما تبانش ممتدة بشكل غريب
                    maxWidth: isTikTok ? 360 : '100%',
                    boxShadow: '0 20px 60px rgba(0,0,0,.5)',
                  }}>
                    <iframe
                      src={embedUrl}
                      title="جولة مرئية للعقار"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                </div>
              )}

              {/* Title + address */}
              <div className="fade-up-2" style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: '0.5rem' }}>{property.title}</h1>
                <p style={{ fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={meta.accent}/><circle cx="12" cy="9" r="2.5" fill="#020617"/></svg>
                  {property.area} — {property.address}
                </p>
              </div>

              {/* ✨ Details grid — ديناميكي يشمل rental_unit + beds_count */}
              <div className="fade-up-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: `${meta.accent}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>
                  تفاصيل العقار
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {detailItems.map((item, i) => (
                    <div key={i} className="detail-item"
                      style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 16px', transition: 'background .2s, border-color .2s', cursor: 'default' }}>
                      <p style={{ fontSize: 11, color: '#475569', margin: '0 0 5px' }}>{item.icon} {item.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              {property.description && (
                <div className="fade-up-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '1.5rem' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: `${meta.accent}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📝</span>
                    وصف العقار
                  </h3>
                  <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 2, margin: 0 }}>{property.description}</p>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: Sticky ── */}
            <div className="sticky-col" style={{ position: 'sticky', top: 88 }}>

              {/* Price card */}
              <div className="fade-up-2" style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem', marginBottom: '1rem', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
                {/* Type + rental badge */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: `${meta.accent}18`, border: `1px solid ${meta.accent}40`, borderRadius: 99, fontSize: 12, fontWeight: 700, color: meta.accent, padding: '5px 14px' }}>
                    {meta.icon} {TYPE_LABELS[property.unit_type]}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.35)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: isSaleListing ? '#fbbf24' : '#86efac', padding: '5px 12px' }}>
                    {isSaleListing ? '🏷️ بيع' : '🔑 إيجار'}
                  </div>
                  {/* ✨ rental badge في الـ price card */}
                  {showRentalDetails && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#60a5fa', padding: '5px 12px' }}>
                      {property.rental_unit === 'bed'
                        ? `🛏️ ${property.beds_count ? property.beds_count + ' أسرّة' : 'إيجار سرير'}`
                        : '🚪 أوضة كاملة'
                      }
                    </div>
                  )}
                </div>

                <h1 style={{ fontSize: 19, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.35 }}>{property.title}</h1>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 1.25rem', lineHeight: 1.6 }}>📍 {property.area} — {property.address}</p>

                <div style={{ background: `linear-gradient(135deg, ${meta.accent}14, ${meta.accent}08)`, border: `1px solid ${meta.accent}25`, borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px', fontWeight: 600 }}>
                    {isSaleListing ? 'سعر البيع' : 'السعر الشهري'}
                  </p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: meta.accent, margin: 0, lineHeight: 1 }}>
                    {property.price?.toLocaleString()}
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#475569', marginRight: 6 }}>
                      {isSaleListing ? 'ج.م' : 'ج.م / شهر'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Contact card */}
              <div className="fade-up-3" style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>تواصل مع المالك</h2>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 1.25rem', lineHeight: 1.6 }}>أدخل بياناتك وسنوصلك بالمالك فوراً عبر واتساب</p>
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)', marginBottom: '1.25rem' }} />

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                {/* Anti-spam blocked */}
                {spamBlocked ? (
                  <div style={{ background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.3)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fb923c', margin: '0 0 6px' }}>لقد أرسلت طلباً مؤخراً</p>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>يمكنك إعادة التواصل بشأن هذا العقار بعد 24 ساعة</p>
                  </div>

                ) : !leadSubmitted ? (
                  <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* الاسم */}
                    <input
                      type="text"
                      placeholder="اسمك الكامل"
                      required
                      value={leadForm.name}
                      onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
                      style={{ background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.09)', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: "'Cairo', sans-serif", color: '#f8fafc', outline: 'none', transition: 'border-color .2s' }}
                    />

                    {/* الهاتف + validation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <input
                        type="tel"
                        placeholder="رقم هاتفك (010/011/012/015)"
                        required
                        value={leadForm.phone}
                        onChange={e => { setLeadForm({ ...leadForm, phone: e.target.value }); setPhoneError('') }}
                        style={{ background: 'rgba(255,255,255,.04)', border: `1.5px solid ${phoneError ? '#ef4444' : 'rgba(255,255,255,.09)'}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: "'Cairo', sans-serif", color: '#f8fafc', outline: 'none', transition: 'border-color .2s' }}
                      />
                      {phoneError && (
                        <p style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, paddingRight: 5 }}>⚠️ {phoneError}</p>
                      )}
                    </div>

                    {/* زر الواتساب */}
                    <button type="submit" disabled={leadLoading} className="wa-btn"
                      style={{ marginTop: 4, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, cursor: leadLoading ? 'not-allowed' : 'pointer', fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: leadLoading ? 0.7 : 1, transition: 'filter .2s, transform .2s' }}>
                      {leadLoading ? (
                        <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', animation: 'spin .7s linear infinite' }} /> جاري الإرسال...</>
                      ) : (
                        <>
                          <svg width="19" height="19" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.478 2 12.004a9.958 9.958 0 001.362 5.042L2 22l5.09-1.34A9.938 9.938 0 0012 22c5.523 0 10-4.478 10-10.004C22 6.478 17.523 2 12 2z"/></svg>
                          تواصل مع المالك على واتساب
                        </>
                      )}
                    </button>

                    <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 2 }}>
                      🔒 بياناتك محفوظة ولن تُشارك مع أي طرف ثالث
                    </p>
                  </form>

                ) : (
                  <div style={{ background: 'rgba(27,120,60,.1)', border: '1px solid rgba(27,120,60,.3)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-500)', margin: '0 0 4px' }}>تم إرسال طلبك بنجاح!</p>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>جاري تحويلك لواتساب المالك...</p>
                  </div>
                )}
                </motion.div>
              </div>

              {/* Share / Back row */}
              <div className="fade-up-4" style={{ marginTop: '0.75rem', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigator.share?.({ title: property.title, url: window.location.href }).catch(() => navigator.clipboard.writeText(window.location.href))}
                  style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px', fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s, color .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                >
                  🔗 مشاركة الإعلان
                </button>
                <button
                  onClick={() => router.push('/')}
                  style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px', fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s, color .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                >
                  🏠 إعلانات أخرى
                </button>
              </div>

              {property.status === "active" ? (
                <button
                  type="button"
                  disabled={reportBusy}
                  onClick={() => openReportFlow()}
                  className="fade-up-4 mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center text-xs font-bold text-slate-400 transition hover:border-amber-500/35 hover:bg-amber-950/25 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ fontFamily: "'Cairo', sans-serif",
                    padding: '10px 14px',
                    marginTop: 12,
                   }}
                >
                  {reportBusy ? "جاري الإرسال…" : "إبلاغ عن عقار غير متاح"}
                </button>
              ) : null}
            </div>

          </div>
        </div>

        <Suspense fallback={null}>
          <OwnerBrokerAuth
            variant="modal"
            open={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            mode="login"
            bannerMessage="يجب تسجيل الدخول لضمان جدية الإبلاغ وحماية جودة البيانات"
            oauthNextPath={propertyPath}
            onAuthSuccess={() => {
              setAuthModalOpen(false)
              setReasonModalOpen(true)
            }}
          />
        </Suspense>

        <AnimatePresence>
          {reasonModalOpen && property ? (
            <motion.div
              key="report-reason"
              role="presentation"
              className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !reportBusy && setReasonModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 8 }}
                transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-950 p-5 shadow-2xl shadow-amber-950/40"
              >
                <h3 className="mb-2 text-center text-base font-black text-amber-100">تفاصيل البلاغ</h3>
                <p className="mb-3 text-center text-xs text-slate-400">وصف مختصر يساعد فريق المراجعة (اختياري)</p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={3}
                  className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none ring-amber-500/30 focus:ring-2"
                />
                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                  <button
                    type="button"
                    disabled={reportBusy}
                    onClick={() => void submitPropertyReport()}
                    className="flex-1 rounded-xl bg-gradient-to-l from-amber-600 to-emerald-700 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-900/30 disabled:opacity-50"
                  >
                    {reportBusy ? 'جاري الإرسال…' : 'إرسال البلاغ'}
                  </button>
                  <button
                    type="button"
                    disabled={reportBusy}
                    onClick={() => setReasonModalOpen(false)}
                    className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-slate-400 hover:bg-white/5"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="px-4 pb-4 sm:px-6" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <AdBanner slotId="dowarli-property-detail" layout="detail" />
        </div>

        {/* FOOTER */}
        <footer style={{ background: 'rgba(2,6,23,.98)', borderTop: '1px solid rgba(255,255,255,.05)', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>دَورلي <span style={{ color: 'var(--brand-500)', fontSize: 13, fontWeight: 600 }}>Dowarly</span></p>
          <p style={{ fontSize: 11, color: '#334155' }}>جميع الحقوق محفوظة © 2026 دَورلي</p>
        </footer>
      </div>
    </>
  )
}