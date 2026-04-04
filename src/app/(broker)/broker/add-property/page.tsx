'use client'
import { useState } from 'react'
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

export default function AddPropertyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    unit_type: '',
    address: '',
  })

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files).slice(0, 5))
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
            <p style={{ fontSize: 13, fontWeight: 800, color: '#14532d', margin: 0 }}>أول إعلانين مجاناً بالكامل</p>
            <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>الإعلانات التالية بـ 50 ج.م — تُخصم فقط عند الموافقة</p>
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

            {/* UNIT TYPE — Button Grid */}
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
                صور العقار{' '}
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(حتى 5 صور — اختياري)</span>
              </label>
              <label
                htmlFor="images"
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: images.length > 0 ? '2px solid #16a34a' : '2px dashed #d1d5db',
                  borderRadius: 14, padding: '1.25rem',
                  cursor: 'pointer',
                  background: images.length > 0 ? '#f0fdf4' : '#fafafa',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 26 }}>{images.length > 0 ? '✅' : '📷'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: images.length > 0 ? '#166534' : '#94a3b8' }}>
                  {images.length > 0 ? `تم اختيار ${images.length} صورة` : 'اضغط لإضافة صور'}
                </span>
                {images.length === 0 && (
                  <span style={{ fontSize: 11, color: '#cbd5e1' }}>JPG, PNG مقبولة</span>
                )}
              </label>
              <input type="file" accept="image/*" multiple id="images" onChange={handleImages} style={{ display: 'none' }} />
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