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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #dcfce7', borderTop: '3px solid #166534', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>جاري التحميل...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* MODAL */}
      {selectedProperty && (
        <div onClick={() => setSelectedProperty(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: 'linear-gradient(135deg, #166534, #14532d)', padding: '1.25rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: '0 0 4px' }}>{selectedProperty.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>📍 {selectedProperty.area}{selectedProperty.address ? ` — ${selectedProperty.address}` : ''}</p>
              </div>
              <button onClick={() => setSelectedProperty(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {selectedProperty.images?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: '1rem' }}>
                  {selectedProperty.images.map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>السعر الشهري</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#166534' }}>{selectedProperty.price.toLocaleString()} ج.م</div>
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>الحالة</div>
                  <span style={{ background: STATUS_MAP[selectedProperty.status]?.bg, color: STATUS_MAP[selectedProperty.status]?.color, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '3px 10px' }}>{STATUS_MAP[selectedProperty.status]?.label}</span>
                </div>
              </div>
              {selectedProperty.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: '1rem' }}>{selectedProperty.description}</p>}
              {selectedProperty.owner && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: '1rem' }}>
                  <p style={{ fontSize: 13, color: '#0f172a', fontWeight: 700, margin: '0 0 6px' }}>معلومات المالك</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>المالك: {selectedProperty.owner.name}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>📞 {selectedProperty.owner.phone}</p>
                </div>
              )}
              {selectedProperty.status === 'rejected' && selectedProperty.rejection_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, margin: 0 }}>سبب الرفض: {selectedProperty.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 20, fontWeight: 900, color: '#166534', textDecoration: 'none' }}>أجرلي</a>
          <span style={{ background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>لوحة المالك</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#166534' }}>
            {stats.name.charAt(0)}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>خروج</button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* WELCOME */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>أهلاً، {stats.name} 👋</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>إدارة إعلاناتك ومتابعة العملاء</p>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { n: stats.totalProperties, l: 'إعلاناتي', icon: '🏠', color: '#166534', bg: '#f0fdf4' },
            { n: stats.totalLeads, l: 'عملاء مهتمين', icon: '👥', color: '#1d4ed8', bg: '#eff6ff' },
            { n: `${stats.walletBalance} ج.م`, l: 'رصيد المحفظة', icon: '💰', color: '#d97706', bg: '#fef3c7' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', border: '1px solid #f1f5f9', textAlign: 'center' }}>
              <div style={{ width: 42, height: 42, background: s.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>{s.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* WALLET CARD */}
        <div style={{ background: 'linear-gradient(135deg, #166534, #14532d)', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>رصيد المحفظة</p>
            <p style={{ fontSize: 32, fontWeight: 900, color: 'white', margin: 0 }}>{stats.walletBalance} ج.م</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>كل إعلان بعد المجاني = {listingCost} ج.م</p>          </div>
          <button onClick={() => router.push('/broker/wallet')} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 12, padding: '10px 22px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            شحن رصيد
          </button>
        </div>

        {/* PROPERTIES */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f8fafc' }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>إعلاناتي</h2>
            <button onClick={() => router.push('/broker/add-property')} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              + إعلان جديد
            </button>
          </div>

          {properties.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>مفيش إعلانات لحد دلوقتي</p>
              <button onClick={() => router.push('/broker/add-property')} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ارفع أول إعلان مجاناً
              </button>
            </div>
          ) : (
            <div>
              {properties.map(p => (
                <div key={p.id} onClick={() => setSelectedProperty(p)} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s', gap: '1rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>📍 {p.area} · {p.price.toLocaleString()} ج.م/شهر</p>
                    {p.status === 'rejected' && p.rejection_reason && (
                      <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0', fontWeight: 700 }}>سبب الرفض: {p.rejection_reason}</p>
                    )}
                  </div>
                  <span style={{ background: STATUS_MAP[p.status]?.bg, color: STATUS_MAP[p.status]?.color, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {STATUS_MAP[p.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUICK LINKS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={() => router.push('/broker/wallet')} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
            <div style={{ width: 36, height: 36, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>المحفظة</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>شحن الرصيد</p>
            </div>
          </button>
          <button onClick={() => router.push('/broker/add-property')} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
            <div style={{ width: 36, height: 36, background: '#f0fdf4', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>➕</div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>إعلان جديد</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>رفع عقار</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}