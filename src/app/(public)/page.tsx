'use client'
import { useEffect, useState, useRef } from 'react'

const MOCK_PROPERTIES = [
  { id: 1, title: 'شقة فاخرة بالمنصورة', description: 'شقة مفروشة بالكامل، تكييف، أمن 24 ساعة، قريبة من الجامعة', price: 1800, area: 'المنصورة', address: 'شارع الجمهورية، بجوار الكلية', unit_type: 'student', images: [], profiles: { name: 'أحمد محمد', phone: '01001234567' } },
  { id: 2, title: 'سكن عائلي القاهرة الجديدة', description: '3 غرف نوم، صالة، 2 حمام، موقف سيارات', price: 4500, area: 'القاهرة', address: 'مدينة نصر، شارع عباس العقاد', unit_type: 'family', images: [], profiles: { name: 'سارة خالد', phone: '01112345678' } },
  { id: 3, title: 'ستوديو مودرن الإسكندرية', description: 'ستوديو مؤثث بالكامل، إطلالة بحرية، قريب من الكورنيش', price: 2200, area: 'الإسكندرية', address: 'سموحة، بالقرب من الكورنيش', unit_type: 'studio', images: [], profiles: { name: 'محمد علي', phone: '01234567890' } },
  { id: 4, title: 'غرفة مشتركة أسيوط', description: 'غرف مشتركة للطلاب، إنترنت مجاني، أمن', price: 600, area: 'أسيوط', address: 'بجوار جامعة أسيوط', unit_type: 'shared', images: [], profiles: { name: 'فاطمة حسن', phone: '01098765432' } },
  { id: 5, title: 'شقة سكن طلاب المنيا', description: 'سكن طلابي مجهز، غسالة مشتركة، كهرباء وماء مدفوع', price: 900, area: 'المنيا', address: 'بجوار كلية الطب', unit_type: 'student', images: [], profiles: { name: 'كريم سعيد', phone: '01122334455' } },
  { id: 6, title: 'فيلا سكنية الجيزة', description: '5 غرف، حديقة، حمام سباحة، في منطقة هادئة', price: 12000, area: 'الجيزة', address: 'المهندسين، شارع الجيزة الرئيسي', unit_type: 'family', images: [], profiles: { name: 'لميس إبراهيم', phone: '01055667788' } },
]

const AREAS = ['الكل', 'المنصورة', 'القاهرة', 'الإسكندرية', 'الجيزة', 'أسيوط', 'سوهاج', 'المنيا']
const TYPES = [
  { value: '', label: 'كل الأنواع' },
  { value: 'student', label: 'سكن طلاب' },
  { value: 'family', label: 'سكن عائلي' },
  { value: 'studio', label: 'ستوديو' },
  { value: 'shared', label: 'مشترك' },
]
const TYPE_LABELS = { student: 'سكن طلاب', family: 'سكن عائلي', studio: 'ستوديو', shared: 'مشترك' }
const TYPE_COLORS = {
  student: { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  family: { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
  studio: { bg: '#fdf4ff', color: '#7e22ce', border: '#d8b4fe' },
  shared: { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
}

const UNIT_ICONS = {
  student: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:18,height:18}}>
      <path d="M12 3L1 9l11 6 9-4.91V17M5 13.18v4L12 21l7-3.82v-4"/>
    </svg>
  ),
  family: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:18,height:18}}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  studio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:18,height:18}}>
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
    </svg>
  ),
  shared: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:18,height:18}}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
}

function PropertyCard({ property, index, onClick }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  const tc = TYPE_COLORS[property.unit_type] || TYPE_COLORS.family

  return (
    <div
      ref={ref}
      onClick={() => onClick(property)}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        opacity: visible ? 1 : 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(6, 95, 70, 0.12)'
        e.currentTarget.style.borderColor = '#6ee7b7'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        e.currentTarget.style.borderColor = '#e5e7eb'
      }}
    >
      <div style={{
        height: 180,
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 64, height: 64,
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#065f46',
        }}>
          {UNIT_ICONS[property.unit_type]}
        </div>
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: tc.bg,
          color: tc.color,
          border: `1px solid ${tc.border}`,
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {TYPE_LABELS[property.unit_type]}
        </div>
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
          {property.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
          <svg viewBox="0 0 20 20" fill="currentColor" style={{width:13,height:13,color:'#10b981'}}>
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
          <span>{property.area} — {property.address}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#065f46' }}>{property.price.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 3 }}>ج.م / شهر</span>
          </div>
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #6ee7b7',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            transition: 'all 0.2s',
          }}>
            تفاصيل
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicPage() {
  const [properties] = useState(MOCK_PROPERTIES)
  const [area, setArea] = useState('الكل')
  const [type, setType] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone: '' })
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  const filtered = properties.filter(p => {
    if (area !== 'الكل' && p.area !== area) return false
    if (type && p.unit_type !== type) return false
    if (maxPrice && p.price > Number(maxPrice)) return false
    if (searchQuery && !p.title.includes(searchQuery) && !p.area.includes(searchQuery)) return false
    return true
  })

  const stats = [
    { value: '٢٠٠+', label: 'عقار متاح' },
    { value: '٥٠+', label: 'سمسار موثوق' },
    { value: '٨', label: 'مدن مصرية' },
    { value: '١٠٠٪', label: 'إعلانات مراجعة' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Cairo, Tajawal, sans-serif', direction: 'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #9ca3af; }
        .filter-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: 10px center; }
        .pulse-dot { animation: pulse-ring 2s ease infinite; }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-overlay { animation: fade-in 0.25s ease; }
        .modal-panel { animation: slide-up-modal 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up-modal { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #065f46, #10b981)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="white" style={{width:18,height:18}}>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22" fill="none" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#065f46', letterSpacing: '-0.5px' }}>أجرلي</span>
        </div>
        <a href="/login" style={{
          background: '#065f46',
          color: 'white',
          borderRadius: 10,
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          transition: 'all 0.2s',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.target.style.background = '#047857'}
        onMouseLeave={e => e.target.style.background = '#065f46'}
        >
          دخول السمسار
        </a>
      </nav>

      {/* HERO */}
      <div style={{
        background: 'linear-gradient(160deg, #022c22 0%, #064e3b 40%, #065f46 100%)',
        padding: '72px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        {[{top:'10%',left:'5%',size:200,op:0.04},{top:'60%',left:'80%',size:300,op:0.05},{top:'-20%',left:'60%',size:400,op:0.03}].map((c,i) => (
          <div key={i} style={{
            position: 'absolute', top: c.top, left: c.left,
            width: c.size, height: c.size,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${c.op * 3})`,
            background: `rgba(255,255,255,${c.op})`,
            pointerEvents: 'none',
            animation: `float ${3+i}s ease-in-out infinite`,
          }}/>
        ))}

        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20,
            padding: '6px 16px',
            marginBottom: 24,
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'none' : 'translateY(-10px)',
            transition: 'all 0.6s ease 0.1s',
          }}>
            <div className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399' }}/>
            <span style={{ color: '#a7f3d0', fontSize: 12, fontWeight: 600 }}>+١٠٠ عقار نشط الآن</span>
          </div>

          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(28px, 5vw, 52px)',
            fontWeight: 900,
            lineHeight: 1.2,
            margin: '0 0 16px',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'none' : 'translateY(20px)',
            transition: 'all 0.7s ease 0.2s',
          }}>
            اعثر على سكنك المثالي <span style={{ color: '#34d399' }}>بسهولة</span>
          </h1>

          <p style={{
            color: '#a7f3d0',
            fontSize: 16,
            lineHeight: 1.8,
            margin: '0 0 36px',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'none' : 'translateY(16px)',
            transition: 'all 0.7s ease 0.35s',
          }}>
            منصة أجرلي — آلاف العقارات السكنية في مصر، سمسارة موثوقة، تواصل فوري
          </p>

          {/* Search bar */}
          <div style={{
            display: 'flex',
            gap: 10,
            maxWidth: 560,
            margin: '0 auto',
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'none' : 'translateY(16px)',
            transition: 'all 0.7s ease 0.45s',
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="ابحث عن مدينة أو منطقة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', border: 'none', borderRadius: 12,
                  padding: '14px 44px 14px 16px',
                  fontSize: 14, fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#111827',
                  outline: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}
              />
            </div>
            <button style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '14px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = '#059669'}
            onMouseLeave={e => e.target.style.background = '#10b981'}
            >
              بحث
            </button>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '20px 24px',
      }}>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              textAlign: 'center',
              padding: '0 16px',
              borderLeft: i < 3 ? '1px solid #e5e7eb' : 'none',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46', fontFamily: 'inherit' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* FILTERS */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: '16px 20px',
          marginBottom: 28,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginLeft: 4 }}>تصفية:</span>

          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            className="filter-select"
            style={{
              border: '1.5px solid #e5e7eb',
              borderRadius: 10,
              padding: '8px 32px 8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#374151',
              background: 'white',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: area !== 'الكل' ? 700 : 400,
              borderColor: area !== 'الكل' ? '#6ee7b7' : '#e5e7eb',
              transition: 'all 0.2s',
            }}
          >
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="filter-select"
            style={{
              border: '1.5px solid #e5e7eb',
              borderRadius: 10,
              padding: '8px 32px 8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#374151',
              background: 'white',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: type ? 700 : 400,
              borderColor: type ? '#6ee7b7' : '#e5e7eb',
              transition: 'all 0.2s',
            }}
          >
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af', pointerEvents: 'none' }}>ج.م</span>
            <input
              type="number"
              placeholder="أقصى سعر"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              style={{
                border: `1.5px solid ${maxPrice ? '#6ee7b7' : '#e5e7eb'}`,
                borderRadius: 10,
                padding: '8px 28px 8px 12px',
                fontSize: 13,
                fontFamily: 'inherit',
                width: 130,
                outline: 'none',
                color: '#374151',
              }}
            />
          </div>

          {(area !== 'الكل' || type || maxPrice) && (
            <button
              onClick={() => { setArea('الكل'); setType(''); setMaxPrice('') }}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginRight: 'auto',
              }}
            >
              مسح الفلتر ✕
            </button>
          )}

          <div style={{ marginRight: 'auto', fontSize: 13, color: '#6b7280' }}>
            <span style={{ fontWeight: 700, color: '#065f46' }}>{filtered.length}</span> عقار
          </div>
        </div>

        {/* PROPERTY GRID */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
            <p style={{ fontSize: 16 }}>مفيش إعلانات بالمواصفات دي</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {filtered.map((p, i) => (
              <PropertyCard
                key={p.id}
                property={p}
                index={i}
                onClick={setSelectedProperty}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {selectedProperty && (
        <div
          className="modal-overlay"
          onClick={() => { setSelectedProperty(null); setLeadSubmitted(false); setLeadForm({ name: '', phone: '' }) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            className="modal-panel"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 20,
              width: '100%', maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal hero */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              padding: '32px 24px 24px',
              borderBottom: '1px solid #e5e7eb',
              position: 'relative',
            }}>
              <button
                onClick={() => { setSelectedProperty(null); setLeadSubmitted(false); setLeadForm({ name: '', phone: '' }) }}
                style={{
                  position: 'absolute', top: 16, left: 16,
                  width: 32, height: 32,
                  borderRadius: 8,
                  border: '1px solid #d1fae5',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#374151',
                }}
              >✕</button>

              <div style={{
                width: 56, height: 56,
                background: 'white',
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#065f46',
                marginBottom: 12,
                boxShadow: '0 2px 8px rgba(6,95,70,0.15)',
              }}>
                {UNIT_ICONS[selectedProperty.unit_type]}
              </div>

              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
                {selectedProperty.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 13 }}>
                <svg viewBox="0 0 20 20" fill="#10b981" style={{width:13,height:13}}>
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                </svg>
                {selectedProperty.area} — {selectedProperty.address}
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
              }}>
                <div style={{ flex: 1, background: '#ecfdf5', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>السعر الشهري</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#065f46' }}>{selectedProperty.price.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: '#f9fafb', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>نوع الوحدة</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{TYPE_LABELS[selectedProperty.unit_type]}</div>
                </div>
              </div>

              {selectedProperty.description && (
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, marginBottom: 20, borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
                  {selectedProperty.description}
                </p>
              )}

              {!leadSubmitted ? (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>
                    أدخل بياناتك للتواصل مع السمسار
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="اسمك الكامل"
                      required
                      value={leadForm.name}
                      onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
                      style={{
                        border: '1.5px solid #e5e7eb',
                        borderRadius: 10,
                        padding: '12px 14px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        width: '100%',
                        transition: 'border 0.2s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#10b981'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <input
                      type="tel"
                      placeholder="رقم هاتفك"
                      required
                      value={leadForm.phone}
                      onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                      style={{
                        border: '1.5px solid #e5e7eb',
                        borderRadius: 10,
                        padding: '12px 14px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        width: '100%',
                        transition: 'border 0.2s',
                      }}
                      onFocus={e => e.target.style.borderColor = '#10b981'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <button
                      onClick={() => leadForm.name && leadForm.phone && setLeadSubmitted(true)}
                      style={{
                        background: '#25D366',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        padding: '14px',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1da851'}
                      onMouseLeave={e => e.currentTarget.style.background = '#25D366'}
                    >
                      <svg viewBox="0 0 24 24" fill="white" style={{width:18,height:18}}>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      تواصل مع السمسار على واتساب
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #6ee7b7',
                  borderRadius: 12,
                  padding: '20px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#065f46', margin: 0 }}>جاري تحويلك لواتساب السمسار...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{
        background: '#022c22',
        color: '#a7f3d0',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="white" style={{width:14,height:14}}>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>أجرلي</span>
        </div>
        <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>© 2025 أجرلي — منصة الإيجار العقاري المصرية</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>سياسة الخصوصية</a>
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>الشروط والأحكام</a>
          <a href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>تواصل معنا</a>
          <a href="/about" style={{ color: 'inherit', textDecoration: 'none' }}>من نحن</a>
        </div>
      </footer>
    </div>
  )
}
