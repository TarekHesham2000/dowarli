'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getDeviceId } from '@/lib/fingerprint'
import { AD_POST_COST_RENT, getAdPostPointsCost, type ListingPurpose } from '@/lib/pointsConfig'
import { safeRouterRefresh } from '@/lib/safeRouterRefresh'
import {
  GOVERNORATE_OPTIONS,
  districtsForGovernorate,
} from '@/lib/locationHierarchy'
import {
  BLOCK_PHONE_IN_LISTING_MESSAGE,
  listingTextContainsPhoneSequence,
} from '@/lib/blockPhoneInListingText'

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  { value: 'student',  label: 'سكن طلاب',    icon: '🎓' },
  { value: 'family',   label: 'سكن عائلي',   icon: '🏠' },
  { value: 'studio',   label: 'ستوديو',      icon: '🛋️' },
  { value: 'shared',   label: 'مشترك',       icon: '🤝' },
  { value: 'employee', label: 'سكن موظفين',  icon: '💼' },
]

// الفئات التي تحتاج Sub-filter (سرير / أوضة)
// لماذا Set؟ → O(1) lookup بدل O(n) على Array
const SHARED_UNIT_TYPES = new Set(['student', 'shared', 'employee'])

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e2e8f0',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14,
  fontFamily: 'Cairo, sans-serif',
  outline: 'none',
  background: '#fafafa',
  transition: 'border-color 0.2s, background 0.2s',
  boxSizing: 'border-box',
}

// ──────────────────────────────────────────────────────────────
// Video URL Helpers
// ──────────────────────────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  if (!url.trim()) return null
  const cleanUrl = url.trim()
  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  const ttMatch = cleanUrl.match(/tiktok\.com\/(?:@[\w.]+\/video\/|vm\/|v\/|t\/)(\d+|[a-zA-Z0-9]+)/)
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`
  const gdMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (gdMatch) return `https://drive.google.com/file/d/${gdMatch[1]}/preview`
  if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch'))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=0`
  return null
}

function isValidVideoUrl(url: string): boolean {
  if (!url.trim()) return true
  return getEmbedUrl(url) !== null
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────
export default function AddPropertyPage() {
  const router = useRouter()
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [images, setImages]             = useState<File[]>([])
  const [videoUrl, setVideoUrl]         = useState('')
  const [videoPreview, setVideoPreview] = useState(false)

  // ── Anti-Fraud / counts ───────────────────────────────────
  const [deviceId, setDeviceId]                         = useState('')
  const [devicePropertyCount, setDevicePropertyCount]   = useState(0)
  const [checkingDevice, setCheckingDevice]             = useState(true)
  const [userPoints, setUserPoints]                     = useState(0)
  const [successMessage, setSuccessMessage]             = useState('')

  // ── Form State ─────────────────────────────────────────────
  const [listingPurpose, setListingPurpose] = useState<ListingPurpose>('rent')

  const [form, setForm] = useState({
    title:       '',
    description: '',
    price:       '',
    governorate: '',
    district:    '',
    landmark:    '',
    unit_type:   '',
    rental_unit: '' as 'bed' | 'room' | '',  // ✨ جديد
    beds_count:  '' as string,                // ✨ جديد — string للـ input ثم نحوله number
  })

  // ── هل نعرض الـ Sub-filter؟ (إيجار فقط — بيع لا يستخدم rental_unit في الـ DB enum)
  // لماذا derived variable وليس state منفصل؟
  // → تجنب bugs الـ sync بين state متعددة — القيمة دايماً محسوبة من المصدر الوحيد
  const showRentalSubFilter = SHARED_UNIT_TYPES.has(form.unit_type) && listingPurpose === 'rent'

  useEffect(() => {
    if (listingPurpose === 'sale') {
      setForm((prev) => ({ ...prev, rental_unit: '', beds_count: '' }))
    }
  }, [listingPurpose])

  const districtOptions = useMemo(
    () => (form.governorate ? districtsForGovernorate(form.governorate) : []),
    [form.governorate],
  )

  const activationPointsCost = useMemo(() => getAdPostPointsCost(listingPurpose), [listingPurpose])
  const insufficientPointsToPublish = userPoints < activationPointsCost

  // ── تحميل الإعدادات + فحص الـ Device + رصيد النقاط ─────────
  useEffect(() => {
    const init = async () => {
      const did = getDeviceId()
      setDeviceId(did)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).single()
        const pts = profile?.points ?? 0
        setUserPoints(pts)

        let deviceCount = 0
        if (did) {
          const { count } = await supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('device_id', did)
            .in('status', ['active', 'pending', 'pending_approval'])
          deviceCount = count ?? 0
        }

        const { count: userCount } = await supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .in('status', ['active', 'pending', 'pending_approval'])

        setDevicePropertyCount(Math.max(deviceCount, userCount ?? 0))
      }

      setCheckingDevice(false)
    }

    void init()
  }, [])

  // ── عند تغيير الـ unit_type، نعمل reset للـ sub-fields ────
  // لماذا؟ → منع إرسال بيانات غير منطقية (beds_count لشقة عائلية مثلاً)
  const handleUnitTypeChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      unit_type:   value,
      // Reset sub-filter لو الفئة الجديدة مش من SHARED_UNIT_TYPES
      rental_unit: SHARED_UNIT_TYPES.has(value) ? prev.rental_unit : '',
      beds_count:  SHARED_UNIT_TYPES.has(value) ? prev.beds_count  : '',
    }))
  }

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files).slice(0, 6))
  }

  const uploadImages = async (propertyId: number): Promise<string[]> => {
    const urls: string[] = []
    for (const image of images) {
      const fileName = `${propertyId}/${Date.now()}-${image.name}`
      const { error } = await supabase.storage.from('properties').upload(fileName, image)
      if (!error) {
        const { data } = supabase.storage.from('properties').getPublicUrl(fileName)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')

    // Validation: الصور
    if (images.length < 3) {
      setError('يجب إضافة 3 صور على الأقل لوصف العقار بشكل جيد 📸')
      setLoading(false)
      return
    }
    if (images.length > 6) {
      setError('الحد الأقصى للصور هو 6 صور فقط')
      setLoading(false)
      return
    }

    // Validation: رابط الفيديو
    if (videoUrl.trim() && !isValidVideoUrl(videoUrl)) {
      setError('رابط الفيديو غير صحيح — يُقبل فقط روابط YouTube أو TikTok')
      setLoading(false)
      return
    }

    if (listingTextContainsPhoneSequence(form.title, form.description)) {
      setError(BLOCK_PHONE_IN_LISTING_MESSAGE)
      setLoading(false)
      return
    }

    // Validation: الـ Sub-filter لو الإعلان إيجار والفئة تتطلبه
    if (listingPurpose === 'rent' && showRentalSubFilter && !form.rental_unit) {
      setError('يرجى تحديد نوع الإيجار: سرير أم أوضة كاملة')
      setLoading(false)
      return
    }

    // Validation: beds_count لازم يكون رقم موجب لو إيجار + rental_unit = bed
    if (listingPurpose === 'rent' && form.rental_unit === 'bed') {
      const bedsNum = Number(form.beds_count)
      if (!form.beds_count || isNaN(bedsNum) || bedsNum < 1 || bedsNum > 20) {
        setError('يرجى إدخال عدد الأسرّة (من 1 إلى 20)')
        setLoading(false)
        return
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_active, points')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        setError('تعذر التحقق من حالة الحساب حالياً، حاول مرة أخرى')
        setLoading(false)
        return
      }

      if (!profile.is_active) {
        setError('تم إيقاف حسابك مؤقتاً ولا يمكنك إضافة إعلانات حالياً')
        setLoading(false)
        return
      }

      const livePoints = profile.points ?? 0
      setUserPoints(livePoints)

      const pointsCost = getAdPostPointsCost(listingPurpose)

      if (livePoints < pointsCost) {
        setError(
          `رصيد النقاط غير كافٍ. مطلوب ${pointsCost} نقطة عند موافقة الإدارة على إعلان ${listingPurpose === 'sale' ? 'بيع' : 'إيجار'}.`,
        )
        setLoading(false)
        return
      }

      // بيع: لا نرسل rental_unit / beds إلى الـ RPC (عمود rental_unit enum في DB = NULL)
      const rentalUnitForRpc =
        listingPurpose === 'sale' ? null : form.rental_unit ? form.rental_unit : null
      const bedsForRpc =
        listingPurpose === 'sale'
          ? null
          : form.rental_unit === 'bed' && form.beds_count
            ? Number(form.beds_count)
            : null

      const { data: newIdRaw, error: rpcError } = await supabase.rpc('handle_property_submission', {
        p_title: form.title.trim(),
        p_description: (form.description || '').trim(),
        p_price: Number(form.price),
        p_area: '',
        p_unit_type: form.unit_type.trim(),
        p_address: '',
        p_device_id: deviceId || null,
        p_video_url: videoUrl.trim() || null,
        p_rental_unit: rentalUnitForRpc,
        p_beds_count: bedsForRpc,
        p_listing_purpose: listingPurpose,
        p_governorate: form.governorate.trim(),
        p_district: form.district.trim(),
        p_landmark: (form.landmark || '').trim() || null,
      })

      if (rpcError) {
        const msg = rpcError.message ?? ''
        if (msg.includes('not_authenticated')) {
          setError('انتهت الجلسة — سجّل الدخول من جديد.')
        } else if (msg.includes('ممنوع وضع أرقام تليفونات')) {
          setError(BLOCK_PHONE_IN_LISTING_MESSAGE)
        } else {
          setError(msg || 'تعذّر حفظ الإعلان. حاول مرة أخرى.')
        }
        setLoading(false)
        return
      }

      const insertData = { id: Number(newIdRaw) }
      if (!Number.isFinite(insertData.id)) {
        setError('تعذّر قراءة رقم الإعلان بعد الحفظ.')
        setLoading(false)
        return
      }

      if (images.length > 0) {
        const imageUrls = await uploadImages(insertData.id)
        await supabase.from('properties').update({ images: imageUrls }).eq('id', insertData.id)
      }

      setSuccessMessage(
        'تم استلام إعلانك بنجاح. سيُراجع من الإدارة وتُخصم النقاط عند الموافقة على النشر.',
      )
      safeRouterRefresh(router)
      await new Promise((r) => setTimeout(r, 700))
      router.push('/dashboard')

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('حدث خطأ غير متوقع، حاول مرة أخرى')
      setLoading(false)
    }
  }

  const embedUrl        = getEmbedUrl(videoUrl)
  const isTikTok        = videoUrl.toLowerCase().includes('tiktok')
  const videoUrlInvalid = videoUrl.trim() !== '' && !isValidVideoUrl(videoUrl)

  // ── Loading Screen ─────────────────────────────────────────
  if (checkingDevice) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', background: '#f0fdf4' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #dcfce7', borderTop: '3px solid #166534', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>جاري التحقق...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ──────────────────────────────────────────────────────────────
  // Main Render
  // ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #dcfce7', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 1px 8px rgba(22,101,52,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏘️</div>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>دورلي</span>
          <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>إعلان جديد</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', padding: '7px 14px', borderRadius: 10 }}>
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>رفع عقار جديد 🏠</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            تُخصم النقاط عند موافقة الإدارة: إيجار {AD_POST_COST_RENT} نقطة — بيع {getAdPostPointsCost('sale')} نقطة. حسابك يبدأ بـ 100 نقطة هدية.
          </p>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', border: '1px solid #86efac', borderRadius: 14, padding: '12px 18px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>💎</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#14532d', margin: 0 }}>نظام النقاط</p>
            <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>
              تأكد أن رصيدك يكفي لنوع الإعلان قبل الإرسال — الخصم عند الموافقة فقط.
            </p>
          </div>
        </div>

        {devicePropertyCount > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', margin: 0 }}>
              لديك {devicePropertyCount} إعلاناً نشطاً أو قيد المراجعة مرتبطاً بحسابك أو جهازك
            </p>
          </div>
        )}

        {/* FORM CARD */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>

          {successMessage ? (
            <div style={{ background: '#ecfdf5', border: '1px solid #4ade80', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#14532d', marginBottom: '1.25rem', fontWeight: 700 }}>
              ✓ {successMessage}
            </div>
          ) : null}
          {insufficientPointsToPublish ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#991b1b', marginBottom: '1.25rem', lineHeight: 1.7 }}>
              <strong>رصيد منخفض:</strong> تحتاج {activationPointsCost} نقطة على الأقل لإعلان {listingPurpose === 'sale' ? 'بيع' : 'إيجار'} (تُخصم عند موافقة الإدارة).{' '}
              <Link href="/wallet" style={{ color: '#166534', fontWeight: 900, textDecoration: 'underline' }}>
                شحن النقاط — المحفظة
              </Link>
            </div>
          ) : null}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: 8, whiteSpace: 'pre-line' }}>
              <span style={{ flexShrink: 0 }}>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* TITLE */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                عنوان الإعلان <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input type="text" placeholder="مثال: شقة مفروشة في المنصورة" required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }} />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>وصف العقار</label>
              <textarea placeholder="اكتب تفاصيل العقار، المميزات، الطابق، وأي معلومات مفيدة..." rows={3}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }} />
            </div>

            {/* PRICE + GOVERNORATE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  السعر الشهري <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="number" placeholder="2000" required value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    style={{ ...inputStyle, paddingLeft: 46 }}
                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }} />
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8', fontWeight: 700, pointerEvents: 'none' }}>ج.م</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  المحافظة <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  required
                  value={form.governorate}
                  onChange={e =>
                    setForm({ ...form, governorate: e.target.value, district: '' })
                  }
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}>
                  <option value="">اختار المحافظة...</option>
                  {GOVERNORATE_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* DISTRICT */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                المنطقة / الحي <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                required
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                disabled={!form.governorate}
                style={{ ...inputStyle, cursor: form.governorate ? 'pointer' : 'not-allowed', opacity: form.governorate ? 1 : 0.65 }}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}>
                <option value="">{form.governorate ? 'اختار المنطقة...' : 'اختر المحافظة أولاً'}</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* إيجار vs بيع — يحدد تكلفة النقاط */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                نوع الإعلان <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(
                  [
                    { v: 'rent' as const, label: 'إيجار', sub: `${AD_POST_COST_RENT} نقطة`, icon: '🔑' },
                    { v: 'sale' as const, label: 'بيع', sub: `${getAdPostPointsCost('sale')} نقطة`, icon: '🏷️' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      setListingPurpose(opt.v)
                      if (opt.v === 'sale') {
                        setForm((prev) => ({ ...prev, rental_unit: '', beds_count: '' }))
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      border: listingPurpose === opt.v ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                      borderRadius: 12,
                      background: listingPurpose === opt.v ? '#f0fdf4' : '#fafafa',
                      color: listingPurpose === opt.v ? '#14532d' : '#64748b',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <span>
                      {opt.icon} {opt.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* LANDMARK / DETAIL ADDRESS */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                العنوان بالتفصيل / علامة مميزة
              </label>
              <input type="text" placeholder="مثال: شارع النصر، بجوار المسجد" value={form.landmark}
                onChange={e => setForm({ ...form, landmark: e.target.value })} style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }} />
            </div>

            {/* UNIT TYPE */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                نوع الوحدة <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {UNIT_TYPES.map(type => (
                  <button key={type.value} type="button" onClick={() => handleUnitTypeChange(type.value)}
                    style={{
                      padding: '10px 14px',
                      border: form.unit_type === type.value ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                      borderRadius: 12,
                      background: form.unit_type === type.value ? '#f0fdf4' : '#fafafa',
                      color: form.unit_type === type.value ? '#14532d' : '#64748b',
                      fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}>
                    <span>{type.icon}</span> {type.label}
                  </button>
                ))}
              </div>
              {/* Hidden input للـ required validation */}
              <input type="text" required value={form.unit_type} onChange={() => {}}
                style={{ opacity: 0, border: 'none', position: 'absolute' }} tabIndex={-1} />
            </div>

            {/* ✨ SUB-FILTER: rental_unit + beds_count */}
            {/* يظهر فقط لـ student / shared / employee */}
            {/* لماذا transition؟ → تجربة مستخدم سلسة بدل ظهور مفاجئ */}
            {showRentalSubFilter && (
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
                border: '1.5px solid #bfdbfe',
                borderRadius: 14,
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                // Animate in
                animation: 'slideDown 0.25s ease-out',
              }}>
                <style>{`
                  @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                `}</style>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>🛏️</span>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', margin: 0 }}>
                    تفاصيل الإيجار <span style={{ color: '#dc2626' }}>*</span>
                  </p>
                  <span style={{ fontSize: 11, color: '#60a5fa', background: '#dbeafe', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                    مطلوب لهذا النوع
                  </span>
                </div>

                {/* rental_unit: سرير أم أوضة؟ */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                    نوع الإيجار
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { value: 'bed',  label: 'سرير',          icon: '🛏️', desc: 'إيجار سرير في أوضة مشتركة' },
                      { value: 'room', label: 'أوضة كاملة',   icon: '🚪', desc: 'أوضة مستقلة للشخص' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          rental_unit: opt.value as 'bed' | 'room',
                          // لو اختار أوضة، نمسح beds_count لأنه مش محتاجه
                          beds_count: opt.value === 'room' ? '' : prev.beds_count,
                        }))}
                        style={{
                          padding: '10px 12px',
                          border: form.rental_unit === opt.value ? '2px solid #3b82f6' : '1.5px solid #bfdbfe',
                          borderRadius: 12,
                          background: form.rental_unit === opt.value ? '#dbeafe' : '#fff',
                          color: form.rental_unit === opt.value ? '#1d4ed8' : '#64748b',
                          fontFamily: 'Cairo, sans-serif',
                          cursor: 'pointer',
                          textAlign: 'right',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* beds_count — يظهر فقط لو rental_unit = 'bed' */}
                {form.rental_unit === 'bed' && (
                  <div style={{ animation: 'slideDown 0.2s ease-out' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                      عدد الأسرّة المتاحة <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* أزرار سريعة للأعداد الشائعة */}
                      {[1, 2, 3, 4, 6].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, beds_count: String(n) }))}
                          style={{
                            width: 44, height: 44,
                            border: form.beds_count === String(n) ? '2px solid #3b82f6' : '1.5px solid #bfdbfe',
                            borderRadius: 10,
                            background: form.beds_count === String(n) ? '#3b82f6' : '#fff',
                            color: form.beds_count === String(n) ? '#fff' : '#374151',
                            fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                      {/* Input يدوي للأعداد الأخرى */}
                      <input
                        type="number"
                        placeholder="أو اكتب"
                        min={1}
                        max={20}
                        value={form.beds_count}
                        onChange={e => setForm(prev => ({ ...prev, beds_count: e.target.value }))}
                        style={{
                          width: 90, border: '1.5px solid #bfdbfe', borderRadius: 10,
                          padding: '10px 12px', fontSize: 13, fontFamily: 'Cairo, sans-serif',
                          outline: 'none', background: '#fff', textAlign: 'center',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#bfdbfe'}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: '#60a5fa', margin: '6px 0 0', fontWeight: 600 }}>
                      💡 يساعد الباحثين في إيجاد سرير بسرعة
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* IMAGES */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                صور العقار <span style={{ color: '#dc2626' }}>*</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}> (مطلوب من 3 إلى 6 صور)</span>
              </label>
              <label htmlFor="images" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: images.length >= 3 ? '2px solid #16a34a' : '2px dashed #d1d5db', borderRadius: 14, padding: '1.25rem', cursor: 'pointer', background: images.length >= 3 ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s' }}>
                <span style={{ fontSize: 26 }}>{images.length >= 3 ? '✅' : '📷'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: images.length >= 3 ? '#166534' : '#94a3b8' }}>
                  {images.length > 0 ? `تم اختيار ${images.length} صور` : 'اضغط لإضافة صور (مطلوب 3 على الأقل)'}
                </span>
              </label>
              <input type="file" accept="image/*" multiple id="images" onChange={handleImages} style={{ display: 'none' }} />
            </div>

            {/* VIDEO */}
            <div style={{ border: '1.5px dashed #c4b5fd', borderRadius: 14, padding: '1rem', background: '#faf5ff' }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                🎬 رابط فيديو المعاينة
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#7c3aed', borderRadius: 20, padding: '2px 10px' }}>اختياري</span>
              </label>
              <p style={{ fontSize: 11, color: '#7c3aed', margin: '0 0 10px', fontWeight: 600 }}>
                يُقبل روابط YouTube أو TikTok — يجذب المستأجرين أكثر بـ 3x ✨
              </p>
              <div style={{ position: 'relative' }}>
                <input type="url" placeholder="https://youtube.com/watch?v=..." value={videoUrl}
                  onChange={e => { setVideoUrl(e.target.value); setVideoPreview(false) }}
                  style={{ ...inputStyle, background: '#fff', borderColor: videoUrlInvalid ? '#dc2626' : embedUrl ? '#7c3aed' : '#c4b5fd', paddingLeft: 44, direction: 'ltr', textAlign: 'right' }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = videoUrlInvalid ? '#dc2626' : embedUrl ? '#7c3aed' : '#c4b5fd'; e.target.style.background = '#fff' }} />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
                  {isTikTok ? '🎵' : '▶️'}
                </span>
                {videoUrl && (
                  <button type="button" onClick={() => { setVideoUrl(''); setVideoPreview(false) }}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}>✕</button>
                )}
              </div>
              {videoUrlInvalid && (
                <p style={{ fontSize: 12, color: '#dc2626', margin: '6px 0 0', fontWeight: 600 }}>
                  ⚠️ رابط غير مدعوم — يُرجى استخدام YouTube أو TikTok
                </p>
              )}
              {embedUrl && !videoUrlInvalid && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✅ رابط صحيح</span>
                  <button type="button" onClick={() => setVideoPreview(v => !v)}
                    style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 8, padding: '4px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {videoPreview ? '🙈 إخفاء المعاينة' : '👁️ معاينة الفيديو'}
                  </button>
                </div>
              )}
              {videoPreview && embedUrl && (
                <div style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', border: '2px solid #c4b5fd', position: 'relative', paddingBottom: isTikTok ? '177.78%' : '56.25%', background: '#000' }}>
                  <iframe src={embedUrl} title="معاينة فيديو العقار" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
                </div>
              )}
            </div>

            {/* SUBMIT */}
            <button type="submit" disabled={loading || insufficientPointsToPublish}
              style={{ width: '100%', background: loading || insufficientPointsToPublish ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 900, cursor: loading || insufficientPointsToPublish ? 'not-allowed' : 'pointer', fontFamily: 'Cairo, sans-serif', marginTop: 4, boxShadow: loading || insufficientPointsToPublish ? 'none' : '0 4px 16px rgba(22,163,74,0.3)', transition: 'all 0.2s' }}>
              {loading ? '⏳ جاري الرفع...' : '🚀 نشر الإعلان'}
            </button>

          </form>
        </div>

        {/* INFO NOTE */}
        <div style={{ marginTop: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.7 }}>
            إعلانك سيكون في حالة <strong style={{ color: '#d97706' }}>قيد المراجعة</strong> حتى يوافق عليه الأدمن.
            لن يُخصم أي رصيد قبل الموافقة.
          </p>
        </div>
      </div>
    </div>
  )
}