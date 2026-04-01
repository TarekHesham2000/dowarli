'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Property = {
  id: number
  title: string
  description: string
  price: number
  area: string
  address: string
  unit_type: string
  images: string[]
  profiles: { name: string; phone: string }
}

const AREAS = ['الكل', 'المنصورة', 'القاهرة', 'الإسكندرية', 'الجيزة', 'أسيوط', 'سوهاج', 'المنيا']
const TYPES = [
  { value: '', label: 'الكل' },
  { value: 'student', label: 'سكن طلاب' },
  { value: 'family', label: 'سكن عائلي' },
  { value: 'studio', label: 'ستوديو' },
  { value: 'shared', label: 'مشترك' },
]

export default function PublicPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('الكل')
  const [type, setType] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone: '' })
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadLoading, setLeadLoading] = useState(false)

  useEffect(() => { loadProperties() }, [area, type, maxPrice])

  const loadProperties = async () => {
    setLoading(true)
    let query = supabase
      .from('properties')
      .select('id, title, description, price, area, address, unit_type, images, profiles(name, phone)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (area !== 'الكل') query = query.eq('area', area)
    if (type) query = query.eq('unit_type', type)
    if (maxPrice) query = query.lte('price', Number(maxPrice))

    const { data } = await query
    setProperties((data as unknown as Property[]) ?? [])
    setLoading(false)
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProperty) return
    setLeadLoading(true)

    await supabase.from('leads').insert({
      property_id: selectedProperty.id,
      client_name: leadForm.name,
      client_phone: leadForm.phone,
    })

    setLeadSubmitted(true)
    setLeadLoading(false)

    setTimeout(() => {
      const phone = selectedProperty.profiles?.phone
      const message = `أنا مهتم بالعقار رقم ${selectedProperty.id} المعروض على أجرلي`
const cleanPhone = phone?.replace(/\D/g, '') ?? ''
const waPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone
window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message), '_blank')}, 500)
  }

  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      <div className='bg-white shadow-sm px-6 py-4 flex justify-between items-center'>
        <h1 className='text-xl font-bold text-blue-600'>أجرلي 🏠</h1>
        <div className='flex gap-3'>
          <a href='/login' className='text-sm text-blue-600 hover:underline'>دخول السمسار</a>
        </div>
      </div>

      {selectedProperty && (
        <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50' onClick={() => { setSelectedProperty(null); setLeadSubmitted(false); setLeadForm({ name: '', phone: '' }) }}>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto' onClick={e => e.stopPropagation()}>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='font-bold text-lg'>{selectedProperty.title}</h2>
              <button onClick={() => { setSelectedProperty(null); setLeadSubmitted(false); setLeadForm({ name: '', phone: '' }) }} className='text-gray-400 text-xl'>✕</button>
            </div>
            {selectedProperty.images?.length > 0 && (
              <div className='grid grid-cols-3 gap-2 mb-4'>
                {selectedProperty.images.map((img, i) => (
                  <img key={i} src={img} alt='property' className='w-full h-24 object-cover rounded-lg' />
                ))}
              </div>
            )}
            <div className='space-y-1 text-sm text-gray-600 mb-4'>
              <p>📍 {selectedProperty.area} — {selectedProperty.address}</p>
              <p>💰 {selectedProperty.price} ج.م / شهر</p>
              {selectedProperty.description && <p>📝 {selectedProperty.description}</p>}
            </div>
            {!leadSubmitted ? (
              <div className='border-t pt-4'>
                <p className='font-bold text-sm mb-3'>أدخل بياناتك للتواصل مع السمسار</p>
                <form onSubmit={handleLeadSubmit} className='space-y-3'>
                  <input
                    type='text'
                    placeholder='اسمك'
                    required
                    className='w-full border rounded-lg p-3 text-right text-sm'
                    value={leadForm.name}
                    onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
                  />
                  <input
                    type='tel'
                    placeholder='رقم هاتفك'
                    required
                    className='w-full border rounded-lg p-3 text-right text-sm'
                    value={leadForm.phone}
                    onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                  />
                  <button type='submit' disabled={leadLoading} className='w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50'>
                    {leadLoading ? 'جاري الإرسال...' : 'تواصل مع السمسار على واتساب'}
                  </button>
                </form>
              </div>
            ) : (
              <div className='border-t pt-4 text-center'>
                <p className='text-green-600 font-bold'>✅ جاري تحويلك لواتساب السمسار...</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className='max-w-5xl mx-auto px-4 py-8'>
        <div className='bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap gap-3'>
          <select className='border rounded-lg p-2 text-sm' value={area} onChange={e => setArea(e.target.value)}>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className='border rounded-lg p-2 text-sm' value={type} onChange={e => setType(e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type='number' placeholder='أقصى سعر' className='border rounded-lg p-2 text-sm w-32' value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>

        {loading ? (
          <p className='text-center text-gray-400 py-12'>جاري التحميل...</p>
        ) : properties.length === 0 ? (
          <p className='text-center text-gray-400 py-12'>مفيش إعلانات في المنطقة دي</p>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {properties.map(p => (
              <div key={p.id} onClick={() => setSelectedProperty(p)} className='bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition'>
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className='w-full h-48 object-cover' />
                ) : (
                  <div className='w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400'>لا توجد صورة</div>
                )}
                <div className='p-4'>
                  <h3 className='font-bold text-sm mb-1'>{p.title}</h3>
                  <p className='text-gray-500 text-xs mb-2'>📍 {p.area}</p>
                  <p className='text-blue-600 font-bold'>{p.price} ج.م / شهر</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}