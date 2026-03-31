'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 1. إنشاء حساب في Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. حفظ بيانات السمسار في جدول profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user!.id,
        name: form.name,
        phone: form.phone,
        role: 'broker',
        wallet_balance: 0,
      })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          سجّل في أجرلي 🏠
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="الاسم الكامل"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="tel"
            placeholder="رقم الهاتف"
            required
            className="w-full border rounded-lg p-3 text-right"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
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
            {loading ? 'جاري التسجيل...' : 'إنشاء حساب'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-600">
          عندك حساب؟{' '}
          <a href="/login" className="text-blue-600 font-bold">
            سجّل دخول
          </a>
        </p>
      </div>
    </div>
  )
}