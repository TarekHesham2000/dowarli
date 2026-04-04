'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

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

const TYPE_META: Record<UnitType, { icon: string; accent: string; glow: string }> = {
  student: { icon: '🎓', accent: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  family:  { icon: '🏡', accent: '#60a5fa', glow: 'rgba(96,165,250,0.25)'  },
  studio:  { icon: '🛋️', accent: '#c084fc', glow: 'rgba(192,132,252,0.25)' },
  shared:  { icon: '🤝', accent: '#fb923c', glow: 'rgba(251,146,60,0.25)'  },
}

export default function PropertyPage() {
  const { id } = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [leadForm, setLeadForm]   = useState({ name: '', phone: '' })
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [leadLoading, setLeadLoading]     = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

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
      const phone      = property.profiles?.phone
      const cleanPhone = phone?.replace(/\D/g, '') ?? ''
      const waPhone    = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone
      const message    = `أنا مهتم بالعقار "${property.title}" في ${property.area}.\nالاسم: ${leadForm.name}\nرقم الهاتف: ${leadForm.phone}`
      window.open('https://wa.me/' + waPhone + '?text=' + encodeURIComponent(message), '_blank')
    }, 500)
  }

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', fontFamily: "'Cairo', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}} @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.15)', borderTop: '3px solid #10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 14, animation: 'pulse 1.5s ease infinite' }}>جاري التحميل...</p>
      </div>
    </div>
  )

  /* ── Not found ──────────────────────────────────────────── */
  if (!property) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', fontFamily: "'Cairo', sans-serif", direction: 'rtl' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🏚️</div>
        <p style={{ color: '#94a3b8', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>الإعلان غير موجود</p>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 24 }}>ربما تم حذف الإعلان أو الرابط غير صحيح</p>
        <button onClick={() => router.push('/')} style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif", boxShadow: '0 0 24px rgba(16,185,129,0.4)' }}>
          العودة للرئيسية
        </button>
      </div>
    </div>
  )

  const meta   = TYPE_META[property.unit_type] ?? TYPE_META.family
  const hasImg = property.images?.length > 0

  /* ── Main render ────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #020617; font-family: 'Cairo', sans-serif; }
        ::-webkit-scrollbar       { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 99px; }
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes shimmer { 0%,100%{opacity:.05} 50%{opacity:.12} }
        @keyframes wa-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.45)} 60%{box-shadow:0 0 0 12px rgba(37,211,102,0)} }
        .fade-up   { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) both; }
        .fade-up-2 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.1s both; }
        .fade-up-3 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.2s both; }
        .fade-up-4 { animation: fadeUp 0.55s cubic-bezier(.22,1,.36,1) 0.3s both; }
        .thumb:hover { opacity:.85; transform:scale(1.04); }
        .thumb { transition: opacity .2s, transform .2s, border-color .2s; }
        .wa-btn { animation: wa-pulse 2.2s ease infinite; }
        .wa-btn:hover { filter: brightness(1.1); transform:translateY(-1px); }
        .back-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .detail-item:hover { background: rgba(16,185,129,0.06) !important; border-color: rgba(16,185,129,0.2) !important; }
        input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important; outline: none !important; }
        @media (max-width: 768px) {
          .grid-layout { grid-template-columns: 1fr !important; }
          .sticky-col  { position: static !important; }
          .hero-img    { height: 260px !important; }
        }
      `}</style>

      <div dir="rtl" style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 120% 80% at 100% 0%, rgba(6,78,59,.18) 0%, #020617 55%)', color: '#f8fafc' }}>

        {/* ── Ambient glow ── */}
        <div aria-hidden style={{ position: 'fixed', bottom: 0, left: 0, width: 460, height: 460, background: 'radial-gradient(circle, rgba(16,185,129,.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* ══ NAV ══════════════════════════════════════════════ */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(2,6,23,.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 2rem', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff', boxShadow: '0 0 20px rgba(16,185,129,.5)', flexShrink: 0 }}>د</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>دَورلي<span style={{ color: '#10b981', fontSize: 12, fontWeight: 600, marginRight: 5 }}>Dowarly</span></span>
          </a>
          <button onClick={() => router.back()} className="back-btn" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s' }}>
            ← رجوع
          </button>
        </nav>

        {/* ══ CONTENT ══════════════════════════════════════════ */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem 6rem', position: 'relative', zIndex: 1 }}>

          {/* Type + Title breadcrumb */}
          <div className="fade-up" style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `rgba(${meta.accent === '#10b981' ? '16,185,129' : meta.accent === '#60a5fa' ? '96,165,250' : meta.accent === '#c084fc' ? '192,132,252' : '251,146,60'},.12)`, border: `1px solid ${meta.accent}40`, borderRadius: 99, fontSize: 12, fontWeight: 700, color: meta.accent, padding: '5px 14px' }}>
              {meta.icon} {TYPE_LABELS[property.unit_type]}
            </span>
            <span style={{ color: '#334155', fontSize: 13 }}>·</span>
            <span style={{ color: '#475569', fontSize: 13 }}>📍 {property.area}</span>
          </div>

          {/* ── Two-column grid ─────────────────────────────── */}
          <div className="grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>

            {/* ── LEFT: Images + Details ── */}
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
                      style={{ objectFit: 'cover', transition: 'opacity .35s', opacity: imgLoaded ? 1 : 0 }}
                      priority
                      onLoad={() => setImgLoaded(true)}
                    />
                    {/* Gradient overlay */}
                    <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,6,23,.65) 0%, transparent 50%)' }} />
                    {/* Image counter */}
                    {property.images.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(2,6,23,.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 12px' }}>
                        {activeImg + 1} / {property.images.length}
                      </div>
                    )}
                  </>
                ) : (
                  <div aria-hidden style={{ height: '100%', background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(5,150,105,.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 90 }}>🏠</div>
                )}
              </div>

              {/* Thumbnails */}
              {property.images.length > 1 && (
                <div className="fade-up-2" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 24 }}>
                  {property.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveImg(i); setImgLoaded(false); }}
                      className="thumb"
                      style={{ flexShrink: 0, width: 72, height: 54, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === activeImg ? meta.accent : 'transparent'}`, cursor: 'pointer', background: 'none', padding: 0, position: 'relative', boxShadow: i === activeImg ? `0 0 12px ${meta.glow}` : 'none' }}
                    >
                      <Image src={img} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Title (mobile shows here, desktop in sticky card) */}
              <div className="fade-up-2" style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: '0.5rem' }}>{property.title}</h1>
                <p style={{ fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={meta.accent}/><circle cx="12" cy="9" r="2.5" fill="#020617"/></svg>
                  {property.area} — {property.address}
                </p>
              </div>

              {/* Details grid */}
              <div className="fade-up-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: `${meta.accent}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>
                  تفاصيل العقار
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'المنطقة',      value: property.area,                       icon: '📍' },
                    { label: 'نوع الوحدة',   value: TYPE_LABELS[property.unit_type],    icon: meta.icon },
                    { label: 'العنوان التفصيلي', value: property.address,                icon: '🗺️' },
                    { label: 'السعر الشهري', value: `${property.price?.toLocaleString()} ج.م`, icon: '💰' },
                  ].map((item, i) => (
                    <div key={i} className="detail-item" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '14px 16px', transition: 'background .2s, border-color .2s', cursor: 'default' }}>
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

            {/* ── RIGHT: Sticky price + contact ── */}
            <div className="sticky-col" style={{ position: 'sticky', top: 88 }}>

              {/* Price card */}
              <div className="fade-up-2" style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem', marginBottom: '1rem', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
                {/* Type badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: `${meta.accent}18`, border: `1px solid ${meta.accent}40`, borderRadius: 99, fontSize: 12, fontWeight: 700, color: meta.accent, padding: '5px 14px', marginBottom: '1rem' }}>
                  {meta.icon} {TYPE_LABELS[property.unit_type]}
                </div>

                <h1 style={{ fontSize: 19, fontWeight: 900, color: '#fff', margin: '0 0 6px', lineHeight: 1.35 }}>{property.title}</h1>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 1.25rem', lineHeight: 1.6 }}>📍 {property.area} — {property.address}</p>

                {/* Price display */}
                <div style={{ background: `linear-gradient(135deg, ${meta.accent}14, ${meta.accent}08)`, border: `1px solid ${meta.accent}25`, borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px', fontWeight: 600 }}>السعر الشهري</p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: meta.accent, margin: 0, lineHeight: 1 }}>
                    {property.price?.toLocaleString()}
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#475569', marginRight: 6 }}>ج.م / شهر</span>
                  </p>
                </div>
              </div>

              {/* Contact card */}
              <div className="fade-up-3" style={{ background: 'rgba(10,20,38,.97)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: '1.6rem', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>تواصل مع المالك</h2>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 1.25rem', lineHeight: 1.6 }}>أدخل بياناتك وسنوصلك بالمالك فوراً عبر واتساب</p>

                {/* Divider */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)', marginBottom: '1.25rem' }} />

                {!leadSubmitted ? (
                  <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { type: 'text', placeholder: 'اسمك الكامل', key: 'name' as const },
                      { type: 'tel',  placeholder: 'رقم هاتفك',   key: 'phone' as const },
                    ].map(field => (
                      <input
                        key={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        required
                        value={leadForm[field.key]}
                        onChange={e => setLeadForm({ ...leadForm, [field.key]: e.target.value })}
                        style={{ background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.09)', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: "'Cairo', sans-serif", color: '#f8fafc', outline: 'none', transition: 'border-color .2s, box-shadow .2s' }}
                      />
                    ))}

                    <button
                      type="submit"
                      disabled={leadLoading}
                      className="wa-btn"
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
                  <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#10b981', margin: '0 0 4px' }}>تم إرسال طلبك بنجاح!</p>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>جاري تحويلك لواتساب المالك...</p>
                  </div>
                )}
              </div>

              {/* Share / Save row */}
              <div className="fade-up-4" style={{ marginTop: '0.75rem', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigator.share?.({ title: property.title, url: window.location.href }).catch(() => navigator.clipboard.writeText(window.location.href))}
                  style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px', fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s, color .2s' }}
                  onMouseEnter={e => { (e.currentTarget).style.color = '#94a3b8'; (e.currentTarget).style.background = 'rgba(255,255,255,.07)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.color = '#64748b'; (e.currentTarget).style.background = 'rgba(255,255,255,.04)'; }}
                >
                  🔗 مشاركة الإعلان
                </button>
                <button
                  onClick={() => router.push('/')}
                  style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px', fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", transition: 'background .2s, color .2s' }}
                  onMouseEnter={e => { (e.currentTarget).style.color = '#94a3b8'; (e.currentTarget).style.background = 'rgba(255,255,255,.07)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.color = '#64748b'; (e.currentTarget).style.background = 'rgba(255,255,255,.04)'; }}
                >
                  🏠 إعلانات أخرى
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════ */}
        <footer style={{ background: 'rgba(2,6,23,.98)', borderTop: '1px solid rgba(255,255,255,.05)', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: '0.2rem' }}>دَورلي <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>Dowarly</span></p>
          <p style={{ fontSize: 11, color: '#334155' }}>جميع الحقوق محفوظة © 2026 دَورلي</p>
        </footer>
      </div>
    </>
  )
}