'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

type UnitType = 'student' | 'family' | 'studio' | 'shared'

type Property = {
  id: number
  title: string
  description: string
  price: number
  area: string
  address: string
  unit_type: UnitType
  images: string[]
  status: string
  profiles: { name: string; phone: string }
}

const TYPE_LABELS: Record<UnitType, string> = {
  student: 'سكن طلاب',
  family: 'سكن عائلي',
  studio: 'ستوديو',
  shared: 'مشترك',
}

const TYPE_COLORS: Record<UnitType, { bg: string; color: string; border: string }> = {
  student: { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  family:  { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
  studio:  { bg: '#fdf4ff', color: '#7e22ce', border: '#d8b4fe' },
  shared:  { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
}

export default function PropertyPage() {
  const { id } = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [leadForm, setLeadForm] = useState({ name: '', phone: '' })
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadLoading, setLeadLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, title, description, price, area, address, unit_type, images, status, profiles(name, phone)')
        .eq('id', id)
        .single()
      setProperty(data as unknown as Property)
      setLoading(false)
    }
    load()
  }, [id])

  const handleLeadSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!property) return
    setLeadLoading(true)

    await supabase.from('leads').insert({
      property_id: property.id,
      client_name: leadForm.name,
      client_phone: leadForm.phone,
    })

    setLeadSubmitted(true)
    setLeadLoading(false)

    setTimeout(() => {
      const phone = property.profiles?.phone
      const cleanPhone = phone?.replace(/\D/g, '') ?? ''
      const waPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone
      const message = `أنا مهتم بالعقار "${property.title}" في ${property.area}. الرجاء التواصل معي.    \nالاسم: ${leadForm.name}\nرقم الهاتف: ${leadForm.phone}`
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message), '_blank')
    }, 500)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #dcfce7', borderTop: '3px solid #166534', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b' }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!property) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 48 }}>🏠</p>
        <p style={{ color: '#64748b', fontSize: 16 }}>الإعلان غير موجود</p>
        <button onClick={() => router.push('/')} style={{ marginTop: 16, background: '#166534', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>العودة للرئيسية</button>
      </div>
    </div>
  )

  const colors = TYPE_COLORS[property.unit_type] ?? TYPE_COLORS.family

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e8f5e9', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1B783C' }}>أجرلي</div>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '7px 18px', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>← رجوع</button>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>

          {/* RIGHT COLUMN - Images + Details */}
          <div>
            {/* Main Image */}
            {property.images?.length > 0 ? (
              <div>
                <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, background: '#f1f5f9', height: 380 }}>
                  <img src={property.images[selectedImage]} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                {property.images.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {property.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt=""
                        onClick={() => setSelectedImage(i)}
                        style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: selectedImage === i ? '2px solid #1B783C' : '2px solid transparent', flexShrink: 0 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: 380, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, marginBottom: 12 }}>🏠</div>
            )}

            {/* Details Card */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #e5e7eb', marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>تفاصيل العقار</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'المنطقة', value: property.area, icon: '📍' },
                  { label: 'نوع الوحدة', value: TYPE_LABELS[property.unit_type], icon: '🏠' },
                  { label: 'العنوان', value: property.address, icon: '🗺️' },
                  { label: 'السعر الشهري', value: `${property.price?.toLocaleString()} ج.م`, icon: '💰' },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px' }}>{item.icon} {item.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {property.description && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>وصف العقار</h3>
                  <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.9, margin: 0 }}>{property.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* LEFT COLUMN - Price + Contact */}
          <div style={{ position: 'sticky', top: 80 }}>

            {/* Price Card */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '1rem' }}>
              <span style={{ display: 'inline-block', background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '4px 12px', marginBottom: 12 }}>
                {TYPE_LABELS[property.unit_type]}
              </span>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', lineHeight: 1.3 }}>{property.title}</h1>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 1.25rem' }}>📍 {property.area} — {property.address}</p>
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>السعر الشهري</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: '#1B783C', margin: 0 }}>{property.price?.toLocaleString()} <span style={{ fontSize: 16, fontWeight: 400, color: '#94a3b8' }}>ج.م</span></p>
              </div>
            </div>

            {/* Contact Form */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>تواصل مع المالك</h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 1.25rem' }}>أدخل بياناتك وسنوصلك بالمالك فوراً</p>

              {!leadSubmitted ? (
                <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="text"
                    placeholder="اسمك الكامل"
                    required
                    value={leadForm.name}
                    onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
                    style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#1B783C'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <input
                    type="tel"
                    placeholder="رقم هاتفك"
                    required
                    value={leadForm.phone}
                    onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                    style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#1B783C'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <button
                    type="submit"
                    disabled={leadLoading}
                    style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
                  >
                    {leadLoading ? 'جاري الإرسال...' : '💬 تواصل عبر واتساب'}
                  </button>
                </form>
              ) : (
                <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#065f46', margin: 0 }}>✅ جاري تحويلك لواتساب المالك...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}