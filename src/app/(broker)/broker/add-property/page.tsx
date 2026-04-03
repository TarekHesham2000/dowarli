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
      const selected = Array.from(e.target.files).slice(0, 5)
      setImages(selected)
    }
  }

  const uploadImages = async (propertyId: number): Promise<string[]> => {
    const urls: string[] = []
    for (const image of images) {
      const fileName = `${propertyId}/${Date.now()}-${image.name}`
      const { error } = await supabase.storage
        .from('properties')
        .upload(fileName, image)
      if (!error) {
        const { data } = supabase.storage
          .from('properties')
          .getPublicUrl(fileName)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. جيب السمسار الحالي
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // 2. تحقق أن الحساب مازال نشط + هات الرصيد الحالي
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

    // 3. احسب كم إعلان عنده (منطق الـ 2 مجاناً)
    const { count } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .in('status', ['active', 'pending'])

    const publishedCount = count ?? 0
    const isFree = publishedCount < 2

    // 4. لو مش مجاني، تحقق من الرصيد
    if (!isFree) {
      if (profile.wallet_balance < 50) {
        setError(`رصيدك غير كافٍ ❌ — رصيدك الحالي ${profile?.wallet_balance ?? 0} ج.م، تحتاج 50 ج.م`)
        setLoading(false)
        return
      }
    }

    // 5. ارفع الإعلان
    const { data: property, error: propError } = await supabase
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
      .select()
      .single()

    if (propError) {
      setError(propError.message)
      setLoading(false)
      return
    }

    // 6. ارفع الصور
    if (images.length > 0) {
      const imageUrls = await uploadImages(property.id)
      await supabase
        .from('properties')
        .update({ images: imageUrls })
        .eq('id', property.id)
    }

    // 7. لو مدفوع، اخصم من الرصيد
    if (!isFree) {
      await supabase.rpc('deduct_wallet', { user_id: user.id, amount: 50 })
    }

    router.push('/broker')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">رفع عقار جديد 🏠</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="عنوان الإعلان"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            placeholder="وصف العقار"
            rows={3}
            className="w-full border rounded-lg p-3 text-right"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />

          <input
            type="number"
            placeholder="السعر (ج.م)"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
          />

          <select
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.area}
            onChange={e => setForm({ ...form, area: e.target.value })}
          >
            <option value="">اختار المنطقة</option>
            {AREAS.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="العنوان التفصيلي (مثال: المقطم، شارع النصر، بجوار المسجد)"
            className="w-full border rounded-lg p-3 text-right"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />

          <select
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.unit_type}
            onChange={e => setForm({ ...form, unit_type: e.target.value })}
          >
            <option value="">نوع الوحدة</option>
            {UNIT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImages}
              className="hidden"
              id="images"
            />
            <label htmlFor="images" className="cursor-pointer text-blue-600">
              📷 ارفع صور (حتى 5 صور)
            </label>
            {images.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                تم اختيار {images.length} صورة ✅
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'جاري الرفع...' : 'رفع الإعلان 🚀'}
          </button>
        </form>
      </div>
    </div>
  )
}