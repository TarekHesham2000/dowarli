'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user!.id,
      name: form.name,
      phone: form.phone,
      role: 'broker',
      wallet_balance: 0,
    })

    if (profileError) { setError(profileError.message); setLoading(false); return }
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
      
      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #dcfce7', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: 22, fontWeight: 900, color: '#166534', textDecoration: 'none' }}>دَورلي</a>
        <a href="/login" style={{ fontSize: 13, color: '#166534', fontWeight: 700, textDecoration: 'none' }}>عندك حساب؟ سجّل دخول</a>
      </nav>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          
          {/* HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: 56, height: 56, background: '#166534', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 28, height: 28 }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>انضم كمالك عقار</h1>
            <p style={{ fontSize: 14, color: '#64748b' }}>ارفع أول إعلانين مجاناً</p>
          </div>

          {/* FORM */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.75rem', border: '1px solid #dcfce7', boxShadow: '0 4px 24px rgba(22,101,52,0.08)' }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>الاسم الكامل</label>
                <input
                  type="text"
                  placeholder="محمد أحمد"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#166534'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>رقم الهاتف</label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  required
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#166534'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none', transition: 'border 0.2s', direction: 'ltr', textAlign: 'right' }}
                  onFocus={e => e.target.style.borderColor = '#166534'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>كلمة المرور</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none', transition: 'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#166534'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: loading ? '#86efac' : '#166534', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Cairo, sans-serif', marginTop: 4, transition: 'all 0.2s' }}
              >
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب مجاني'}
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: '1.25rem' }}>
              عندك حساب بالفعل؟{' '}
              <a href="/login" style={{ color: '#166534', fontWeight: 900, textDecoration: 'none' }}>سجّل دخول</a>
            </p>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: '1rem', lineHeight: 1.8 }}>
              بالتسجيل أنت توافق على{' '}
              <a href="/terms" style={{ color: '#166534', fontWeight: 700, textDecoration: 'none' }}>الشروط والأحكام</a>
              {' '}و{' '}
              <a href="/privacy" style={{ color: '#166534', fontWeight: 700, textDecoration: 'none' }}>سياسة الخصوصية</a>
            </p>
          </div>

          {/* FREE BADGE */}
          <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#166534', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 16, height: 16 }}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p style={{ fontSize: 13, color: '#166534', fontWeight: 700, margin: 0 }}>أول إعلانين مجاناً — بدون أي رسوم</p>
          </div>
        </div>
      </div>
    </div>
  )
}