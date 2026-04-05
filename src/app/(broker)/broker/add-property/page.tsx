'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getDeviceId } from '@/lib/fingerprint'

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const AREAS = ['المنصورة', 'القاهرة', 'الإسكندرية', 'الجيزة', 'أسيوط', 'سوهاج', 'المنيا']

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

  // ── Settings من الداتابيز ──────────────────────────────────
  const [listingCost, setListingCost]             = useState(50)
  const [bannerText, setBannerText]               = useState('أول إعلانين مجاناً بالكامل')
  const [freePropertyLimit, setFreePropertyLimit] = useState(2)

  // ── Anti-Fraud State ───────────────────────────────────────
  const [deviceId, setDeviceId]                         = useState('')
  const [devicePropertyCount, setDevicePropertyCount]   = useState(0)
  const [deviceLimitReached, setDeviceLimitReached]     = useState(false)
  const [checkingDevice, setCheckingDevice]             = useState(true)

  // ── Form State ─────────────────────────────────────────────
  const [form, setForm] = useState({
    title:       '',
    description: '',
    price:       '',
    area:        '',
    unit_type:   '',
    address:     '',
    rental_unit: '' as 'bed' | 'room' | '',  // ✨ جديد
    beds_count:  '' as string,                // ✨ جديد — string للـ input ثم نحوله number
  })

  // ── هل نعرض الـ Sub-filter؟ ───────────────────────────────
  // لماذا derived variable وليس state منفصل؟
  // → تجنب bugs الـ sync بين state متعددة — القيمة دايماً محسوبة من المصدر الوحيد
  const showRentalSubFilter = SHARED_UNIT_TYPES.has(form.unit_type)

  // ── تحميل الإعدادات + فحص الـ Device ─────────────────────
  useEffect(() => {
    const init = async () => {
      const did = getDeviceId()
      setDeviceId(did)

      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')

      if (settingsData) {
        const get = (k: string) => settingsData.find(s => s.key === k)?.value
        const cost  = Number(get('listing_cost')        ?? 50)
        const limit = Number(get('free_property_limit') ?? 2)

        setListingCost(cost)
        setFreePropertyLimit(limit)
        setBannerText(get('banner_text') ?? `أول ${limit} إعلانات مجاناً بالكامل`)

        if (did) {
          const { count } = await supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('device_id', did)
            .in('status', ['active', 'pending'])

          const deviceCount = count ?? 0

          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { count: userCount } = await supabase
              .from('properties')
              .select('id', { count: 'exact', head: true })
              .eq('owner_id', user.id)
              .in('status', ['active', 'pending'])

            const maxCount = Math.max(deviceCount, userCount ?? 0)
            setDevicePropertyCount(maxCount)

            if (maxCount >= limit) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('wallet_balance')
                .eq('id', user.id)
                .single()
              if (!profile || profile.wallet_balance < cost) {
                setDeviceLimitReached(true)
              }
            }
          }
        }
      }

      setCheckingDevice(false)
    }

    init()
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

    // Validation: الـ Sub-filter لو الفئة تتطلبه
    if (showRentalSubFilter && !form.rental_unit) {
      setError('يرجى تحديد نوع الإيجار: سرير أم أوضة كاملة')
      setLoading(false)
      return
    }

    // Validation: beds_count لازم يكون رقم موجب لو rental_unit = bed
    if (form.rental_unit === 'bed') {
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

      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')

      const get = (k: string) => settingsData?.find((s: any) => s.key === k)?.value
      const cost  = Number(get('listing_cost')        ?? listingCost)
      const limit = Number(get('free_property_limit') ?? freePropertyLimit)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance, is_active')
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

      // Anti-Fraud
      const { count: userCount } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .in('status', ['active', 'pending'])

      const { count: devCount } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('device_id', deviceId)
        .in('status', ['active', 'pending'])

      const publishedCount = Math.max(userCount ?? 0, devCount ?? 0)
      const isFree = publishedCount < limit

      if (!isFree && profile.wallet_balance < cost) {
        setError(
          `لقد استنفدت حد الإعلانات المجانية (${limit} إعلانات) ❌\n` +
          `رصيدك الحالي: ${profile.wallet_balance} ج.م — تحتاج ${cost} ج.م\n` +
          `يرجى شحن المحفظة للاستمرار`
        )
        setLoading(false)
        return
      }

      // ── بناء Object البيانات ───────────────────────────────
      // لماذا نبنيه هكذا؟ → نتجنب إرسال null/undefined للحقول اللي مش مطلوبة
      const propertyData: Record<string, any> = {
        owner_id:    user.id,
        title:       form.title,
        description: form.description,
        price:       Number(form.price),
        area:        form.area,
        unit_type:   form.unit_type,
        address:     form.address,
        status:      'pending',
        was_charged: false,
        images:      [],
        device_id:   deviceId,
      }

      // الحقول الاختيارية — نضيفها فقط لو موجودة
      if (videoUrl.trim())           propertyData.video_url   = videoUrl.trim()
      if (form.rental_unit)          propertyData.rental_unit = form.rental_unit
      if (form.rental_unit === 'bed' && form.beds_count)
                                     propertyData.beds_count  = Number(form.beds_count)

      const { data: insertData, error: insertError } = await supabase
        .from('properties')
        .insert(propertyData)
        .select('id')
        .single()

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      if (images.length > 0) {
        const imageUrls = await uploadImages(insertData.id)
        await supabase
          .from('properties')
          .update({ images: imageUrls })
          .eq('id', insertData.id)
      }

      alert('تم استلام إعلانك بنجاح 🎉.. جاري مراجعة البيانات لضمان الجودة، وهيكون متاح للباحثين في اسرع وقت')
      router.push('/broker')

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

  // ── Device Limit Reached Screen ────────────────────────────
  if (deviceLimitReached) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', background: '#f0fdf4', direction: 'rtl', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '2.5rem', maxWidth: 420, width: '100%', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>استنفدت الإعلانات المجانية</h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8, marginBottom: '1.5rem' }}>
          لقد وصلت للحد المجاني وهو <strong style={{ color: '#166534' }}>{freePropertyLimit} إعلانات</strong>.<br />
          لمواصلة النشر، يرجى شحن المحفظة. كل إعلان إضافي بـ <strong style={{ color: '#166534' }}>{listingCost} ج.م</strong> فقط.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/broker/wallet')}
            style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
            💳 شحن المحفظة الآن
          </button>
          <button onClick={() => router.push('/broker')}
            style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
            ← العودة للوحة التحكم
          </button>
        </div>
      </div>
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
        <button onClick={() => router.push('/broker')} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', padding: '7px 14px', borderRadius: 10 }}>
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>رفع عقار جديد 🏠</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            أول {freePropertyLimit} إعلانات مجاناً — الخصم يتم فقط عند موافقة الأدمن
          </p>
        </div>

        {/* FREE BADGE */}
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', border: '1px solid #86efac', borderRadius: 14, padding: '12px 18px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#14532d', margin: 0 }}>{bannerText}</p>
            <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>
              سعر الإعلانات حالياً بـ {listingCost} ج.م — تُخصم فقط عند الموافقة
            </p>
          </div>
        </div>

        {/* إعلانات الجهاز الحالية */}
        {devicePropertyCount > 0 && (
          <div style={{ background: devicePropertyCount >= freePropertyLimit ? '#fef3c7' : '#eff6ff', border: `1px solid ${devicePropertyCount >= freePropertyLimit ? '#fde68a' : '#bfdbfe'}`, borderRadius: 12, padding: '10px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{devicePropertyCount >= freePropertyLimit ? '⚠️' : 'ℹ️'}</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: devicePropertyCount >= freePropertyLimit ? '#92400e' : '#1d4ed8', margin: 0 }}>
              لديك {devicePropertyCount} إعلان من أصل {freePropertyLimit} مجانية
              {devicePropertyCount >= freePropertyLimit && ` — الإعلانات التالية بـ ${listingCost} ج.م`}
            </p>
          </div>
        )}

        {/* FORM CARD */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>

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

            {/* PRICE + AREA */}
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
                  المنطقة <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}>
                  <option value="">اختار...</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* ADDRESS */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>العنوان التفصيلي</label>
              <input type="text" placeholder="مثال: شارع النصر، بجوار المسجد" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })} style={inputStyle}
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
                style={{ opacity: 0, height: 0, padding: 0, border: 'none', position: 'absolute' }} tabIndex={-1} />
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
            <button type="submit" disabled={loading}
              style={{ width: '100%', background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Cairo, sans-serif', marginTop: 4, boxShadow: loading ? 'none' : '0 4px 16px rgba(22,163,74,0.3)', transition: 'all 0.2s' }}>
              {loading ? '⏳ جاري الرفع...' : '🚀 رفع الإعلان'}
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