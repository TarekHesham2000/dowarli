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
  const [leads, setLeads] = useState<{id: number, client_name: string, client_phone: string, property_id: number}[]>([])

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
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single()

    if (profile?.role !== 'admin') {
      alert('غير مسموح لك بدخول هذه الصفحة')
      router.push('/broker'); return
    }

    setAuthReady(true)
    loadAll()
  }

  checkAdmin()

  const channel = supabase
    .channel(`admin-realtime-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'properties' },
      () => loadAll()
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transactions' },
      () => loadAll()
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>جاري التحميل...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: 'inherit', direction: 'rtl' }}>

      {/* REJECT MODAL */}
      {rejectId && (
        <div onClick={() => { setRejectId(null); setRejectReason('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: '1rem', color: '#0f172a' }}>سبب الرفض</h2>
            <textarea rows={4} placeholder="اكتب سبب الرفض..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, outline: 'none', resize: 'none', marginBottom: '1.5rem', transition: 'all 0.3s ease', background: '#ffffff' }} onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={rejectType === 'property' ? rejectProperty : rejectTransaction} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.transform = 'scale(1)'; }}>تأكيد الرفض</button>
              <button onClick={() => { setRejectId(null); setRejectReason('') }} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTY MODAL */}
      {selectedProperty && (
        <div onClick={() => setSelectedProperty(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', padding: '1.5rem', borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 4px' }}>{selectedProperty.title}</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {selectedProperty.area} — {selectedProperty.address}</p>
              </div>
              <button onClick={() => setSelectedProperty(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 16, transition: 'all 0.3s ease', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {selectedProperty.images?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
                  {selectedProperty.images.map((img, i) => <img key={i} src={img} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: 12, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>السعر</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#065f46' }}>{selectedProperty.price?.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>المالك</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedProperty.profiles?.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{selectedProperty.profiles?.phone}</div>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: '1.5rem', fontWeight: 500 }}>{selectedProperty.description}</p>}
              {selectedProperty.status === 'pending' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => approveProperty(selectedProperty.id)} style={{ flex: 1, background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(6, 95, 70, 0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 95, 70, 0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 95, 70, 0.2)'; }}>موافقة ✅</button>
                  <button onClick={() => { setRejectId(selectedProperty.id); setRejectType('property'); setSelectedProperty(null) }} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }} onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.transform = 'scale(1)'; }}>رفض ❌</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(6, 95, 70, 0.15)' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>أجرلي — الأدمن</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={loadAll} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 10, padding: '8px 16px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', fontWeight: 700, transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1)'; }}>🔄 تحديث</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'color 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.color = 'white'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}>خروج</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 1.5rem', display: 'flex', gap: 4, overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '14px 18px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: tab === t.id ? '#065f46' : '#94a3b8', borderBottom: tab === t.id ? '3px solid #065f46' : '3px solid transparent', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.3s ease' }}>
            {t.label}
            {t.badge ? <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* HOME TAB */}
        {tab === 'home' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {[
                { n: stats.totalBrokers, l: 'ملاك مسجلين', icon: '👥', color: '#1d4ed8', bg: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', border: '#bfdbfe' },
                { n: stats.publishedProperties, l: 'إعلانات منشورة', icon: '✅', color: '#065f46', bg: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '#bbf7d0' },
                { n: stats.rejectedProperties, l: 'إعلانات مرفوضة', icon: '❌', color: '#991b1b', bg: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)', border: '#fecaca' },
                { n: stats.totalLeads, l: 'إجمالي العملاء', icon: '📊', color: '#7e22ce', bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '#f3e8ff' },
                { n: stats.pendingProperties, l: 'إعلانات معلقة', icon: '⏳', color: '#d97706', bg: 'linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%)', border: '#fcd34d' },
                { n: stats.pendingTransactions, l: 'شحنات معلقة', icon: '💳', color: '#dc2626', bg: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)', border: '#fecaca' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 16, padding: '1.5rem', border: `1px solid ${s.border}`, textAlign: 'center', transition: 'all 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}>
                  <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.7)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px', backdropFilter: 'blur(8px)' }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, marginBottom: 6 }}>{s.n}</div>
                  <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {stats.pendingProperties > 0 && (
              <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%)', border: '1px solid #fcd34d', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.1)' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#92400e', margin: 0 }}>⚠️ عندك {stats.pendingProperties} إعلان ينتظر مراجعتك</p>
                <button onClick={() => setTab('properties')} style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 10, padding: '8px 18px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#b45309'; e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.transform = 'scale(1)'; }}>راجع دلوقتي</button>
              </div>
            )}
          </div>
        )}

        {/* PROPERTIES TAB */}
        {tab === 'properties' && (
          <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '1.5rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>الإعلانات ({filteredProperties.length})</h2>
              <select value={propertyStatusFilter} onChange={e => setPropertyStatusFilter(e.target.value as 'all' | 'pending' | 'active' | 'rejected')} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'white', outline: 'none', transition: 'all 0.3s ease' }} onFocus={e => { e.currentTarget.style.borderColor = '#065f46'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}>
                <option value="all">الكل</option>
                <option value="pending">معلق</option>
                <option value="active">نشط</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
            {filteredProperties.map((p, idx) => (
              <div key={p.id} onClick={() => setSelectedProperty(p)} style={{ padding: '1.25rem 1.5rem', borderBottom: idx !== filteredProperties.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '1rem', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateX(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>{p.profiles?.name} · {p.area} · {p.price?.toLocaleString()} ج.م</p>
                </div>
                <span style={{ background: p.status === 'active' ? '#dcfce7' : p.status === 'pending' ? '#fef3c7' : '#fee2e2', color: p.status === 'active' ? '#065f46' : p.status === 'pending' ? '#92400e' : '#991b1b', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid currentColor', borderOpacity: 0.2 }}>
                  {p.status === 'active' ? 'نشط' : p.status === 'pending' ? 'معلق' : 'مرفوض'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* BROKERS TAB */}
        {tab === 'brokers' && (
          <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '1.5rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>الملاك ({brokers.length})</h2>
            </div>
            {profilesError && (
              <div style={{ margin: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>
                ⚠️ تعذر تحميل بيانات الملاك — {profilesError}
                <br />
                <small>نفذ الـ SQL في README لإصلاح الـ RLS Policy</small>
              </div>
            )}
            {brokers.map((b, idx) => (
              <div key={b.id} style={{ padding: '1.25rem 1.5rem', borderBottom: idx !== brokers.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#065f46', flexShrink: 0, border: '2px solid #bbf7d0' }}>{b.name?.charAt(0)}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>{b.name}</p>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>{b.phone}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginRight: 50, fontWeight: 500 }}>رصيد: <strong style={{ color: '#065f46', fontWeight: 700 }}>{b.wallet_balance} ج.م</strong></p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => adjustWallet(b.id, 50)} style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#bbf7d0'; e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}>+50 ج.م</button>
                  <button onClick={() => adjustWallet(b.id, -50)} style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)'; e.currentTarget.style.transform = 'scale(1)'; }}>-50 ج.م</button>
                  <button onClick={() => toggleBroker(b.id, b.is_active)} style={{ background: b.is_active ? 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', color: b.is_active ? '#dc2626' : '#065f46', border: b.is_active ? '1px solid #fecaca' : '1px solid #bbf7d0', borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
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
        {/* LEADS TAB */}
        {tab === 'leads' && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>العملاء المهتمين ({leads.length})</h2>
              <button
                onClick={() => {
                  if (leads.length === 0) return
                  const csv = 'الاسم,رقم الهاتف,التاريخ\n' + leads.map(l => `${l.client_name},${l.client_phone},${new Date(l.created_at).toLocaleDateString('ar-EG')}`).join('\n')
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'العملاء.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                📥 تحميل Excel
              </button>
            </div>
            {leads.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>مفيش عملاء لحد دلوقتي</p>
            ) : leads.map(l => (
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
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>التكلفة بعد الإعلانين الم��انيين</p>
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
