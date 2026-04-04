'use client'
import { useState,useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AREAS = ['المنصورة', 'القاهرة', 'الإسكندرية', 'الجيزة', 'أسيوط', 'سوهاج', 'المنيا']
const UNIT_TYPES = [
  { value: 'student', label: 'سكن طلاب', icon: '🎓' },
  { value: 'family', label: 'سكن عائلي', icon: '🏠' },
  { value: 'studio', label: 'ستوديو', icon: '🛋️' },
  { value: 'shared', label: 'مشترك', icon: '🤝' },
]

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

// ── Video URL helpers ───────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  if (!url.trim()) return null;

  const cleanUrl = url.trim();

  // 1. YouTube (Shorts, Watch, youtu.be)
  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // 2. TikTok (Video & Mobile Short links)
  const ttMatch = cleanUrl.match(/tiktok\.com\/(?:@[\w.]+\/video\/|vm\/|v\/|t\/)(\d+|[a-zA-Z0-9]+)/);
  if (ttMatch) {
    const id = ttMatch[1];
    return `https://www.tiktok.com/embed/v2/${id}`;
  }

  // 3. Google Drive (حولنا رابط العرض لرابط Preview للمشغل)
  // الرابط الأصلي: /file/d/ID/view
  const gdMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdMatch) return `https://drive.google.com/file/d/${gdMatch[1]}/preview`;

  // 4. Facebook Video (يدعم الروابط العادية والـ Reels)
  // بنستخدم الـ Facebook Embedded Post Player
  if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=0`;
  }

  return null;
}

function isValidVideoUrl(url: string): boolean {
  if (!url.trim()) return true // optional field — empty is always valid
  return getEmbedUrl(url) !== null
}

export default function AddPropertyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoPreview, setVideoPreview] = useState(false)
  // 1. ضيف الـ State هنا (تحت الـ images)
  const [listingCost, setListingCost] = useState(50) 

  // 2. ضيف الـ useEffect هنا لجلب البيانات فور تحميل الصفحة
  // ملاحظة: تأكد من استيراد { useEffect } من 'react' فوق
  const [bannerText, setBannerText] = useState('أول إعلانين مجاناً بالكامل')

  useEffect(() => {
    const fetchSettings = async () => {
      // 1. جلب تكلفة الإعلان من المفتاح 'listing_cost'
      const { data: costData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'listing_cost')
        .single()

      if (costData) {
        setListingCost(Number(costData.value))
      }

      // 2. جلب نص البانر من المفتاح 'banner_text'
      const { data: bannerData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'banner_text')
        .single()

      if (bannerData) {
        setBannerText(bannerData.value)
      }
    }

    fetchSettings()
  }, [])
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    unit_type: '',
    address: '',
  })
  
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

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 2. التحقق من عدد الصور (3 على الأقل و 6 على الأكثر)
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

    // validate video URL (الكود اللي كان موجود أصلاً)
    if (videoUrl.trim() && !isValidVideoUrl(videoUrl)) 
      // ...
    setError('')

    // Validate video URL if provided
    if (videoUrl.trim() && !isValidVideoUrl(videoUrl)) {
      setError('رابط الفيديو غير صحيح — يُقبل فقط روابط YouTube أو TikTok')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

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

      const { data: costSetting } = await supabase
        .from('settings').select('value').eq('key', 'listing_cost').single()
      const listingCost = Number(costSetting?.value ?? 50)

      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .in('status', ['active', 'pending'])

      const publishedCount = count ?? 0
      const isFree = publishedCount < 2

      if (!isFree && profile.wallet_balance < listingCost) {
        setError(`رصيدك غير كافٍ ❌ — رصيدك الحالي ${profile.wallet_balance} ج.م، تحتاج ${listingCost} ج.م`)
        setLoading(false)
        return
      }

      const { data: insertData, error: insertError } = await supabase
        .from('properties')
        .insert({
          owner_id: user.id,
          title: form.title,
          description: form.description,
          price: Number(form.price),
          area: form.area,
          unit_type: form.unit_type,
          address: form.address,
          status: 'pending',
          was_charged: false,
          images: [],
          ...(videoUrl.trim() ? { video_url: videoUrl.trim() } : {}),
        })
        .select('id')
        .single()

      if (insertError) { setError(insertError.message); setLoading(false); return }

      if (images.length > 0) {
        const imageUrls = await uploadImages(insertData.id)
        await supabase.from('properties').update({ images: imageUrls }).eq('id', insertData.id)
      }

      alert('تم رفع إعلانك بنجاح! سيظهر للجميع فور مراجعة الأدمن وتفعيله.')
      router.push('/broker')

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('حدث خطأ غير متوقع، حاول مرة أخرى')
      setLoading(false)
    }
  }

  const embedUrl = getEmbedUrl(videoUrl)
  const isTikTok = videoUrl.toLowerCase().includes('tiktok')
  const videoUrlInvalid = videoUrl.trim() !== '' && !isValidVideoUrl(videoUrl)

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #dcfce7',
        padding: '0 1.5rem',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 8px rgba(22,101,52,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🏘️</div>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#15803d', letterSpacing: '-0.5px' }}>دورلي</span>
          <span style={{
            background: '#dcfce7', color: '#166534',
            fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
            border: '1px solid #bbf7d0',
          }}>إعلان جديد</span>
        </div>
        <button
          onClick={() => router.push('/broker')}
          style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            color: '#166534', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
            padding: '7px 14px', borderRadius: 10,
          }}
        >
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>رفع عقار جديد 🏠</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>أول إعلانين مجاناً — الخصم يتم فقط عند موافقة الأدمن</p>
        </div>

        {/* FREE BADGE */}
        <div style={{
          background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
          border: '1px solid #86efac',
          borderRadius: 14,
          padding: '12px 18px',
          marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: 10,
          }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div>
            {/* 1. استبدل النص الثابت هنا بالمتغير bannerText */}
            <p style={{ fontSize: 13, fontWeight: 800, color: '#14532d', margin: 0 }}>
              {bannerText}
            </p>
            
            {/* 2. تأكد من استخدام listingCost أيضاً هنا */}
            <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>
              سعر الإعلانات حلياً بـ {listingCost} ج.م — تُخصم فقط عند الموافقة
            </p>
          </div>
        </div>
        {/* FORM CARD */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: '1.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        }}>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 12, padding: '12px 16px',
              fontSize: 13, color: '#dc2626', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* TITLE */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                عنوان الإعلان <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: شقة مفروشة في المنصورة"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                وصف العقار
              </label>
              <textarea
                placeholder="اكتب تفاصيل العقار، المميزات، الطابق، وأي معلومات مفيدة..."
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}
              />
            </div>

            {/* PRICE + AREA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  السعر الشهري <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="2000"
                    required
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    style={{ ...inputStyle, paddingLeft: 46 }}
                    onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}
                  />
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, color: '#94a3b8', fontWeight: 700, pointerEvents: 'none',
                  }}>ج.م</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  المنطقة <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  required
                  value={form.area}
                  onChange={e => setForm({ ...form, area: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}
                >
                  <option value="">اختار...</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* ADDRESS */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                العنوان التفصيلي
              </label>
              <input
                type="text"
                placeholder="مثال: شارع النصر، بجوار المسجد"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafafa' }}
              />
            </div>

            {/* UNIT TYPE */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                نوع الوحدة <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {UNIT_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, unit_type: type.value })}
                    style={{
                      padding: '10px 14px',
                      border: form.unit_type === type.value ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                      borderRadius: 12,
                      background: form.unit_type === type.value ? '#f0fdf4' : '#fafafa',
                      color: form.unit_type === type.value ? '#14532d' : '#64748b',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: 13, fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{type.icon}</span> {type.label}
                  </button>
                ))}
              </div>
              <input
                type="text" required value={form.unit_type} onChange={() => {}}
                style={{ opacity: 0, height: 0, padding: 0, border: 'none', position: 'absolute' }}
                tabIndex={-1}
              />
            </div>

          {/* IMAGES */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                صور العقار <span style={{ color: '#dc2626' }}>*</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}> (مطلوب من 3 إلى 6 صور)</span>
              </label>
              
              <label
                htmlFor="images"
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  // لو الصور أقل من 3 يفضل لونه رمادي، لو 3 أو أكتر يقلب أخضر
                  border: images.length >= 3 ? '2px solid #16a34a' : '2px dashed #d1d5db',
                  borderRadius: 14, padding: '1.25rem',
                  cursor: 'pointer',
                  background: images.length >= 3 ? '#f0fdf4' : '#fafafa',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 26 }}>{images.length >= 3 ? '✅' : '📷'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: images.length >= 3 ? '#166534' : '#94a3b8' }}>
                  {images.length > 0 ? `تم اختيار ${images.length} صور` : 'اضغط لإضافة صور (مطلوب 3 على الأقل)'}
                </span>
              </label>
              <input type="file" accept="image/*" multiple id="images" onChange={handleImages} style={{ display: 'none' }} />
            </div>
            {/* ── VIDEO TOUR (Optional) ─────────────────────────── */}
            <div style={{
              border: '1.5px dashed #c4b5fd',
              borderRadius: 14,
              padding: '1rem',
              background: '#faf5ff',
            }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                🎬 رابط فيديو المعاينة
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  background: '#7c3aed', borderRadius: 20, padding: '2px 10px',
                }}>اختياري</span>
              </label>
              <p style={{ fontSize: 11, color: '#7c3aed', margin: '0 0 10px', fontWeight: 600 }}>
                يُقبل روابط YouTube أو TikTok — يجذب المستأجرين أكثر بـ 3x ✨
              </p>

              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=... أو https://vm.tiktok.com/..."
                  value={videoUrl}
                  onChange={e => { setVideoUrl(e.target.value); setVideoPreview(false) }}
                  style={{
                    ...inputStyle,
                    background: '#fff',
                    borderColor: videoUrlInvalid ? '#dc2626' : embedUrl ? '#7c3aed' : '#c4b5fd',
                    paddingLeft: 44,
                    direction: 'ltr',
                    textAlign: 'right',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.background = '#fff' }}
                  onBlur={e => {
                    e.target.style.borderColor = videoUrlInvalid ? '#dc2626' : embedUrl ? '#7c3aed' : '#c4b5fd'
                    e.target.style.background = '#fff'
                  }}
                />
                {/* ── 1. تنبيه روابط فيسبوك/مشاركة المختصرة (إضافة جديدة) ── */}
                {(videoUrl.includes('share') || videoUrl.includes('fb.watch')) && (
                  <div style={{ 
                    marginTop: 10, 
                    padding: '10px 12px', 
                    background: '#fff7ed', 
                    border: '1px solid #ffedd5', 
                    borderRadius: 10,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start'
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <p style={{ fontSize: 11, color: '#9a3412', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                      روابط "المشاركة" المختصرة قد لا تعمل في المعاينة. يفضل نسخ الرابط المباشر للفيديو من المتصفح والتأكد أنه "عام" (Public).
                    </p>
                  </div>
                )}

                {/* ── 2. تنبيه الرابط غير المدعوم نهائياً ── */}
                {videoUrlInvalid && !videoUrl.includes('share') && (
                  <p style={{ 
                    fontSize: 12, 
                    color: '#dc2626', 
                    margin: '8px 0 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4,
                    fontWeight: 600 
                  }}>
                    ⚠️ رابط غير مدعوم — يُرجى استخدام روابط (YouTube, TikTok, Facebook, أو Google Drive)
                  </p>
                )}
                <span style={{
                  position: 'absolute', 
                  left: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  fontSize: 18, 
                  pointerEvents: 'none',
                }}>
                  {videoUrl.toLowerCase().includes('tiktok') ? '🎵' : 
                  videoUrl.toLowerCase().includes('drive.google') ? '📁' : 
                  videoUrl.toLowerCase().includes('facebook') || videoUrl.toLowerCase().includes('fb.watch') ? '🔵' : 
                  '▶️'}
                </span>
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => { setVideoUrl(''); setVideoPreview(false) }}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14,
                    }}>✕</button>
                )}
              </div>

              {/* Validation feedback */}
              {videoUrlInvalid && (
                <p style={{ 
                  fontSize: 12, 
                  color: '#dc2626', 
                  margin: '6px 0 0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4,
                  fontWeight: 600 
                }}>
                  ⚠️ رابط غير مدعوم — يُرجى استخدام روابط (YouTube, TikTok, Facebook, أو Google Drive)
                </p>
              )}

              {embedUrl && !videoUrlInvalid && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✅ رابط صحيح</span>
                  <button
                    type="button"
                    onClick={() => setVideoPreview(v => !v)}
                    style={{
                      background: '#ede9fe', color: '#7c3aed',
                      border: '1px solid #c4b5fd', borderRadius: 8,
                      padding: '4px 12px', fontFamily: 'Cairo, sans-serif',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>
                    {videoPreview ? '🙈 إخفاء المعاينة' : '👁️ معاينة الفيديو'}
                  </button>
                </div>
              )}

              {/* ── Iframe Preview ── */}
              {videoPreview && embedUrl && (
                <div style={{
                  marginTop: 14,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '2px solid #c4b5fd',
                  boxShadow: '0 8px 32px rgba(124,58,237,0.15)',
                  position: 'relative',
                  // TikTok is portrait (9:16), YouTube is landscape (16:9)
                  paddingBottom: isTikTok ? '177.78%' : '56.25%',
                  background: '#000',
                }}>
                  <iframe
                    src={embedUrl}
                    title="معاينة فيديو العقار"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      border: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                padding: '15px',
                fontSize: 15, fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Cairo, sans-serif',
                marginTop: 4,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(22,163,74,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ جاري الرفع...' : '🚀 رفع الإعلان'}
            </button>

          </form>
        </div>

        {/* INFO NOTE */}
        <div style={{
          marginTop: '1rem',
          background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
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