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
  video_url?: string; // 👈 لازم السطر ده يكون موجود هنا عشان الـ Error يروح
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
  total_charged?: number
}

type Lead = {
  id: number
  client_name: string
  client_phone: string
  created_at: string
  property_id: number
  property_title?: string
  property_area?: string
  owner_name?: string
}

type Stats = {
  totalBrokers: number
  publishedProperties: number
  rejectedProperties: number
  totalLeads: number
  pendingProperties: number
  pendingTransactions: number
  totalCharged: number
}

type Tab = 'home' | 'properties' | 'brokers' | 'transactions' | 'leads' | 'settings'

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: '#f1f5f9',
  white: '#ffffff',
  border: '#e2e8f0',
  navBg: '#1e293b',
  navText: '#f8fafc',
  accent: '#3b82f6',
  accentLight: '#eff6ff',
  accentBorder: '#bfdbfe',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  greenBorder: '#bbf7d0',
  red: '#dc2626',
  redLight: '#fef2f2',
  amber: '#d97706',
  amberLight: '#fef3c7',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
}

const card: React.CSSProperties = {
  background: C.white,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
}

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('home')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({
    totalBrokers: 0, publishedProperties: 0, rejectedProperties: 0,
    totalLeads: 0, pendingProperties: 0, pendingTransactions: 0, totalCharged: 0,
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
  const [verifiedTxError, setVerifiedTxError] = useState('')
  const [walletInputs, setWalletInputs] = useState<Record<string, string>>({})

  // ── Phase 2: New state ──────────────────────────────────────
  // Search & filter
  const [propertySearch, setPropertySearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null) // filter by broker id
  const [brokerSearch, setBrokerSearch] = useState('')
  // Delete confirmation modal
  const [deletePropertyId, setDeletePropertyId] = useState<number | null>(null)
  const [deletingProperty, setDeletingProperty] = useState(false)
  // Add property for broker
  const [addForBrokerId, setAddForBrokerId] = useState<string | null>(null)
  const [addingProperty, setAddingProperty] = useState(false)
  const [addPropertyForm, setAddPropertyForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    unit_type: '',
    address: '',
    status: 'pending' as 'pending' | 'active',
  })

  async function loadAll() {
    try {
      const [propsRes, transRes, verifiedRes, brokersRes, leadsRes, settingsRes] = await Promise.all([
        supabase.from('properties')
          .select('id, title, area, price, status, images, description, address, video_url, profiles(name, phone, id)')
          .order('created_at', { ascending: false }),
        supabase.from('transactions')
          .select('id, amount, screenshot_url, status, broker_id, profiles(name, phone)')
          .eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('transactions')
          .select('amount, broker_id')
          .eq('status', 'verified')
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase.from('profiles')
          .select('id, name, phone, wallet_balance, is_active, role, created_at')
          .neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('leads')
          .select('id, client_name, client_phone, created_at, property_id')
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('settings').select('key, value'),
      ])

      if (brokersRes.error) {
        setProfilesError(`${brokersRes.error.code ?? 'ERR'}: ${brokersRes.error.message}`)
      } else { setProfilesError('') }

      if (verifiedRes.error) {
        const msg = `${verifiedRes.error.code ?? 'ERR'}: ${verifiedRes.error.message}`
        setVerifiedTxError(msg)
        console.error('loadAll verified transactions:', verifiedRes.error)
      } else {
        setVerifiedTxError('')
      }

      const props = (propsRes.data as unknown as Property[]) ?? []
      const trans = (transRes.data as unknown as Transaction[]) ?? []
      const verified = verifiedRes.error
        ? []
        : ((verifiedRes.data as { amount: number; broker_id: string }[]) ?? [])
      const chargedByBroker = new Map<string, number>()
      let totalCharged = 0
      for (const row of verified) {
        const amt = Number(row.amount ?? 0)
        totalCharged += amt
        chargedByBroker.set(row.broker_id, (chargedByBroker.get(row.broker_id) ?? 0) + amt)
      }

      const allProfiles = (brokersRes.data as Broker[]) ?? []
      const brok = allProfiles
        .filter(b => b.role !== 'admin')
        .map(b => ({ ...b, total_charged: chargedByBroker.get(b.id) ?? 0 }))

      const rawLeads = (leadsRes.data as Lead[]) ?? []
      const enrichedLeads = rawLeads.map(l => {
        const prop = props.find(p => p.id === l.property_id)
        return {
          ...l,
          property_title: prop?.title ?? '—',
          property_area: prop?.area ?? '—',
          owner_name: prop?.profiles?.name ?? '—',
        }
      })

      setProperties(props)
      setTransactions(trans)
      setBrokers(brok)
      setLeads(enrichedLeads)

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
        totalLeads: enrichedLeads.length,
        pendingProperties: props.filter(p => p.status === 'pending').length,
        pendingTransactions: trans.length,
        totalCharged,
      })
    } catch (err) {
      console.error('loadAll fatal error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openAddForBroker = (brokerId: string) => {
    setAddForBrokerId(brokerId)
    setAddPropertyForm({
      title: '',
      description: '',
      price: '',
      area: '',
      unit_type: '',
      address: '',
      status: 'pending',
    })
  }

  const submitAddForBroker = async () => {
    if (!addForBrokerId) return
    if (!addPropertyForm.title.trim() || !addPropertyForm.area.trim() || !addPropertyForm.unit_type.trim() || !addPropertyForm.price) {
      alert('من فضلك اكتب العنوان والمنطقة ونوع الوحدة والسعر')
      return
    }

    setAddingProperty(true)
    const { error } = await supabase
      .from('properties')
      .insert({
        owner_id: addForBrokerId,
        title: addPropertyForm.title.trim(),
        description: addPropertyForm.description.trim(),
        price: Number(addPropertyForm.price),
        area: addPropertyForm.area.trim(),
        unit_type: addPropertyForm.unit_type.trim(),
        address: addPropertyForm.address.trim(),
        status: addPropertyForm.status,
        was_charged: false,
        images: [],
      })

    setAddingProperty(false)

    if (error) {
      alert(`فشل إضافة الإعلان: ${error.message}`)
      return
    }

    alert('تم إضافة الإعلان ✅')
    setAddForBrokerId(null)
    loadAll()
  }

  const formatEGP = (n: number) => `${(n ?? 0).toLocaleString('ar-EG')} ج.م`

  function getEmbedUrl(url?: string): string | null {
    if (!url?.trim()) return null
    const u = url.trim()

    const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/)
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`

    const tt = u.match(/tiktok\.com\/(?:@[\w.]+\/video\/|vm\/|v\/|t\/)(\d+|[a-zA-Z0-9]+)/)
    if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`

    const gd = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`

    if (u.includes('facebook.com') || u.includes('fb.watch'))
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=0`

    return null
  }

useEffect(() => {
  const checkAdmin = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      router.push('/login');
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || profile?.role !== 'admin') {
      console.error("Access denied or profile error:", error);
      alert('⚠️ غير مسموح لك بدخول لوحة التحكم، سيتم توجيهك لصفحة البروكر');
      router.push('/dashboard');
      return;
    }

    // 3. إذا كان أدمن، نجهز الصفحة ونحمل البيانات
    setAuthReady(true);
    loadAll(); // الدالة اللي بتجيب العقارات والعملاء والترانزاكشنز
  };

  checkAdmin();

  // 4. إعداد القنوات اللحظية (Real-time Channels)
  // بنعمل ID فريد للقناة عشان نتجنب تكرار الاتصال
  const channelId = `admin-dashboard-${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    // مراقبة أي تغيير (إضافة/حذف/تعديل) في العقارات
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'properties' 
    }, (payload) => {
      console.log('Change detected in properties:', payload);
      loadAll(); 
    })
    // مراقبة أي عمليات مالية جديدة (شحن محفظة / دفع إعلان)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'transactions' 
    }, () => {
      console.log('New transaction recorded');
      loadAll();
    })
    .subscribe();

  // 5. Cleanup: قفل القناة عند مغادرة الصفحة لتوفير موارد السيرفر
  return () => {
    supabase.removeChannel(channel);
  };
}, [router]);
  // ── approveProperty ────────────────────────────────────────
  const approveProperty = async (property: Property) => {
    setLoading(true)
    try {
      const cost = Number(listingCost)

      const { data: freshProperty, error: fetchError } = await supabase
        .from('properties').select('id, status, was_charged, owner_id').eq('id', property.id).single()

      if (fetchError || !freshProperty) {
        alert('تعذر جلب بيانات الإعلان، حاول مرة أخرى')
        setLoading(false); return
      }

      if (freshProperty.status === 'active') {
        alert('هذا الإعلان مفعّل بالفعل ✅')
        setSelectedProperty(null); setLoading(false); loadAll(); return
      }

      if (freshProperty.was_charged) {
        const { error } = await supabase.from('properties').update({ status: 'active' }).eq('id', property.id)
        if (error) throw error
        alert('تم التفعيل ✅ (كان مخصوماً مسبقاً)')
        setSelectedProperty(null); loadAll(); return
      }

      const { count } = await supabase
        .from('properties').select('*', { count: 'exact', head: true })
        .eq('owner_id', property.profiles.id).eq('status', 'active')

      const isFree = (count ?? 0) < 2

      if (!isFree) {
        const { data: brokerProfile } = await supabase
          .from('profiles').select('wallet_balance').eq('id', property.profiles.id).single()

        if (!brokerProfile || brokerProfile.wallet_balance < cost) {
          alert(`رصيد المالك غير كافٍ ❌\nالرصيد: ${brokerProfile?.wallet_balance ?? 0} ج.م\nالمطلوب: ${cost} ج.م`)
          setLoading(false); return
        }

        const { error: walletError } = await supabase.rpc('deduct_wallet', {
          user_id: property.profiles.id, amount: cost,
        })
        if (walletError) { alert(`فشل الخصم: ${walletError.message}`); setLoading(false); return }
      }

      const { error: updateError } = await supabase
        .from('properties').update({ status: 'active', was_charged: !isFree }).eq('id', property.id)
      if (updateError) throw updateError

      alert(isFree ? 'تم التفعيل مجاناً ✅' : `تم التفعيل وخصم ${cost} ج.م ✅`)
      setSelectedProperty(null); loadAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert('حدث خطأ: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const rejectProperty = async () => {
    if (!rejectId || !rejectReason) return
    await supabase.from('properties').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
    setRejectId(null); setRejectReason(''); loadAll()
  }

  const approveTransaction = async (id: number, brokerId: string, amount: number) => {
    if (processingTransactionId) return
    setProcessingTransactionId(id)
    const { data: updatedRows, error: txError } = await supabase
      .from('transactions').update({ status: 'verified' }).eq('id', id).eq('status', 'pending').select('id')
    if (txError) { alert(`فشل: ${txError.message}`); setProcessingTransactionId(null); return }
    if (!updatedRows || updatedRows.length === 0) {
      alert('تم التعامل معها بالفعل')
      setTransactions(prev => prev.filter(t => t.id !== id)); setProcessingTransactionId(null); return
    }
    const { error: walletError } = await supabase.rpc('add_wallet', { user_id: brokerId, amount })
    if (walletError) { alert(`فشل إضافة الرصيد: ${walletError.message}`); setProcessingTransactionId(null); loadAll(); return }
    setTransactions(prev => prev.filter(t => t.id !== id))
    setStats(prev => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))
    setProcessingTransactionId(null)
  }

  const rejectTransaction = async () => {
    if (!rejectId || !rejectReason || processingTransactionId) return
    const txId = rejectId; const txReason = rejectReason
    setProcessingTransactionId(txId)
    setTransactions(prev => prev.filter(t => t.id !== txId))
    setStats(prev => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))
    setRejectId(null); setRejectReason('')
    const { data: updatedRows, error } = await supabase
      .from('transactions').update({ status: 'rejected', rejection_reason: txReason })
      .eq('id', txId).eq('status', 'pending').select()
    if (error || !updatedRows || updatedRows.length === 0) {
      await loadAll()
      alert(error ? `فشل: ${error.message}` : 'لم يتم التعديل')
    }
    setProcessingTransactionId(null)
  }

  const toggleBroker = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
  }

  const adjustWallet = async (id: string, direction: 1 | -1) => {
    const raw = walletInputs[id]
    const amount = Number(raw)
    if (!raw || isNaN(amount) || amount <= 0) {
      alert('أدخل قيمة صحيحة أولاً'); return
    }
    await supabase.rpc('add_wallet', { user_id: id, amount: direction * amount })
    setWalletInputs(prev => ({ ...prev, [id]: '' }))
    loadAll()
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    const { error } = await supabase.from('settings').upsert(
      [{ key: 'listing_cost', value: listingCost }, { key: 'banner_text', value: bannerText.trim() }],
      { onConflict: 'key' }
    )
    if (error) { alert(`فشل: ${error.message}`); setSavingSettings(false); return }
    setSavingSettings(false); alert('تم الحفظ ✅'); loadAll()
  }

  // ── Phase 2: Delete property ──────────────────────────────────
  const deleteProperty = async () => {
    if (deletePropertyId === null) return
    setDeletingProperty(true)
    const idToDelete = deletePropertyId

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', idToDelete)

      if (error) {
        alert(`فشل الحذف: ${error.message}`)
        return
      }

      setProperties((prev) => prev.filter((p) => p.id !== idToDelete))
      setDeletePropertyId(null)
      setSelectedProperty((cur) => (cur?.id === idToDelete ? null : cur))
    } finally {
      setDeletingProperty(false)
    }
  }

  // ── Phase 2: Filter owner click ─────────────────────────────
  const filterByOwner = (brokerId: string) => {
    setOwnerFilter(brokerId)
    setPropertyStatusFilter('all')
    setPropertySearch('')
    setTab('properties')
  }

  const clearOwnerFilter = () => setOwnerFilter(null)

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'home', label: 'الرئيسية', icon: '📊' },
    { id: 'properties', label: 'الإعلانات', icon: '🏠', badge: stats.pendingProperties },
    { id: 'brokers', label: 'الملاك', icon: '👥' },
    { id: 'transactions', label: 'الشحنات', icon: '💳', badge: stats.pendingTransactions },
    { id: 'leads', label: 'العملاء', icon: '📋' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
  ]

  // ── Phase 2: Smart filter logic ──────────────────────────────
  const filteredProperties = properties.filter(p => {
    const matchStatus = propertyStatusFilter === 'all' || p.status === propertyStatusFilter
    const matchOwner = !ownerFilter || p.profiles?.id === ownerFilter
    const q = propertySearch.trim().toLowerCase()
    const matchSearch = !q
      || p.title?.toLowerCase().includes(q)
      || p.profiles?.name?.toLowerCase().includes(q)
    return matchStatus && matchOwner && matchSearch
  })

  const filteredBrokers = brokers.filter(b => {
    const q = brokerSearch.trim().toLowerCase()
    return !q || b.name?.toLowerCase().includes(q) || b.phone?.includes(q)
  })

  // Find owner name for filter label
  const ownerFilterName = ownerFilter
    ? brokers.find(b => b.id === ownerFilter)?.name ?? 'مالك'
    : null

  if (!authReady || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.accentBorder}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: C.muted, fontSize: 14 }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* ── REJECT MODAL ── */}
      {rejectId && (
        <div onClick={() => { setRejectId(null); setRejectReason('') }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: '1rem', color: C.text }}>سبب الرفض</h2>
            <textarea rows={3} placeholder="اكتب سبب الرفض..." value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none', resize: 'none', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={rejectType === 'property' ? rejectProperty : rejectTransaction}
                style={{ flex: 1, background: C.red, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                تأكيد الرفض
              </button>
              <button onClick={() => { setRejectId(null); setRejectReason('') }}
                style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 2: DELETE CONFIRM MODAL ── */}
      {deletePropertyId !== null && (
        <div onClick={() => setDeletePropertyId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: C.redLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 1rem' }}>🗑️</div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: C.text, marginBottom: 8 }}>حذف الإعلان</h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: '1.5rem', lineHeight: 1.7 }}>
              هل أنت متأكد من حذف هذا الإعلان؟<br />
              <strong style={{ color: C.red }}>لا يمكن التراجع عن هذا الإجراء.</strong>
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={deleteProperty} disabled={deletingProperty}
                style={{ flex: 1, background: C.red, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: deletingProperty ? 'not-allowed' : 'pointer', opacity: deletingProperty ? 0.6 : 1 }}>
                {deletingProperty ? 'جاري الحذف...' : 'نعم، احذف'}
              </button>
              <button onClick={() => setDeletePropertyId(null)}
                style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PROPERTY FOR BROKER MODAL ── */}
      {addForBrokerId && (
        <div
          onClick={() => !addingProperty && setAddForBrokerId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320, padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
          >
            <div style={{ background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'white' }}>إضافة إعلان للمالك</h2>
                <p style={{ fontSize: 12, margin: '6px 0 0', color: 'rgba(255,255,255,0.8)' }}>
                  {brokers.find(b => b.id === addForBrokerId)?.name ?? '—'}
                </p>
              </div>
              <button
                onClick={() => !addingProperty && setAddForBrokerId(null)}
                style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>عنوان الإعلان</label>
                  <input
                    value={addPropertyForm.title}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: شقة قريبة من الجامعة"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>المنطقة</label>
                  <input
                    value={addPropertyForm.area}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, area: e.target.value }))}
                    placeholder="مثال: المنصورة"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>السعر</label>
                  <input
                    type="number"
                    value={addPropertyForm.price}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="مثال: 3000"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>نوع الوحدة</label>
                  <input
                    value={addPropertyForm.unit_type}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, unit_type: e.target.value }))}
                    placeholder="student / family / studio / shared"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>الحالة</label>
                  <select
                    value={addPropertyForm.status}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, status: e.target.value as 'pending' | 'active' }))}
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  >
                    <option value="pending">معلق</option>
                    <option value="active">نشط</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>العنوان التفصيلي</label>
                  <input
                    value={addPropertyForm.address}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="مثال: شارع كذا، بجوار كذا"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>وصف</label>
                  <textarea
                    rows={3}
                    value={addPropertyForm.description}
                    onChange={e => setAddPropertyForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف مختصر..."
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg, resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  onClick={submitAddForBroker}
                  disabled={addingProperty}
                  style={{ flex: 1, background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 900, cursor: addingProperty ? 'not-allowed' : 'pointer', opacity: addingProperty ? 0.7 : 1 }}
                >
                  {addingProperty ? 'جاري الإضافة...' : 'إضافة الإعلان ✅'}
                </button>
                <button
                  onClick={() => !addingProperty && setAddForBrokerId(null)}
                  disabled={addingProperty}
                  style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 900, cursor: addingProperty ? 'not-allowed' : 'pointer', opacity: addingProperty ? 0.7 : 1 }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROPERTY MODAL ── */}
      {selectedProperty && (
        <div onClick={() => setSelectedProperty(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e40af, #1d4ed8)', padding: '1.25rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: 'white', margin: '0 0 4px' }}>{selectedProperty.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>📍 {selectedProperty.area} — {selectedProperty.address}</p>
              </div>
              <button onClick={() => setSelectedProperty(null)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {selectedProperty.images?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
                  {selectedProperty.images.map((img, i) => <img key={i} src={img} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                <div style={{ flex: 1, background: C.accentLight, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.muted }}>السعر</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.accent }}>{selectedProperty.price?.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.muted }}>المالك</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedProperty.profiles?.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{selectedProperty.profiles?.phone}</div>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: '1rem' }}>{selectedProperty.description}</p>}

              {/* Video preview (before approval) */}
              {selectedProperty.video_url && (
                <div style={{ marginBottom: '1rem', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: C.text }}>🎬 فيديو العقار</p>
                    <a
                      href={selectedProperty.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#0ea5e9', color: 'white', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}
                      title="فتح رابط الفيديو"
                    >
                      فتح الرابط ↗
                    </a>
                  </div>

                  {getEmbedUrl(selectedProperty.video_url) ? (
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      <iframe
                        src={getEmbedUrl(selectedProperty.video_url) as string}
                        title="معاينة فيديو الإعلان"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                      لا يمكن معاينة هذا النوع من الروابط داخل الصفحة — استخدم زر &quot;فتح الرابط&quot;.
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selectedProperty.status === 'pending' && (
                  <>
                    <button onClick={() => approveProperty(selectedProperty)}
                      style={{ flex: 1, background: C.green, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      موافقة ✅
                    </button>
                    <button onClick={() => { setRejectId(selectedProperty.id); setRejectType('property'); setSelectedProperty(null) }}
                      style={{ flex: 1, background: C.red, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      رفض ❌
                    </button>
                  </>
                )}
                {/* Phase 2: Delete button visible for ALL statuses */}
                <button onClick={() => { setDeletePropertyId(selectedProperty.id); setSelectedProperty(null) }}
                  style={{ flex: selectedProperty.status === 'pending' ? '0 0 auto' : 1, background: C.redLight, color: C.red, border: `1px solid #fecaca`, borderRadius: 10, padding: '12px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  🗑️ حذف الإعلان
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{ background: C.navBg, padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏘️</div>
          <span style={{ fontSize: 18, fontWeight: 900, color: C.navText }}>دورلي</span>
          <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>لوحة الأدمن</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadAll}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: C.navText, borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, cursor: 'pointer' }}>
            🔄 تحديث
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
            خروج
          </button>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem', display: 'flex', gap: 2, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '14px 16px', border: 'none', background: 'none',
              fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              color: tab === t.id ? C.accent : C.faint,
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s',
            }}>
            <span>{t.icon}</span> {t.label}
            {t.badge ? (
              <span style={{ background: C.red, color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {verifiedTxError && (
          <div style={{ marginBottom: '1rem', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            ⚠️ تعذر تحميل الشحنات المؤكدة — إجمالي المحصّل وأرصدة الملاك قد تكون غير دقيقة: {verifiedTxError}
          </div>
        )}

        {/* ══ HOME ══ */}
        {tab === 'home' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { n: stats.totalBrokers, l: 'ملاك مسجلين', icon: '👥', color: C.accent, bg: C.accentLight },
                { n: stats.publishedProperties, l: 'إعلانات نشطة', icon: '✅', color: C.green, bg: C.greenLight },
                { n: stats.rejectedProperties, l: 'مرفوضة', icon: '❌', color: C.red, bg: C.redLight },
                { n: `${stats.totalCharged.toLocaleString('ar-EG')} ج.م`, l: 'إجمالي المحصّل', icon: '💰', color: '#0ea5e9', bg: '#e0f2fe' },
                { n: stats.totalLeads, l: 'عملاء مهتمين', icon: '📋', color: '#7e22ce', bg: '#faf5ff' },
                { n: stats.pendingProperties, l: 'إعلانات معلقة', icon: '⏳', color: C.amber, bg: C.amberLight },
                { n: stats.pendingTransactions, l: 'شحنات معلقة', icon: '💳', color: C.red, bg: C.redLight },
              ].map((s, i) => (
                <div key={i} style={{ ...card, padding: '1.25rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 44, height: 44, background: s.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 10px' }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {stats.pendingProperties > 0 && (
              <div style={{ background: C.amberLight, border: `1px solid #fde68a`, borderRadius: 12, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#92400e', margin: 0 }}>⚠️ {stats.pendingProperties} إعلان ينتظر مراجعتك</p>
                <button onClick={() => setTab('properties')}
                  style={{ background: C.amber, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  راجع الآن
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ PROPERTIES ══ */}
        {tab === 'properties' && (
          <div style={card}>
            {/* Header + controls */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: C.text }}>
                  الإعلانات ({filteredProperties.length})
                  {ownerFilterName && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, background: C.accentLight, borderRadius: 20, padding: '2px 10px', marginRight: 8 }}>
                      👤 {ownerFilterName}
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {ownerFilter && (
                    <button onClick={clearOwnerFilter}
                      style={{ background: C.redLight, color: C.red, border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✕ إلغاء فلتر المالك
                    </button>
                  )}
                  <select value={propertyStatusFilter}
                    onChange={e => setPropertyStatusFilter(e.target.value as 'all' | 'pending' | 'active' | 'rejected')}
                    style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, background: C.bg, color: C.text }}>
                    <option value="all">كل الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="active">نشط</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </div>
              </div>
              {/* Phase 2: Search input */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.faint, pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  placeholder="ابحث باسم الإعلان أو اسم المالك..."
                  value={propertySearch}
                  onChange={e => setPropertySearch(e.target.value)}
                  style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 38px 9px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                {propertySearch && (
                  <button onClick={() => setPropertySearch('')}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 14 }}>✕</button>
                )}
              </div>
            </div>

            {filteredProperties.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا توجد إعلانات مطابقة 🔍</p>
            ) : filteredProperties.map(p => (
              <div key={p.id}
                style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Clickable info area */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setSelectedProperty(p)}>
                  <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>
                    {/* Phase 2: Owner name is clickable to filter */}
                    <span
                      onClick={e => { e.stopPropagation(); filterByOwner(p.profiles?.id) }}
                      style={{ color: C.accent, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      title="اعرض كل إعلانات هذا المالك">
                      {p.profiles?.name}
                    </span>
                    {' · '}{p.area} · {p.price?.toLocaleString()} ج.م
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* 👇 ضيف الزرار ده هنا قبل زرار الحذف */}
                    <a 
                      href={`/property/${p.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        background: C.bg, // بيستخدم نفس لون الخلفية البديل اللي في الثيم بتاعك
                        color: C.accent,  // بيستخدم لون الأكسنت الأساسي للمنصة
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '5px 10px',
                        fontSize: 12,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="معاينة الإعلان"
                    >
                      👁️
                    </a>
                  {p.video_url && (
                    <a 
                      href={p.video_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: 8,
                        padding: '5px 10px',
                        fontSize: 12,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px'
                      }}
                      title="مشاهدة الفيديو"
                    >
                      🎬
                    </a>
                  )}
                  <span style={{
                    background: p.status === 'active' ? C.greenLight : p.status === 'pending' ? C.amberLight : C.redLight,
                    color: p.status === 'active' ? C.green : p.status === 'pending' ? C.amber : C.red,
                    borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap',
                  }}>
                    {p.status === 'active' ? 'نشط' : p.status === 'pending' ? 'معلق' : 'مرفوض'}
                  </span>
                  {/* Phase 2: Inline delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeletePropertyId(p.id) }}
                    title="حذف الإعلان"
                    style={{ background: C.redLight, color: C.red, border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ BROKERS ══ */}
        {tab === 'brokers' && (
          <div style={card}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: C.text }}>الملاك ({filteredBrokers.length})</h2>
              </div>
              {/* Phase 2: Broker search */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.faint, pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  placeholder="ابحث باسم المالك أو رقم التليفون..."
                  value={brokerSearch}
                  onChange={e => setBrokerSearch(e.target.value)}
                  style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 38px 9px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg, color: C.text, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                {brokerSearch && (
                  <button onClick={() => setBrokerSearch('')}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 14 }}>✕</button>
                )}
              </div>
            </div>
            {profilesError && (
              <div style={{ margin: '1rem', background: C.redLight, border: `1px solid #fecaca`, color: C.red, borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                ⚠️ {profilesError}
              </div>
            )}
            {filteredBrokers.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا يوجد ملاك مطابقون</p>
            ) : filteredBrokers.map(b => (
              <div key={b.id} style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 38, height: 38, background: C.accentLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: C.accent, flexShrink: 0 }}>
                      {b.name?.charAt(0)}
                    </div>
                    <div>
                      {/* Phase 2: Broker name is clickable to filter his properties */}
                      <p
                        onClick={() => filterByOwner(b.id)}
                        style={{ fontSize: 14, fontWeight: 800, margin: 0, color: C.accent, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                        title="عرض كل إعلانات هذا المالك">
                        {b.name}
                      </p>
                      <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>{b.phone}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0, marginRight: 48 }}>
                    الرصيد: <strong style={{ color: C.green }}>{b.wallet_balance} ج.م</strong>
                  </p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0', marginRight: 48 }}>
                    إجمالي الشحنات المؤكدة: <strong style={{ color: '#0ea5e9' }}>{formatEGP(b.total_charged ?? 0)}</strong>
                  </p>
                </div>

                {/* Manual wallet input — Phase 2: confirmed working */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openAddForBroker(b.id)}
                    style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    title="إضافة إعلان لهذا المالك"
                  >
                    + إعلان
                  </button>
                  <input
                    type="number"
                    placeholder="المبلغ"
                    value={walletInputs[b.id] ?? ''}
                    onChange={e => setWalletInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                    style={{
                      width: 90, border: `1.5px solid ${C.border}`, borderRadius: 8,
                      padding: '6px 10px', fontFamily: 'Cairo, sans-serif', fontSize: 13,
                      outline: 'none', background: C.bg, color: C.text, textAlign: 'center',
                    }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                  <button onClick={() => adjustWallet(b.id, 1)}
                    style={{ background: C.greenLight, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + إضافة
                  </button>
                  <button onClick={() => adjustWallet(b.id, -1)}
                    style={{ background: C.redLight, color: C.red, border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    − خصم
                  </button>
                  <button onClick={() => toggleBroker(b.id, b.is_active)}
                    style={{ background: b.is_active ? C.redLight : C.greenLight, color: b.is_active ? C.red : C.green, border: 'none', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {b.is_active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {tab === 'transactions' && (
          <div style={card}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: C.text }}>الشحنات المعلقة ({transactions.length})</h2>
            </div>
            {transactions.length === 0
              ? <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا توجد شحنات معلقة ✅</p>
              : transactions.map(t => (
                <div key={t.id} style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 900, margin: '0 0 2px', color: C.text }}>{t.profiles?.name}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: '0 0 4px' }}>{t.profiles?.phone}</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: C.green, margin: 0 }}>{t.amount} ج.م</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={t.screenshot_url} target="_blank" rel="noreferrer"
                      style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      عرض الإيصال
                    </a>
                    <button disabled={processingTransactionId === t.id} onClick={() => approveTransaction(t.id, t.broker_id, t.amount)}
                      style={{ background: C.green, opacity: processingTransactionId === t.id ? 0.6 : 1, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: processingTransactionId === t.id ? 'not-allowed' : 'pointer' }}>
                      {processingTransactionId === t.id ? 'جاري...' : 'تأكيد ✅'}
                    </button>
                    <button disabled={processingTransactionId === t.id} onClick={() => { setRejectId(t.id); setRejectType('transaction') }}
                      style={{ background: C.red, opacity: processingTransactionId === t.id ? 0.6 : 1, color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: processingTransactionId === t.id ? 'not-allowed' : 'pointer' }}>
                      رفض ❌
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ══ LEADS — TABLE ══ */}
        {tab === 'leads' && (
          <div style={card}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: C.text }}>العملاء المهتمين ({leads.length})</h2>
              <button
                onClick={() => {
                  if (leads.length === 0) return
                  const csv = 'اسم العميل,رقم العميل,اسم المالك,اسم الإعلان,التاريخ\n'
                    + leads.map(l => `${l.client_name},${l.client_phone},${l.owner_name ?? ''},${l.property_title ?? ''},${new Date(l.created_at).toLocaleDateString('ar-EG')}`).join('\n')
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'العملاء.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                📥 تحميل CSV
              </button>
            </div>

            {leads.length === 0
              ? <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا يوجد عملاء حتى الآن</p>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {['#', 'اسم العميل', 'رقم العميل', 'اسم المالك', 'الإعلان', 'التاريخ'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l, idx) => (
                        <tr key={l.id}
                          style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '10px 14px', color: C.faint, fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{l.client_name}</td>
                          <td style={{ padding: '10px 14px', color: C.accent, fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{l.client_phone}</td>
                          <td style={{ padding: '10px 14px', color: C.muted }}>{l.owner_name}</td>
                          <td style={{ padding: '10px 14px', color: C.muted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.property_title}</td>
                          <td style={{ padding: '10px 14px', color: C.faint, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleDateString('ar-EG')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ ...card, padding: '1.5rem' }}>
              <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 1rem', color: C.text }}>تكلفة الإعلان</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="number" value={listingCost} onChange={e => setListingCost(e.target.value)}
                  style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none', background: C.bg }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>ج.م</span>
              </div>
              <p style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>التكلفة بعد الإعلانين المجانيين</p>
            </div>

            <div style={{ ...card, padding: '1.5rem' }}>
              <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 1rem', color: C.text }}>نص البنر</h2>
              <textarea rows={3} placeholder="مثال: 🎉 خصم 50% على الإعلان الثالث" value={bannerText}
                onChange={e => setBannerText(e.target.value)}
                style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 14, outline: 'none', resize: 'none', background: C.bg, boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border} />
              <p style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>اتركه فاضياً لإخفاء البنر</p>
            </div>

            <button onClick={saveSettings} disabled={savingSettings}
              style={{ background: savingSettings ? C.accentBorder : C.accent, color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontFamily: 'Cairo, sans-serif', fontSize: 15, fontWeight: 900, cursor: savingSettings ? 'not-allowed' : 'pointer', boxShadow: savingSettings ? 'none' : `0 4px 16px rgba(59,130,246,0.3)` }}>
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}