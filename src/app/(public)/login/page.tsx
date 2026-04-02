'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) { setError('البريد الإلكتروني أو كلمة المرور غلط'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin') router.push('/admin')
    else router.push('/broker')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #dcfce7', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: 22, fontWeight: 900, color: '#166534', textDecoration: 'none' }}>أجرلي</a>
        <a href="/register" style={{ fontSize: 13, color: '#166534', fontWeight: 700, textDecoration: 'none' }}>مش عندك حساب؟ سجّل دلوقتي</a>
      </nav>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: 56, height: 56, background: '#166534', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 28, height: 28 }}>
                <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>أهلاً بك في أجرلي</h1>
            <p style={{ fontSize: 14, color: '#64748b' }}>سجّل دخولك لإدارة إعلاناتك</p>
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
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: '1.25rem' }}>
              مش عندك حساب؟{' '}
              <a href="/register" style={{ color: '#166534', fontWeight: 900, textDecoration: 'none' }}>سجّل مجاناً</a>
            </p>
          </div>

          {/* INFO */}
          <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#166534', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 16, height: 16 }}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p style={{ fontSize: 13, color: '#166534', fontWeight: 700, margin: 0 }}>مالك عقار؟ سجّل وارفع أول إعلانين مجاناً</p>
          </div>
        </div>
      </div>
    </div>
  )
}