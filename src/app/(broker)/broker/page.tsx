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
  created_at: string
  rejection_reason: string | null
  description: string | null
  address: string | null
  images: string[]
  unit_type: string
  owner?: {
    name: string
    phone: string
    is_active: boolean
  }
}

type Stats = {
  totalProperties: number
  totalLeads: number
  walletBalance: number
  name: string
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'قيد المراجعة', bg: '#fef3c7', color: '#92400e' },
  active:   { label: 'نشط',          bg: '#dcfce7', color: '#166534' },
  rejected: { label: 'مرفوض',        bg: '#fee2e2', color: '#991b1b' },
  archived: { label: 'مؤرشف',        bg: '#f1f5f9', color: '#475569' },
}

export default function BrokerDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({ totalProperties: 0, totalLeads: 0, walletBalance: 0, name: '' })
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [listingCost, setListingCost] = useState(50)
  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    try {
      console.log('🔍 === STEP 1: INSPECT AUTH ===')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('❌ Auth Error:', userError)
      }
      console.log('✅ USER:', user)
      console.log('✅ USER ID:', user?.id)
      console.log('✅ USER EMAIL:', user?.email)
      console.log('✅ USER METADATA:', user?.user_metadata)
      
      if (!user) { 
        console.log('❌ NO USER FOUND - Redirecting to login')
        router.push('/login'); 
        return 
      }

      console.log('\n🔍 === STEP 2: INSPECT DATABASE DATA ===')
      // Fetch ALL properties without filters
      const { data: allProperties, error: allPropsError } = await supabase
        .from('properties')
        .select('*')
      
      if (allPropsError) {
        console.error('❌ All Properties Error:', allPropsError)
      }
      console.log('✅ ALL PROPERTIES:', allProperties)
      console.log('✅ TOTAL PROPERTIES COUNT:', allProperties?.length)

      console.log('\n🔍 === STEP 3: COMPARE IDS ===')
      console.log('✅ USER ID FROM AUTH:', user.id)
      console.log('✅ OWNER_ID VALUES FROM PROPERTIES:', allProperties?.map(p => ({ id: p.id, title: p.title, owner_id: p.owner_id })))
      
      // Check if any properties match user ID
      const matchingProperties = allProperties?.filter(p => p.owner_id === user.id) || []
      console.log('✅ PROPERTIES MATCHING USER ID:', matchingProperties.length)
      console.log('✅ MATCHING PROPERTIES:', matchingProperties)

      console.log('\n🔍 === STEP 4: CHECK PROFILES TABLE ===')
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*')
      if (profilesError) {
        console.error('❌ Profiles Error:', profilesError)
      }
      console.log('✅ ALL PROFILES:', profiles)
      console.log('✅ PROFILE IDS:', profiles?.map(p => ({ id: p.id, name: p.name, email: p.email })))
      
      // Check if user profile exists
      const userProfile = profiles?.find(p => p.id === user.id)
      console.log('✅ USER PROFILE:', userProfile)
      console.log('✅ DOES PROFILE ID MATCH USER ID?:', userProfile ? 'YES' : 'NO')

      console.log('\n🔍 === STEP 5: TEST FILTER ===')
      // Test with user.id
      const { data: filteredByUserId, error: filteredError } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user.id)
      
      console.log('✅ FILTERED BY USER ID:', filteredByUserId)
      console.log('✅ FILTERED BY USER ID COUNT:', filteredByUserId?.length)
      console.log('✅ FILTER ERROR:', filteredError)

      // If no results, try with hardcoded ID from database
      if (!filteredByUserId || filteredByUserId.length === 0) {
        console.log('\n🔍 === STEP 5B: TRY HARDCODED ID ===')
        const firstProperty = allProperties?.[0]
        if (firstProperty?.owner_id) {
          console.log('✅ TRYING WITH HARDCODED ID:', firstProperty.owner_id)
          const { data: hardcodedTest, error: hardcodedError } = await supabase
            .from('properties')
            .select('*')
            .eq('owner_id', firstProperty.owner_id)
          
          console.log('✅ HARDCODED TEST RESULT:', hardcodedTest)
          console.log('✅ HARDCODED TEST COUNT:', hardcodedTest?.length)
          console.log('✅ HARDCODED ERROR:', hardcodedError)
          
          if (hardcodedTest && hardcodedTest.length > 0) {
            console.log('🎯 ROOT CAUSE: ID MISMATCH - Query works but user.id != owner_id')
          }
        }
      }

      console.log('\n🔍 === STEP 6: CHECK RLS ===')
      // Try to check RLS by attempting to access system tables
      try {
        const { data: rlsCheck, error: rlsError } = await supabase
          .from('properties')
          .select('id, title')
          .limit(1)
        
        console.log('✅ RLS CHECK - Can access at least 1 property?:', rlsCheck ? 'YES' : 'NO')
        console.log('✅ RLS CHECK ERROR:', rlsError)
      } catch (rlsException) {
        console.error('❌ RLS EXCEPTION:', rlsException)
      }

      console.log('\n🔍 === STEP 7: DETECT ROOT CAUSE ===')
      
      // Root cause detection logic
      let rootCause = 'UNKNOWN'
      if (!user) {
        rootCause = 'NO_USER_LOGGED_IN'
      } else if (!allProperties || allProperties.length === 0) {
        rootCause = 'NO_PROPERTIES_IN_DATABASE'
      } else if (matchingProperties.length === 0 && allProperties.length > 0) {
        if (allProperties.some(p => p.owner_id)) {
          rootCause = 'ID_MISMATCH_BETWEEN_AUTH_AND_PROPERTIES'
        } else {
          rootCause = 'PROPERTIES_HAVE_NO_OWNER_ID'
        }
      } else if (filteredError) {
        rootCause = 'RLS_BLOCKING_ACCESS'
      }
      
      console.log('🎯 ROOT CAUSE DETECTED:', rootCause)

      console.log('\n🔍 === STEP 8: APPLY FIX ===')
      
      let finalProperties = []
      
      // Apply fix based on root cause
      switch (rootCause) {
        case 'ID_MISMATCH_BETWEEN_AUTH_AND_PROPERTIES':
          console.log('🔧 FIX: Using profile-based query')
          // Try to get properties through profile relationship
          if (userProfile) {
            const { data: profileBasedProps } = await supabase
              .from('properties')
              .select('*')
              .eq('owner_id', userProfile.id)
            finalProperties = profileBasedProps || []
            console.log('✅ PROFILE-BASED PROPERTIES:', finalProperties)
          }
          break
          
        case 'RLS_BLOCKING_ACCESS':
          console.log('🔧 FIX: Attempting RLS bypass for debugging')
          // This would need to be fixed in Supabase console
          console.log('❌ RLS ISSUE - Must be fixed in Supabase console')
          break
          
        case 'PROPERTIES_HAVE_NO_OWNER_ID':
          console.log('🔧 FIX: Properties need owner_id assignment')
          console.log('❌ DATA ISSUE - Properties need to be assigned to users')
          break
          
        default:
          finalProperties = matchingProperties
          break
      }

      console.log('✅ FINAL PROPERTIES TO DISPLAY:', finalProperties)

      // Get profile data for stats
      const { data: profile, error: profileError } = await supabase.from('profiles').select('name, wallet_balance, is_active, phone').eq('id', user.id).single()
      const { data: costSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'listing_cost')
        .single()

      setListingCost(Number(costSetting?.value ?? 50))
      if (profileError) {
        console.error('Error fetching profile:', profileError)
      }
      
      // Check if account is active
      if (profile && !profile.is_active) {
        alert('حسابك متوقف')
        router.push('/login')
        return
      }

    const propertyIds = finalProperties?.map(p => p.id) ?? []
    let leadsCount = 0
    if (propertyIds.length > 0) {
      const { data: leadsData, count, error: leadsError } = await supabase
        .from('leads')
        .select('id, client_name, client_phone, property_id', { count: 'exact' })
        .in('property_id', propertyIds)
      if (leadsError) {
        console.error('Error fetching leads count:', leadsError)
      }
      leadsCount = count ?? 0
      setLeads(leadsData ?? [])
    }
      // Add owner data to properties
      const propertiesWithOwner = finalProperties?.map(property => ({
        ...property,
        owner: {
          name: profile?.name || '',
          phone: profile?.phone || '',
          is_active: profile?.is_active || false
        }
      })) ?? []

      setStats({ name: profile?.name ?? '', walletBalance: profile?.wallet_balance ?? 0, totalProperties: finalProperties?.length ?? 0, totalLeads: leadsCount })
      setProperties(propertiesWithOwner)
      
      console.log('\n🎉 === DASHBOARD LOADING COMPLETE ===')
      console.log('✅ STATS:', { name: profile?.name, totalProperties: finalProperties?.length, totalLeads: leadsCount })
      
    } catch (error) {
      console.error('❌ FATAL ERROR IN loadDashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid #e2e8f0', borderTop: '3px solid #065f46', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: 'inherit', direction: 'rtl' }}>

      {/* MODAL */}
      {selectedProperty && (
        <div onClick={() => setSelectedProperty(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', padding: '1.5rem', borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 4px' }}>{selectedProperty.title}</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {selectedProperty.area}{selectedProperty.address ? ` — ${selectedProperty.address}` : ''}</p>
              </div>
              <button onClick={() => setSelectedProperty(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 16, transition: 'all 0.3s ease', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {selectedProperty.images?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
                  {selectedProperty.images.map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: 12, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>السعر الشهري</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#065f46' }}>{selectedProperty.price.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>الحالة</div>
                  <span style={{ background: STATUS_MAP[selectedProperty.status]?.bg, color: STATUS_MAP[selectedProperty.status]?.color, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '4px 12px', display: 'inline-block' }}>{STATUS_MAP[selectedProperty.status]?.label}</span>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: '1.5rem', fontWeight: 500 }}>{selectedProperty.description}</p>}
              {selectedProperty.owner && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: 13, color: '#0f172a', fontWeight: 700, margin: '0 0 8px' }}>معلومات المالك</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 500 }}>المالك: {selectedProperty.owner.name}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontWeight: 500 }}>📞 {selectedProperty.owner.phone}</p>
                </div>
              )}
              {selectedProperty.status === 'rejected' && selectedProperty.rejection_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, margin: 0 }}>سبب الرفض: {selectedProperty.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ fontSize: 22, fontWeight: 900, color: '#065f46', textDecoration: 'none' }}>أجرلي</a>
          <span style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', color: '#065f46', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid #bbf7d0' }}>لوحة المالك</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#065f46', border: '2px solid #bbf7d0' }}>
            {stats.name.charAt(0)}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', transition: 'color 0.3s ease', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.color = '#0f172a'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>خروج</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* WELCOME */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>أهلاً، {stats.name} 👋</h1>
          <p style={{ fontSize: 15, color: '#64748b', fontWeight: 500 }}>إدارة إعلاناتك ومتابعة العملاء</p>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {[
            { n: stats.totalProperties, l: 'إعلاناتي', icon: '🏠', color: '#065f46', bg: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '#bbf7d0' },
            { n: stats.totalLeads, l: 'عملاء مهتمين', icon: '👥', color: '#1d4ed8', bg: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', border: '#bfdbfe' },
            { n: `${stats.walletBalance} ج.م`, l: 'رصيد المحفظة', icon: '💰', color: '#b45309', bg: 'linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%)', border: '#fcd34d' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 16, padding: '1.5rem', border: `1px solid ${s.border}`, textAlign: 'center', transition: 'all 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}>
              <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 14px', backdropFilter: 'blur(8px)' }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, marginBottom: 6 }}>{s.n}</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* WALLET CARD */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', borderRadius: 20, padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', boxShadow: '0 20px 25px -5px rgba(6, 95, 70, 0.2)' }}>
          <div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: '0 0 8px', fontWeight: 500 }}>رصيد المحفظة</p>
            <p style={{ fontSize: 36, fontWeight: 900, color: 'white', margin: 0 }}>{stats.walletBalance} ج.م</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontWeight: 500 }}>كل إعلان بعد المجاني = {listingCost} ج.م</p>
          </div>
          <button onClick={() => router.push('/broker/wallet')} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 12, padding: '12px 28px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1)'; }}>
            شحن رصيد
          </button>
        </div>

        {/* PROPERTIES */}
        <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>إعلاناتي</h2>
            <button onClick={() => router.push('/broker/add-property')} style={{ background: '#065f46', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.background = '#047857'; e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(6, 95, 70, 0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#065f46'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}>
              + إعلان جديد
            </button>
          </div>

          {properties.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏠</div>
              <p style={{ color: '#94a3b8', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>مفيش إعلانات لحد دلوقتي</p>
              <button onClick={() => router.push('/broker/add-property')} style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(6, 95, 70, 0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 95, 70, 0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 95, 70, 0.2)'; }}>
                ارفع أول إعلان مجاناً
              </button>
            </div>
          ) : (
            <div>
              {properties.map((p, idx) => (
                <div key={p.id} onClick={() => setSelectedProperty(p)} style={{ padding: '1.25rem 1.5rem', borderBottom: idx !== properties.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', gap: '1rem' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateX(-4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>📍 {p.area} · {p.price.toLocaleString()} ج.م/شهر</p>
                    {p.status === 'rejected' && p.rejection_reason && (
                      <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0', fontWeight: 700 }}>سبب الرفض: {p.rejection_reason}</p>
                    )}
                  </div>
                  <span style={{ background: STATUS_MAP[p.status]?.bg, color: STATUS_MAP[p.status]?.color, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid currentColor', borderOpacity: 0.2 }}>
                    {STATUS_MAP[p.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUICK LINKS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
          <button onClick={() => router.push('/broker/wallet')} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(6, 95, 70, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>المحفظة</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>شحن الرصيد</p>
            </div>
          </button>
          <button onClick={() => router.push('/broker/add-property')} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(6, 95, 70, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>➕</div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>إعلان جديد</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>رفع عقار</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
