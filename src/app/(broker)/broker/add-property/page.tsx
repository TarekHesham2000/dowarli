'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AREAS = ['المنصورة', 'القاهرة', 'الإسكندرية', 'الجيزة', 'أسيوط', 'سوهاج', 'المنيا']
const UNIT_TYPES = [
  { value: 'student', label: 'سكن طلاب' },
  { value: 'family', label: 'سكن عائلي' },
  { value: 'studio', label: 'ستوديو' },
  { value: 'shared', label: 'مشترك' },
]

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
    if (e.target.files) {
      setImages(Array.from(e.target.files).slice(0, 5))
    }
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
      // 1. جيب اليوزر
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 2. تحقق من الحساب والرصيد
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

      // ✅ جلب تكلفة الإعلان من settings ديناميكياً
      const { data: costSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'listing_cost')
        .single()

      const listingCost = Number(costSetting?.value ?? 50)

      // 3. احسب عدد الإعلانات
      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .in('status', ['active', 'pending'])

      const publishedCount = count ?? 0
      const isFree = publishedCount < 2

      // 4. تحقق من الرصيد لو مش مجاني
      if (!isFree && profile.wallet_balance < listingCost) {
        setError(`رصيدك غير كافٍ ❌ — رصيدك الحالي ${profile.wallet_balance} ج.م، تحتاج ${listingCost} ج.م`)
        setLoading(false)
        return
      }

      // 5. ارفع الإعلان
      const insertResult = await supabase
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
          was_charged: !isFree,
          images: [],
        })
        .select('id')
        .single()

      if (insertResult.error) {
        setError(insertResult.error.message)
        setLoading(false)
        return
      }

      const propertyId = insertResult.data.id

      // 6. ارفع الصور
      if (images.length > 0) {
        const imageUrls = await uploadImages(propertyId)
        await supabase
          .from('properties')
          .update({ images: imageUrls })
          .eq('id', propertyId)
      }

      // 7. اخصم الرصيد لو مدفوع
      if (!isFree) {
        await supabase.rpc('deduct_wallet', { user_id: user.id, amount: listingCost })
      }

      router.push('/broker')

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('حدث خطأ غير متوقع، حاول مرة أخرى')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: 'inherit', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ fontSize: 22, fontWeight: 900, color: '#065f46', textDecoration: 'none' }}>أجرلي</a>
          <span style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', color: '#065f46', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid #bbf7d0' }}>إعلان جديد</span>
        </div>
        <button onClick={() => router.push('/broker')} style={{ background: 'none', border: 'none', color: '#065f46', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#047857'} onMouseLeave={e => e.currentTarget.style.color = '#065f46'}>
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ background: '#ffffff', borderRadius: 20, padding: '2rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>رفع عقار جديد 🏠</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 1.5rem', fontWeight: 500 }}>أول إعلانين مجاناً — بعد كده 50 ج.م للإعلان</p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626', marginBottom: '1.5rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>عنوان الإعلان</label>
              <input
                type="text"
                placeholder="مثال: شقة مفروشة في المنصورة"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.3s ease', background: '#ffffff' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>وصف العقار</label>
              <textarea
                placeholder="اكتب تفاصيل العقار..."
                rows={4}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', transition: 'all 0.3s ease', background: '#ffffff' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>السعر الشهري (ج.م)</label>
              <input
                type="number"
                placeholder="مثال: 2000"
                required
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.3s ease', background: '#ffffff' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>المنطقة</label>
              <select
                required
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#ffffff', transition: 'all 0.3s ease' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              >
                <option value="">اختار المنطقة</option>
                {AREAS.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>العنوان التفصيلي</label>
              <input
                type="text"
                placeholder="مثال: شارع النصر، بجوار المسجد"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.3s ease', background: '#ffffff' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>نوع الوحدة</label>
              <select
                required
                value={form.unit_type}
                onChange={e => setForm({ ...form, unit_type: e.target.value })}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#ffffff', transition: 'all 0.3s ease' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              >
                <option value="">اختار النوع</option>
                {UNIT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>صور العقار (حتى 5 صور)</label>
              <label htmlFor="images" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #bbf7d0', borderRadius: 12, padding: '2rem 1rem', cursor: 'pointer', background: images.length > 0 ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : '#fafafa', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#065f46'; e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#bbf7d0'; if (images.length === 0) e.currentTarget.style.background = '#fafafa'; }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={images.length > 0 ? '#065f46' : '#94a3b8'} strokeWidth="2" style={{ width: 24, height: 24, transition: 'all 0.3s ease' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: images.length > 0 ? '#065f46' : '#94a3b8', transition: 'all 0.3s ease' }}>
                  {images.length > 0 ? `تم اختيار ${images.length} صورة ✅` : 'اضغط لرفع الصور'}
                </span>
              </label>
              <input type="file" accept="image/*" multiple id="images" onChange={handleImages} style={{ display: 'none' }} />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: loading ? 'linear-gradient(135deg, #d1fae5 0%, #c7f0e0 100%)' : 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: loading ? '#047857' : 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 8, transition: 'all 0.3s ease', boxShadow: loading ? 'none' : '0 4px 12px rgba(6, 95, 70, 0.2)' }} onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 95, 70, 0.3)'; } }} onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 95, 70, 0.2)'; } }}
            >
              {loading ? 'جاري الرفع...' : 'رفع الإعلان 🚀'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
