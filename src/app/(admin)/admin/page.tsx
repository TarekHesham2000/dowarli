'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Property = {
  id: number
  title: string
  area: string
  price: number
  status: string
  images: string[]
  description: string
  address: string
  profiles: { name: string; phone: string; id: string }
}

type Transaction = {
  id: number
  amount: number
  screenshot_url: string
  status: string
  broker_id: string
  profiles: { name: string; phone: string }
}

type Broker = {
  id: string
  name: string
  phone: string
  wallet_balance: number
  is_active: boolean
  role?: string | null
  created_at: string
  properties_count?: number
}

type Lead = {
  id: number
  client_name: string
  client_phone: string
  created_at: string
  property_title?: string
  property_area?: string
}

type Stats = {
  totalBrokers: number
  publishedProperties: number
  rejectedProperties: number
  totalLeads: number
  pendingProperties: number
  pendingTransactions: number
}

type Tab = 'home' | 'properties' | 'brokers' | 'transactions' | 'leads' | 'settings'

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('home')
  const [stats, setStats] = useState<Stats>({
    totalBrokers: 0,
    publishedProperties: 0,
    rejectedProperties: 0,
    totalLeads: 0,
    pendingProperties: 0,
    pendingTransactions: 0,
  })
  const [properties, setProperties] = useState<Property[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectType, setRejectType] = useState<'property' | 'transaction'>('property')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [listingCost, setListingCost] = useState('50')
  const [bannerText, setBannerText] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all')
  const [authReady, setAuthReady] = useState(false)
  const [processingTransactionId, setProcessingTransactionId] = useState<number | null>(null)
  const [profilesError, setProfilesError] = useState('')

  async function loadAll() {
    try {
      const [propsRes, transRes, brokersRes, leadsRes, settingsRes] = await Promise.all([
        supabase.from('properties').select('id, title, area, price, status, images, description, address, profiles(name, phone, id)').order('created_at', { ascending: false }),
        supabase.from('transactions').select('id, amount, screenshot_url, status, broker_id, profiles(name, phone)').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, phone, wallet_balance, is_active, role, created_at').neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('leads').select('id, client_name, client_phone, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('settings').select('key, value'),
      ])

      if (brokersRes.error) {
        console.error('profiles error full:', JSON.stringify(brokersRes.error))
        console.error('profiles status:', brokersRes.status)
        setProfilesError(`${brokersRes.error.code ?? 'ERR'}: ${brokersRes.error.message ?? 'RLS blocking query'}`)
      } else {
        setProfilesError('')
      }

      if (leadsRes.error) {
        console.error('leads error:', JSON.stringify(leadsRes.error))
      }

      const props = (propsRes.data as unknown as Property[]) ?? []
      const trans = (transRes.data as unknown as Transaction[]) ?? []
      const allProfiles = (brokersRes.data as Broker[]) ?? []
      const brok = allProfiles.filter(b => b.role !== 'admin')
      const lds = (leadsRes.data as Lead[]) ?? []

      setProperties(props)
      setTransactions(trans)
      setBrokers(brok)
      setLeads(lds)

      if (settingsRes.data) {
        const cost = settingsRes.data.find(s => s.key === 'listing_cost')
        if (cost) setListingCost(cost.value)
        const banner = settingsRes.data.find(s => s.key === 'banner_text')
        setBannerText(banner?.value ?? '')
      }

      setStats({
        totalBrokers: brok.length,
        publishedProperties: props.filter(p => p.status === 'active').length,
        rejectedProperties: props.filter(p => p.status === 'rejected').length,
        totalLeads: lds.length,
        pendingProperties: props.filter(p => p.status === 'pending').length,
        pendingTransactions: trans.length,
      })
    } catch (err) {
      console.error('loadAll fatal error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert('غير مسموح لك بدخول هذه الصفحة')
        router.push('/broker')
        return
      }

      setAuthReady(true)
      loadAll()
    }

    checkAdmin()
  }, [router])

  const approveProperty = async (id: number) => {
    await supabase.from('properties').update({ status: 'active' }).eq('id', id)
    setSelectedProperty(null)
    loadAll()
  }

  const rejectProperty = async () => {
    if (!rejectId || !rejectReason) return
    await supabase.from('properties').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
    setRejectId(null)
    setRejectReason('')
    loadAll()
  }

  const approveTransaction = async (id: number, brokerId: string, amount: number) => {
    if (processingTransactionId) return

    setProcessingTransactionId(id)

    const { data: updatedRows, error: txError } = await supabase
      .from('transactions')
      .update({ status: 'verified' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')

    if (txError) {
      alert(`فشل تأكيد الشحنة: ${txError.message}`)
      setProcessingTransactionId(null)
      return
    }

    if (!updatedRows || updatedRows.length === 0) {
      alert('هذه الشحنة تم التعامل معها بالفعل')
      setTransactions(prev => prev.filter(t => t.id !== id))
      setProcessingTransactionId(null)
      return
    }

    const { error: walletError } = await supabase.rpc('add_wallet', { user_id: brokerId, amount })
    if (walletError) {
      alert(`تم تغيير حالة الشحنة لكن فشل إضافة الرصيد: ${walletError.message}`)
      setProcessingTransactionId(null)
      loadAll()
      return
    }

    // Optimistic update - مش محتاجين loadAll()
    setTransactions(prev => prev.filter(t => t.id !== id))
    setStats(prev => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))
    setProcessingTransactionId(null)
  }

  const rejectTransaction = async () => {
    if (!rejectId || !rejectReason) return
    if (processingTransactionId) return

    // احفظ القيم locally عشان تتجنب race condition
    const txId = rejectId
    const txReason = rejectReason

    setProcessingTransactionId(txId)

    // Optimistic UI update فوراً
    setTransactions(prev => prev.filter(t => t.id !== txId))
    setStats(prev => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))

    // أغلق الـ modal فوراً عشان تمنع double-click
    setRejectId(null)
    setRejectReason('')

    const { data: updatedRows, error: rejectError } = await supabase
      .from('transactions')
      .update({ status: 'rejected', rejection_reason: txReason })
      .eq('id', txId)
      .eq('status', 'pending')
      .select()

    if (rejectError || !updatedRows || updatedRows.length === 0) {
      // Rollback: أعد تحميل البيانات الحقيقية لو حصل خطأ
      await loadAll()
      alert(rejectError
        ? `فشل رفض الشحنة: ${rejectError.message}`
        : 'لم يتم التعديل. تأكد من صلاحيات الأدمن أو حالة الشحنة'
      )
      setProcessingTransactionId(null)
      return
    }

    setProcessingTransactionId(null)
  }

  const toggleBroker = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    // Optimistic update
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
  }

  const adjustWallet = async (id: string, amount: number) => {
    await supabase.rpc('add_wallet', { user_id: id, amount })
    // أعد تحميل البيانات عشان تشوف الرصيد الجديد
    loadAll()
  }

  const saveSettings = async () => {
    setSavingSettings(true)

    const settingsToUpdate = [
      { key: 'listing_cost', value: listingCost.toString() },
      { key: 'banner_text', value: bannerText.trim() }
    ]

    const { error } = await supabase
      .from('settings')
      .upsert(settingsToUpdate, { onConflict: 'key' })

    if (error) {
      alert(`فشل حفظ الإعدادات: ${error.message}`)
      setSavingSettings(false)
      return
    }

    setSavingSettings(false)
    alert('تم الحفظ بنجاح ✅')
    loadAll()
  }

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'home', label: 'الرئيسية' },
    { id: 'properties', label: 'الإعلانات', badge: stats.pendingProperties },
    { id: 'brokers', label: 'الملاك' },
    { id: 'transactions', label: 'الشحنات', badge: stats.pendingTransactions },
    { id: 'leads', label: 'العملاء' },
    { id: 'settings', label: 'الإعدادات' },
  ]

  const filteredProperties = propertyStatusFilter === 'all'
    ? properties
    : properties.filter(p => p.status === propertyStatusFilter)

  if (!authReady || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif' }}>
      <p style={{ color: '#64748b' }}>جاري التحميل...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* REJECT MODAL */}
      {rejectId && (
        <div onClick={() => { setRejectId(null); setRejectReason('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: '1rem', color: '#0f172a' }}>سبب الرفض</h2>
            <textarea rows={3} placeholder="اكتب سبب الرفض..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none', resize: 'none', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={rejectType === 'property' ? rejectProperty : rejectTransaction} style={{ flex: 1, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>تأكيد الرفض</button>
              <button onClick={() => { setRejectId(null); setRejectReason('') }} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTY MODAL */}
      {selectedProperty && (
        <div onClick={() => setSelectedProperty(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: 'linear-gradient(135deg, #166534, #14532d)', padding: '1.25rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: '0 0 4px' }}>{selectedProperty.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>📍 {selectedProperty.area} — {selectedProperty.address}</p>
              </div>
              <button onClick={() => setSelectedProperty(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {selectedProperty.images?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
                  {selectedProperty.images.map((img, i) => <img key={i} src={img} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>السعر</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#166534' }}>{selectedProperty.price?.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>المالك</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedProperty.profiles?.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedProperty.profiles?.phone}</div>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: '1rem' }}>{selectedProperty.description}</p>}
              {selectedProperty.status === 'pending' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => approveProperty(selectedProperty.id)} style={{ flex: 1, background: '#166534', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>موافقة ✅</button>
                  <button onClick={() => { setRejectId(selectedProperty.id); setRejectType('property'); setSelectedProperty(null) }} style={{ flex: 1, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>رفض ❌</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: '#166534', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>أجرلي — الأدمن</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={loadAll} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, cursor: 'pointer' }}>🔄 تحديث</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>خروج</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 1.5rem', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '14px 16px', border: 'none', background: 'none', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: tab === t.id ? '#166534' : '#94a3b8', borderBottom: tab === t.id ? '2px solid #166534' : '2px solid transparent', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            {t.badge ? <span style={{ background: '#dc2626', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* HOME TAB */}
        {tab === 'home' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { n: stats.totalBrokers, l: 'ملاك مسجلين', icon: '👥', color: '#1d4ed8', bg: '#eff6ff' },
                { n: stats.publishedProperties, l: 'إعلانات منشورة', icon: '✅', color: '#166534', bg: '#f0fdf4' },
                { n: stats.rejectedProperties, l: 'إعلانات مرفوضة', icon: '❌', color: '#991b1b', bg: '#fef2f2' },
                { n: stats.totalLeads, l: 'إجمالي العملاء', icon: '📊', color: '#7e22ce', bg: '#faf5ff' },
                { n: stats.pendingProperties, l: 'إعلانات معلقة', icon: '⏳', color: '#d97706', bg: '#fef3c7' },
                { n: stats.pendingTransactions, l: 'شحنات معلقة', icon: '💳', color: '#dc2626', bg: '#fef2f2' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, background: s.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 10px' }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {stats.pendingProperties > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#92400e', margin: 0 }}>⚠️ عندك {stats.pendingProperties} إعلان ينتظر مراجعتك</p>
                <button onClick={() => setTab('properties')} style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>راجع دلوقتي</button>
              </div>
            )}
          </div>
        )}

        {/* PROPERTIES TAB */}
        {tab === 'properties' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>الإعلانات ({filteredProperties.length})</h2>
              <select value={propertyStatusFilter} onChange={e => setPropertyStatusFilter(e.target.value as 'all' | 'pending' | 'active' | 'rejected')} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                <option value="all">الكل</option>
                <option value="pending">معلق</option>
                <option value="active">نشط</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
            {filteredProperties.map(p => (
              <div key={p.id} onClick={() => setSelectedProperty(p)} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '1rem' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{p.profiles?.name} · {p.area} · {p.price?.toLocaleString()} ج.م</p>
                </div>
                <span style={{ background: p.status === 'active' ? '#dcfce7' : p.status === 'pending' ? '#fef3c7' : '#fee2e2', color: p.status === 'active' ? '#166534' : p.status === 'pending' ? '#92400e' : '#991b1b', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {p.status === 'active' ? 'نشط' : p.status === 'pending' ? 'معلق' : 'مرفوض'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* BROKERS TAB */}
        {tab === 'brokers' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>الملاك ({brokers.length})</h2>
            </div>
            {profilesError && (
              <div style={{ margin: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                ⚠️ تعذر تحميل بيانات الملاك — {profilesError}
                <br />
                <small>نفذ الـ SQL في README لإصلاح الـ RLS Policy</small>
              </div>
            )}
            {brokers.map(b => (
              <div key={b.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 36, height: 36, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#166534', flexShrink: 0 }}>{b.name?.charAt(0)}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{b.name}</p>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{b.phone}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginRight: 44 }}>رصيد: <strong style={{ color: '#166534' }}>{b.wallet_balance} ج.م</strong></p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => adjustWallet(b.id, 50)} style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+50 ج.م</button>
                  <button onClick={() => adjustWallet(b.id, -50)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>-50 ج.م</button>
                  <button onClick={() => toggleBroker(b.id, b.is_active)} style={{ background: b.is_active ? '#fee2e2' : '#f0fdf4', color: b.is_active ? '#dc2626' : '#166534', border: 'none', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {b.is_active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === 'transactions' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>الشحنات المعلقة ({transactions.length})</h2>
            </div>
            {transactions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>مفيش شحنات معلقة ✅</p>
            ) : transactions.map(t => (
              <div key={t.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 900, margin: '0 0 3px' }}>{t.profiles?.name}</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 3px' }}>{t.profiles?.phone}</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#166534', margin: 0 }}>{t.amount} ج.م</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={t.screenshot_url} target="_blank" rel="noreferrer" style={{ background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>عرض الإيصال</a>
                  <button
                    disabled={processingTransactionId === t.id}
                    onClick={() => approveTransaction(t.id, t.broker_id, t.amount)}
                    style={{ background: '#166534', opacity: processingTransactionId === t.id ? 0.6 : 1, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: processingTransactionId === t.id ? 'not-allowed' : 'pointer' }}>
                    {processingTransactionId === t.id ? 'جاري...' : 'تأكيد ✅'}
                  </button>
                  <button
                    disabled={processingTransactionId === t.id}
                    onClick={() => { setRejectId(t.id); setRejectType('transaction') }}
                    style={{ background: '#dc2626', opacity: processingTransactionId === t.id ? 0.6 : 1, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: processingTransactionId === t.id ? 'not-allowed' : 'pointer' }}>
                    رفض ❌
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LEADS TAB */}
        {tab === 'leads' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>العملاء المهتمين ({leads.length})</h2>
            </div>
            {leads.map(l => (
              <div key={l.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 3px' }}>{l.client_name}</p>
                  <p style={{ fontSize: 13, color: '#166534', fontWeight: 700, margin: '0 0 3px' }}>{l.client_phone}</p>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{new Date(l.created_at).toLocaleDateString('ar-EG')}</p>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 1rem', color: '#0f172a' }}>تكلفة الإعلان</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="number" value={listingCost} onChange={e => setListingCost(e.target.value)} style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none' }} />
                <span style={{ fontSize: 14, color: '#64748b', fontWeight: 700 }}>ج.م</span>
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>التكلفة بعد الإعلانين المجانيين</p>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', border: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 1rem', color: '#0f172a' }}>البنر الإعلاني</h2>
              <textarea rows={3} placeholder="نص البنر — مثال: 🎉 خصم 50% على الإعلان الثالث" value={bannerText} onChange={e => setBannerText(e.target.value)} style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none', resize: 'none' }} />
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>اتركه فاضي لإخفاء البنر</p>
            </div>

            <button onClick={saveSettings} disabled={savingSettings} style={{ background: savingSettings ? '#86efac' : '#166534', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontFamily: 'Cairo, sans-serif', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}