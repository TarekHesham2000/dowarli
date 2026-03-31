'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError('البريد الإلكتروني أو كلمة المرور غلط')
      setLoading(false)
      return
    }

    // جيب role السمسار
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    // وجّهه حسب الـ role
    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/broker')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          أهلاً بك في أجرلي 🏠
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-600">
          مش عندك حساب؟{' '}
          <a href="/register" className="text-blue-600 font-bold">
            سجّل دلوقتي
          </a>
        </p>
      </div>
    </div>
  )
}