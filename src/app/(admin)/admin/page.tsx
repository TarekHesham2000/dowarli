'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Copy, Loader2 } from 'lucide-react'
import { safeRouterRefresh } from '@/lib/safeRouterRefresh'
import { getAdPostPointsCost, type ListingPurpose } from '@/lib/pointsConfig'
import { notifyPointsChanged } from '@/lib/profilePointsSync'

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
  listing_type?: string | null
  listing_purpose?: string | null
  was_charged?: boolean | null
  profiles: { name: string; phone: string; id: string; points?: number | null }
}

function listingPurposeFromProperty(p: Pick<Property, 'listing_type' | 'listing_purpose'>): ListingPurpose {
  const raw = (p.listing_type ?? p.listing_purpose ?? 'rent').toString().trim().toLowerCase()
  return raw === 'sale' ? 'sale' : 'rent'
}

function activationCostLabelAr(p: Property): string {
  if (!p.was_charged) return 'تفعيل مجاني (ضمن الحد المسموح)'
  const n = getAdPostPointsCost(listingPurposeFromProperty(p))
  return `تكلفة التفعيل: ${n} نقطة`
}

type Transaction = {
  id: number
  amount: number
  screenshot_url: string
  status: string
  broker_id: string
  sender_phone?: string | null
  points_requested?: number | null
  package_name?: string | null
  profiles: { name: string; phone: string }
}

type Broker = {
  id: string
  name: string
  phone: string
  points: number
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
  totalUsers: number
  totalBrokers: number
  publishedProperties: number
  rejectedProperties: number
  totalLeads: number
  pendingProperties: number
  pendingTransactions: number
  totalCharged: number
}

type Tab = 'home' | 'properties' | 'brokers' | 'transactions' | 'vault' | 'leads' | 'settings'

type VerifiedTxRow = { amount: number; created_at: string }

function isAwaitingPropertyApproval(status: string) {
  return status === 'pending' || status === 'pending_approval'
}

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
    totalUsers: 0,
    totalBrokers: 0, publishedProperties: 0, rejectedProperties: 0,
    totalLeads: 0, pendingProperties: 0, pendingTransactions: 0, totalCharged: 0,
  })
  const [verifiedTxRows, setVerifiedTxRows] = useState<VerifiedTxRow[]>([])
  const [mobileMainTab, setMobileMainTab] = useState<'stats' | 'transactions' | 'vault' | 'more'>('stats')
  const [vaultPassword, setVaultPassword] = useState('')
  /** Vault access — memory only; resets on full page refresh (no sessionStorage). */
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [txSearch, setTxSearch] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectAdminNotes, setRejectAdminNotes] = useState('')
  const [rejectType, setRejectType] = useState<'property' | 'transaction'>('property')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [listingCost, setListingCost] = useState('50')
  const [bannerText, setBannerText] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all')
  const [authReady, setAuthReady] = useState(false)
  const [approvingTransactionId, setApprovingTransactionId] = useState<number | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const [profilesError, setProfilesError] = useState('')
  const [verifiedTxError, setVerifiedTxError] = useState('')
  const [pointsAdjustInputs, setPointsAdjustInputs] = useState<Record<string, string>>({})
  const [approvingPropertyId, setApprovingPropertyId] = useState<number | null>(null)

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
    status: 'pending_approval' as 'pending_approval' | 'pending' | 'active',
  })

  async function loadAll() {
    try {
      const [propsRes, transRes, verifiedRes, brokersRes, leadsRes, settingsRes] = await Promise.all([
        supabase.from('properties')
          .select('id, title, area, price, status, images, description, address, video_url, listing_type, listing_purpose, was_charged, profiles(name, phone, id, points)')
          .order('created_at', { ascending: false }),
        supabase.from('transactions')
          .select('id, amount, screenshot_url, status, broker_id, sender_phone, points_requested, package_name, profiles(name, phone)')
          .eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('transactions')
          .select('amount, broker_id, created_at')
          .eq('status', 'verified')
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase.from('profiles')
          .select('id, name, phone, points, is_active, role, created_at')
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
        : ((verifiedRes.data as { amount: number; broker_id: string; created_at: string }[]) ?? [])
      setVerifiedTxRows(
        verifiedRes.error
          ? []
          : ((verifiedRes.data as VerifiedTxRow[]) ?? []).map((r) => ({
              amount: Number(r.amount ?? 0),
              created_at: r.created_at,
            })),
      )
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
        totalUsers: allProfiles.length,
        totalBrokers: brok.length,
        publishedProperties: props.filter(p => p.status === 'active').length,
        rejectedProperties: props.filter(p => p.status === 'rejected').length,
        totalLeads: enrichedLeads.length,
        pendingProperties: props.filter(p => p.status === 'pending' || p.status === 'pending_approval').length,
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
      status: 'pending_approval',
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
        listing_purpose: 'rent',
        listing_type: 'rent',
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
  // ── approveProperty — RPC deducts points when was_charged (same transaction as activate) ──
  const approveProperty = async (property: Property) => {
    if (approvingPropertyId !== null) return
    setApprovingPropertyId(property.id)
    try {
      const { data: freshProperty, error: fetchError } = await supabase
        .from('properties')
        .select('id, status')
        .eq('id', property.id)
        .single()

      if (fetchError || !freshProperty) {
        showToast('تعذر جلب بيانات الإعلان، حاول مرة أخرى', 'error')
        return
      }

      if (freshProperty.status === 'active') {
        showToast('هذا الإعلان مفعّل بالفعل', 'success')
        setSelectedProperty(null)
        await loadAll()
        safeRouterRefresh(router)
        return
      }

      if (!isAwaitingPropertyApproval(freshProperty.status)) {
        showToast('هذا الإعلان ليس في انتظار الموافقة', 'error')
        return
      }

      const { error: rpcError } = await supabase.rpc('handle_admin_approval', {
        p_property_id: property.id,
      })

      if (rpcError) {
        const m = rpcError.message ?? ''
        if (m.includes('insufficient_points_for_activation') || m.includes('insufficient points')) {
          showToast('رصيد المستخدم غير كافٍ لتفعيل هذا الإعلان', 'error')
        } else if (m.includes('forbidden')) {
          showToast('ليس لديك صلاحية تنفيذ هذه العملية', 'error')
        } else if (m.includes('not_pending_approval')) {
          showToast('هذا الإعلان ليس في انتظار الموافقة', 'error')
        } else {
          showToast(m || 'تعذّر تفعيل الإعلان', 'error')
        }
        return
      }

      notifyPointsChanged()
      showToast(
        property.was_charged
          ? 'تم تفعيل الإعلان وخصم النقاط من رصيد المالك'
          : 'تم تفعيل الإعلان (بدون خصم — ضمن الحد المجاني)',
        'success',
      )
      setSelectedProperty(null)
      await loadAll()
      safeRouterRefresh(router)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showToast('حدث خطأ: ' + msg, 'error')
    } finally {
      setApprovingPropertyId(null)
    }
  }

  const rejectProperty = async () => {
    if (!rejectId || !rejectReason.trim() || rejectSubmitting) return
    setRejectSubmitting(true)
    try {
      const { error } = await supabase
        .from('properties')
        .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
        .eq('id', rejectId)
      if (error) {
        showToast(`فشل رفض الإعلان: ${error.message}`, 'error')
        return
      }
      showToast('تم رفض الإعلان بنجاح', 'success')
      setRejectId(null)
      setRejectReason('')
      await loadAll()
      safeRouterRefresh(router)
    } finally {
      setRejectSubmitting(false)
    }
  }

  const approveTransaction = async (t: Transaction) => {
    const id = t.id
    const brokerId = t.broker_id
    const pointsAdd = t.points_requested != null ? Number(t.points_requested) : 0
    if (approvingTransactionId !== null || rejectSubmitting) return
    setApprovingTransactionId(id)

    if (pointsAdd > 0) {
      const res = await fetch('/api/admin/add-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ p_user_id: brokerId, p_delta: pointsAdd }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      if (!res.ok) {
        let hint = payload.message || payload.error || res.statusText
        if (res.status === 401) {
          hint = 'انتهت الجلسة — حدّث الصفحة أو سجّل الدخول من جديد'
        } else if (payload.error === 'forbidden') {
          hint = 'ليس لديك صلاحية أدمن'
        } else if (payload.error === 'user_not_found') {
          hint = 'المستخدم غير موجود'
        }
        showToast(`فشل إضافة النقاط: ${hint}`, 'error')
        setApprovingTransactionId(null)
        return
      }
    } else {
      const { error: walletError } = await supabase.rpc('add_wallet', { user_id: brokerId, amount: t.amount })
      if (walletError) {
        showToast(`فشل إضافة الرصيد: ${walletError.message}`, 'error')
        setApprovingTransactionId(null)
        return
      }
    }

    const { data: updatedRows, error: txError } = await supabase
      .from('transactions').update({ status: 'verified' }).eq('id', id).eq('status', 'pending').select('id')
    if (txError) {
      showToast(`تمت إضافة الرصيد/النقاط لكن فشل تحديث حالة الطلب: ${txError.message}`, 'error')
      setApprovingTransactionId(null)
      await loadAll()
      return
    }
    if (!updatedRows || updatedRows.length === 0) {
      showToast('تم التعامل مع هذا الطلب مسبقاً', 'error')
      setTransactions((prev) => prev.filter((x) => x.id !== id))
      setApprovingTransactionId(null)
      await loadAll()
      return
    }
    setTransactions((prev) => prev.filter((x) => x.id !== id))
    setStats((prev) => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))
    setApprovingTransactionId(null)
    showToast(
      pointsAdd > 0
        ? `تم تأكيد الطلب وإضافة ${pointsAdd} نقطة للمستخدم`
        : 'تم تأكيد الطلب وإضافة المبلغ للمحفظة',
      'success',
    )
    await loadAll()
    safeRouterRefresh(router)
  }

  const rejectTransaction = async () => {
    if (!rejectId || !rejectReason.trim() || rejectSubmitting) return
    const txId = rejectId
    const txReason = rejectReason.trim()
    const notes = rejectAdminNotes.trim() || null
    setRejectSubmitting(true)
    try {
      const { data: updatedRows, error } = await supabase
        .from('transactions')
        .update({
          status: 'rejected',
          rejection_reason: txReason,
          admin_notes: notes,
        })
        .eq('id', txId)
        .eq('status', 'pending')
        .select()
      if (error || !updatedRows || updatedRows.length === 0) {
        showToast(error ? `فشل الرفض: ${error.message}` : 'لم يتم رفض المعاملة', 'error')
        await loadAll()
        return
      }
      setTransactions((prev) => prev.filter((x) => x.id !== txId))
      setStats((prev) => ({ ...prev, pendingTransactions: Math.max(0, prev.pendingTransactions - 1) }))
      setRejectId(null)
      setRejectReason('')
      setRejectAdminNotes('')
      showToast('تم رفض المعاملة وتسجيل السبب', 'success')
      await loadAll()
      safeRouterRefresh(router)
    } finally {
      setRejectSubmitting(false)
    }
  }

  const toggleBroker = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
  }

  const adjustBrokerPoints = async (id: string, direction: 1 | -1) => {
    const raw = pointsAdjustInputs[id]
    const amount = Number(raw)
    if (!raw || isNaN(amount) || amount <= 0) {
      showToast('أدخل عدد نقاط صحيحاً أولاً', 'error')
      return
    }
    const p_delta = direction * Math.floor(amount)
    const res = await fetch('/api/admin/add-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ p_user_id: id, p_delta: p_delta }),
    })
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    if (!res.ok) {
      showToast(payload.message || payload.error || 'تعذّر تعديل النقاط', 'error')
      return
    }
    setPointsAdjustInputs((prev) => ({ ...prev, [id]: '' }))
    notifyPointsChanged()
    showToast(direction === 1 ? 'تمت إضافة النقاط' : 'تم خصم النقاط', 'success')
    await loadAll()
    safeRouterRefresh(router)
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
      safeRouterRefresh(router)
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
    { id: 'vault', label: 'الخزنة', icon: '🔐' },
    { id: 'leads', label: 'العملاء', icon: '📋' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
  ]

  // ── Phase 2: Smart filter logic ──────────────────────────────
  const filteredProperties = properties.filter(p => {
    const matchStatus =
      propertyStatusFilter === 'all'
        ? true
        : propertyStatusFilter === 'pending'
          ? isAwaitingPropertyApproval(p.status)
          : p.status === propertyStatusFilter
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

  const filteredPendingTransactions = transactions.filter((t) => {
    const q = txSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (t.profiles?.name ?? '').toLowerCase().includes(q) ||
      (t.profiles?.phone ?? '').includes(q) ||
      (t.sender_phone ?? '').toLowerCase().includes(q) ||
      String(t.id).includes(q)
    )
  })

  const copyText = (value: string, successLabel = 'تم النسخ') => {
    void navigator.clipboard.writeText(value.replace(/\s/g, ''))
    showToast(successLabel, 'success')
  }

  const vaultTotalRevenue = verifiedTxRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  const vaultDailyBars = (() => {
    const map = new Map<string, number>()
    for (const r of verifiedTxRows) {
      const d = new Date(r.created_at).toISOString().slice(0, 10)
      map.set(d, (map.get(d) ?? 0) + Number(r.amount ?? 0))
    }
    const days: string[] = []
    for (let i = 13; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      days.push(dt.toISOString().slice(0, 10))
    }
    const maxVal = Math.max(1, ...days.map((d) => map.get(d) ?? 0))
    return days.map((d) => {
      const amount = map.get(d) ?? 0
      return { day: d, amount, barPx: Math.max(8, Math.round((amount / maxVal) * 110)) }
    })
  })()

  const tryUnlockVault = () => {
    if (vaultPassword === 'opensesame') {
      setVaultUnlocked(true)
      setVaultPassword('')
      showToast('تم فتح الخزنة', 'success')
    } else {
      showToast('مش هتعرف تخش 😂', 'error')
    }
  }

  const iconCopyBtn: React.CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    padding: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.bg,
    cursor: 'pointer',
    color: C.text,
  }

  const renderTransactionRow = (t: Transaction, compactMobile?: boolean) => {
    const rowLocked = approvingTransactionId !== null || rejectSubmitting || rejectId !== null
    const approving = approvingTransactionId === t.id
    return (
      <div
        key={t.id}
        className="w-full max-w-full"
        style={{
          padding: compactMobile ? '1rem' : '1rem 1.25rem',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: compactMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: compactMobile ? 'stretch' : 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ minWidth: 0, width: compactMobile ? '100%' : 'auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>رقم الطلب:</span>
            <span dir="ltr" style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>
              #{t.id}
            </span>
            <button
              type="button"
              title="نسخ رقم المعاملة"
              aria-label="نسخ رقم المعاملة"
              onClick={() => copyText(String(t.id), 'تم نسخ رقم المعاملة')}
              style={iconCopyBtn}
            >
              <Copy size={18} strokeWidth={2.25} />
            </button>
          </div>
          <p style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px', color: C.text }}>{t.profiles?.name}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>{t.profiles?.phone}</p>
            <button
              type="button"
              title="نسخ هاتف المالك"
              aria-label="نسخ هاتف المالك"
              onClick={() => copyText(t.profiles?.phone ?? '', 'تم نسخ رقم الهاتف')}
              style={iconCopyBtn}
            >
              <Copy size={18} strokeWidth={2.25} />
            </button>
          </div>
          {t.sender_phone ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>محوّل: {t.sender_phone}</p>
              <button
                type="button"
                title="نسخ رقم المحوّل"
                aria-label="نسخ رقم المحوّل"
                onClick={() => copyText(t.sender_phone ?? '', 'تم نسخ رقم المحوّل')}
                style={iconCopyBtn}
              >
                <Copy size={18} strokeWidth={2.25} />
              </button>
            </div>
          ) : null}
          <p style={{ fontSize: 12, color: C.faint, margin: '0 0 4px' }}>
            {t.package_name ? `باقة: ${t.package_name} · ` : ''}
            {t.points_requested != null ? `${t.points_requested} نقطة 💎 · ` : ''}
          </p>
          <p style={{ fontSize: 22, fontWeight: 900, color: C.green, margin: 0 }}>{t.amount} ج.م</p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            width: compactMobile ? '100%' : 'auto',
          }}
        >
          <a
            href={t.screenshot_url}
            target="_blank"
            rel="noreferrer"
            style={{
              minHeight: 56,
              flex: compactMobile ? '1 1 100%' : undefined,
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 15,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Cairo, sans-serif',
            }}
          >
            عرض الإيصال
          </a>
          <button
            type="button"
            disabled={rowLocked}
            onClick={() => void approveTransaction(t)}
            style={{
              minHeight: 56,
              flex: compactMobile ? '1 1 calc(50% - 5px)' : undefined,
              background: C.green,
              opacity: rowLocked && !approving ? 0.55 : 1,
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '16px 22px',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 16,
              fontWeight: 900,
              cursor: rowLocked ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {approving ? <Loader2 className="animate-spin" size={22} aria-hidden /> : null}
            {approving ? 'جاري التأكيد...' : 'موافقة ✅'}
          </button>
          <button
            type="button"
            disabled={rowLocked}
            onClick={() => {
              setRejectId(t.id)
              setRejectType('transaction')
            }}
            style={{
              minHeight: 56,
              flex: compactMobile ? '1 1 calc(50% - 5px)' : undefined,
              background: C.red,
              opacity: rowLocked ? 0.55 : 1,
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '16px 22px',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 16,
              fontWeight: 900,
              cursor: rowLocked ? 'not-allowed' : 'pointer',
            }}
          >
            رفض ❌
          </button>
        </div>
      </div>
    )
  }

  const renderVaultPanel = () => (
    <div className="w-full max-w-full" style={{ ...card, padding: '1.25rem' }}>
      <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 1rem', color: C.text }}>الخزنة 🔐</h2>
      {!vaultUnlocked ? (
        <div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>أدخل كلمة المرور للمتابعة</p>
          <input
            type="password"
            value={vaultPassword}
            onChange={(e) => setVaultPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryUnlockVault()}
            style={{
              width: '100%',
              maxWidth: 320,
              border: `1.5px solid ${C.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 14,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={tryUnlockVault}
            style={{
              minHeight: 48,
              background: 'linear-gradient(135deg, #d97706, #ea580c)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 15,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            فتح الخزنة
          </button>
        </div>
      ) : (
        <div>
          <div
            style={{
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              border: `1px solid ${C.greenBorder}`,
              borderRadius: 16,
              padding: '1.25rem',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 6px' }}>إجمالي الإيرادات (معاملات مؤكدة)</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: C.green, margin: 0 }}>
              {vaultTotalRevenue.toLocaleString('ar-EG')} ج.م
            </p>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: C.text, marginBottom: 10 }}>إيراد يومي (آخر 14 يوماً)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minHeight: 130, overflowX: 'auto', paddingBottom: 8 }}>
            {vaultDailyBars.map((b) => (
              <div key={b.day} style={{ flex: '1 0 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  title={`${b.day}: ${b.amount} ج.م`}
                  style={{
                    width: '100%',
                    height: b.barPx,
                    background: 'linear-gradient(180deg, #16a34a, #14532d)',
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 8, color: C.faint, writingMode: 'horizontal-tb' }}>{b.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVaultUnlocked(false)}
            style={{
              marginTop: 16,
              minHeight: 44,
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '10px 16px',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            قفل الخزنة
          </button>
        </div>
      )}
    </div>
  )

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
        <div
          onClick={() => {
            if (rejectSubmitting) return
            setRejectId(null)
            setRejectReason('')
            setRejectAdminNotes('')
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[min(100%,440px)]"
            style={{ background: C.white, borderRadius: 20, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, color: C.text }}>
              {rejectType === 'transaction' ? 'تأكيد رفض المعاملة' : 'تأكيد رفض الإعلان'}
            </h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
              {rejectType === 'transaction'
                ? 'اكتب سبب الرفض بوضوح (يُحفظ للمستخدم). مثال: الصورة غير واضحة أو المبلغ غير مطابق.'
                : 'سيتم تسجيل السبب مع الإعلان المرفوض.'}
            </p>
            <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>سبب الرفض *</label>
            <textarea
              rows={4}
              placeholder={rejectType === 'transaction' ? 'مثال: الصورة غير واضحة' : 'اكتب سبب الرفض...'}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 16,
                outline: 'none',
                resize: 'none',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />
            {rejectType === 'transaction' ? (
              <>
                <label style={{ fontSize: 12, fontWeight: 800, color: C.text, display: 'block', marginBottom: 6 }}>ملاحظات داخلية (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="للفريق فقط..."
                  value={rejectAdminNotes}
                  onChange={(e) => setRejectAdminNotes(e.target.value)}
                  style={{
                    width: '100%',
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontFamily: 'Cairo, sans-serif',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'none',
                    marginBottom: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </>
            ) : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectSubmitting}
                onClick={() => void (rejectType === 'property' ? rejectProperty() : rejectTransaction())}
                style={{
                  flex: '1 1 140px',
                  minHeight: 52,
                  background: C.red,
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: !rejectReason.trim() || rejectSubmitting ? 'not-allowed' : 'pointer',
                  opacity: !rejectReason.trim() || rejectSubmitting ? 0.65 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {rejectSubmitting ? <Loader2 className="animate-spin" size={20} aria-hidden /> : null}
                {rejectSubmitting ? 'جاري الرفض...' : 'تأكيد الرفض'}
              </button>
              <button
                type="button"
                disabled={rejectSubmitting}
                onClick={() => {
                  setRejectId(null)
                  setRejectReason('')
                  setRejectAdminNotes('')
                }}
                style={{
                  flex: '1 1 120px',
                  minHeight: 52,
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: rejectSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
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
                    onChange={e =>
                      setAddPropertyForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'pending_approval' | 'pending' | 'active',
                      }))
                    }
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 13, outline: 'none', background: C.bg }}
                  >
                    <option value="pending_approval">بانتظار الموافقة</option>
                    <option value="pending">معلق (قديم)</option>
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
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    نقاط المالك (للاطلاع فقط):{' '}
                    <strong style={{ color: C.text }}>
                      {typeof selectedProperty.profiles?.points === 'number'
                        ? `💎 ${selectedProperty.profiles.points}`
                        : '—'}
                    </strong>
                  </div>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: '1rem' }}>{selectedProperty.description}</p>}

              <div style={{ background: C.amberLight, border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginBottom: '1rem', fontSize: 13, fontWeight: 800, color: '#92400e' }}>
                {activationCostLabelAr(selectedProperty)}
                {' — '}
                {listingPurposeFromProperty(selectedProperty) === 'sale' ? 'بيع' : 'إيجار'}
              </div>

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
                {isAwaitingPropertyApproval(selectedProperty.status) && (
                  <>
                    <button
                      type="button"
                      disabled={approvingPropertyId !== null}
                      onClick={() => void approveProperty(selectedProperty)}
                      style={{
                        flex: 1,
                        background: approvingPropertyId !== null ? '#86efac' : C.green,
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        padding: '12px',
                        fontFamily: 'Cairo, sans-serif',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: approvingPropertyId !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {approvingPropertyId === selectedProperty.id ? '⏳ جاري التفعيل...' : 'موافقة ✅'}
                    </button>
                    <button onClick={() => { setRejectId(selectedProperty.id); setRejectType('property'); setSelectedProperty(null) }}
                      style={{ flex: 1, background: C.red, color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      رفض ❌
                    </button>
                  </>
                )}
                {/* Phase 2: Delete button visible for ALL statuses */}
                <button onClick={() => { setDeletePropertyId(selectedProperty.id); setSelectedProperty(null) }}
                  style={{ flex: isAwaitingPropertyApproval(selectedProperty.status) ? '0 0 auto' : 1, background: C.redLight, color: C.red, border: `1px solid #fecaca`, borderRadius: 10, padding: '12px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
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

      {/* ── TABS (full bar on md+; on mobile only when "المزيد") ── */}
      <div
        className={(mobileMainTab === 'more' ? 'flex' : 'hidden') + ' md:flex'}
        style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem', gap: 2, overflowX: 'auto' }}
      >
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

      {/* ── Mobile: تبويبات رئيسية (إحصائيات / معاملات / خزنة) ── */}
      <div className="block w-full max-w-full pb-24 md:hidden" style={{ padding: '0.75rem 0.75rem 1rem' }}>
        {mobileMainTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: stats.totalUsers, l: 'إجمالي المستخدمين', icon: '👥', color: C.accent, bg: C.accentLight },
              { n: stats.pendingTransactions, l: 'شحنات معلقة', icon: '💳', color: C.red, bg: C.redLight },
              { n: stats.publishedProperties, l: 'إعلانات نشطة', icon: '✅', color: C.green, bg: C.greenLight },
            ].map((s, i) => (
              <div key={i} className="w-full max-w-full" style={{ ...card, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, background: s.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 13, color: C.faint }}>{s.l}</div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setMobileMainTab('more'); setTab('home') }}
              style={{
                minHeight: 52,
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: C.white,
                fontFamily: 'Cairo, sans-serif',
                fontSize: 15,
                fontWeight: 900,
                color: C.text,
                cursor: 'pointer',
              }}
            >
              المزيد — الإدارة الكاملة (إعلانات، ملاك، إعدادات)
            </button>
          </div>
        )}
        {mobileMainTab === 'transactions' && (
          <div className="w-full max-w-full" style={card}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px', color: C.text }}>المعاملات المعلقة</h2>
              <input
                type="search"
                placeholder="بحث بالاسم، الهاتف، المحوّل، أو رقم المعاملة..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 52,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {filteredPendingTransactions.length === 0
              ? <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا توجد معاملات مطابقة</p>
              : filteredPendingTransactions.map((t) => renderTransactionRow(t, true))}
          </div>
        )}
        {mobileMainTab === 'vault' && renderVaultPanel()}
      </div>

      <div
        className={(mobileMainTab === 'more' ? 'block' : 'hidden') + ' md:block w-full max-w-full md:max-w-[1100px] md:mx-auto'}
        style={{ padding: '1.5rem max(0.75rem, env(safe-area-inset-right)) 1.5rem max(0.75rem, env(safe-area-inset-left))' }}
      >
        {verifiedTxError && (
          <div style={{ marginBottom: '1rem', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            ⚠️ تعذر تحميل الشحنات المؤكدة — إجمالي المحصّل وأرصدة الملاك قد تكون غير دقيقة: {verifiedTxError}
          </div>
        )}

        {/* ══ HOME ══ */}
        {tab === 'home' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 168px), 1fr))', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
              {[
                { n: stats.totalBrokers, l: 'ملاك مسجلين', icon: '👥', color: C.accent, bg: C.accentLight },
                { n: stats.publishedProperties, l: 'إعلانات نشطة', icon: '✅', color: C.green, bg: C.greenLight },
                { n: stats.rejectedProperties, l: 'مرفوضة', icon: '❌', color: C.red, bg: C.redLight },
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
                    {' · '}
                    <span title="رصيد النقاط — للمعلومة فقط">
                      💎 {typeof p.profiles?.points === 'number' ? p.profiles.points : '—'}
                    </span>
                    {' · '}
                    <span style={{ color: C.amber, fontWeight: 800 }}>{activationCostLabelAr(p)}</span>
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
                    background: p.status === 'active' ? C.greenLight : isAwaitingPropertyApproval(p.status) ? C.amberLight : C.redLight,
                    color: p.status === 'active' ? C.green : isAwaitingPropertyApproval(p.status) ? C.amber : C.red,
                    borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap',
                  }}>
                    {p.status === 'active' ? 'نشط' : isAwaitingPropertyApproval(p.status) ? 'بانتظار الموافقة' : 'مرفوض'}
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
                    النقاط: <strong style={{ color: C.green }}>💎 {typeof b.points === 'number' ? b.points : 0}</strong>
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
                    placeholder="نقاط"
                    value={pointsAdjustInputs[b.id] ?? ''}
                    onChange={e => setPointsAdjustInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                    style={{
                      width: 90, border: `1.5px solid ${C.border}`, borderRadius: 8,
                      padding: '6px 10px', fontFamily: 'Cairo, sans-serif', fontSize: 13,
                      outline: 'none', background: C.bg, color: C.text, textAlign: 'center',
                    }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                  <button onClick={() => void adjustBrokerPoints(b.id, 1)}
                    style={{ background: C.greenLight, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + نقاط
                  </button>
                  <button onClick={() => void adjustBrokerPoints(b.id, -1)}
                    style={{ background: C.redLight, color: C.red, border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontFamily: 'Cairo, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    − نقاط
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
          <div className="w-full max-w-full" style={card}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 10px', color: C.text }}>المعاملات المعلقة ({transactions.length})</h2>
              <input
                type="search"
                placeholder="بحث بالاسم، الهاتف، رقم المحوّل، أو رقم المعاملة..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: 420,
                  minHeight: 44,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {filteredPendingTransactions.length === 0
              ? <p style={{ textAlign: 'center', color: C.faint, padding: '2rem' }}>لا توجد معاملات مطابقة</p>
              : filteredPendingTransactions.map((t) => renderTransactionRow(t, false))
            }
          </div>
        )}

        {tab === 'vault' && renderVaultPanel()}

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

      {toast ? (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-[250] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 rounded-2xl border-2 px-4 py-3.5 text-center text-[15px] font-extrabold shadow-xl md:bottom-8"
          style={{
            background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
            borderColor: toast.type === 'success' ? '#4ade80' : '#f87171',
            color: toast.type === 'success' ? '#14532d' : '#991b1b',
            fontFamily: 'Cairo, sans-serif',
          }}
        >
          {toast.type === 'success' ? '✓ ' : '✕ '}
          {toast.message}
        </div>
      ) : null}

      {/* شريط تنقل سفلي — موبايل فقط */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[90] flex border-t border-slate-200 bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.08)] md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {([
          { id: 'stats' as const, label: 'الإحصائيات', icon: '📊' },
          { id: 'transactions' as const, label: 'المعاملات', icon: '💳', badge: stats.pendingTransactions },
          { id: 'vault' as const, label: 'الخزنة', icon: '🔐' },
          { id: 'more' as const, label: 'المزيد', icon: '☰' },
        ]).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              if (b.id === 'more') {
                setMobileMainTab('more')
                setTab('home')
              } else {
                setMobileMainTab(b.id)
              }
            }}
            style={{
              flex: 1,
              minHeight: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              background: mobileMainTab === b.id || (b.id === 'more' && mobileMainTab === 'more') ? '#ecfdf5' : 'white',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 10,
              fontWeight: 800,
              color: mobileMainTab === b.id || (b.id === 'more' && mobileMainTab === 'more') ? '#15803d' : '#64748b',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, position: 'relative' }}>
              {b.icon}
              {b.badge && b.badge > 0 ? (
                <span style={{
                  position: 'absolute',
                  top: -6,
                  left: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {b.badge > 9 ? '9+' : b.badge}
                </span>
              ) : null}
            </span>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}