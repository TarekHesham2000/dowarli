'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Transaction = {
  id: number
  amount: number
  status: string
  created_at: string
  rejection_reason: string | null
}

export default function WalletPage() {
  const router = useRouter()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
    const { data: trans } = await supabase.from('transactions').select('id, amount, status, created_at, rejection_reason').eq('broker_id', user.id).order('created_at', { ascending: false })

    setBalance(profile?.wallet_balance ?? 0)
    setTransactions(trans ?? [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !amount) { setError('اختار صورة وادخل المبلغ'); return }
    setUploading(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileName = `receipts/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('properties').upload(fileName, file)
    if (uploadError) { setError('فشل رفع الصورة'); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('properties').getPublicUrl(fileName)

    await supabase.from('transactions').insert({
      broker_id: user.id,
      amount: Number(amount),
      screenshot_url: urlData.publicUrl,
      status: 'pending'
    })

    setSuccess('تم إرسال طلب الشحن! هينضاف رصيدك بعد تأكيد الأدمن.')
    setAmount('')
    setFile(null)
    // reset file input
    const fileInput = document.getElementById('receipt') as HTMLInputElement
    if (fileInput) fileInput.value = ''
    setUploading(false)
    loadData()
  }

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'قيد المراجعة', color: '#92400e', bg: '#fef3c7' },
    verified: { label: 'تم التأكيد',   color: '#166534', bg: '#dcfce7' },
    rejected: { label: 'مرفوض',        color: '#991b1b', bg: '#fee2e2' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif' }}>
      <p style={{ color: '#64748b' }}>جاري التحميل...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 20, fontWeight: 900, color: '#166534', textDecoration: 'none' }}>أجرلي</a>
          <span style={{ background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>المحفظة</span>
        </div>
        <button onClick={() => router.push('/broker')} style={{ background: 'none', border: 'none', color: '#166534', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* BALANCE CARD */}
        <div style={{ background: 'linear-gradient(135deg, #166534, #14532d)', borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', textAlign: 'center', color: 'white' }}>
          <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 8px' }}>رصيدك الحالي</p>
          <p style={{ fontSize: 48, fontWeight: 900, margin: '0 0 8px' }}>{balance}</p>
          <p style={{ fontSize: 16, opacity: 0.7, margin: 0 }}>جنيه مصري</p>
        </div>

        {/* CHARGE FORM */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #f1f5f9', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>طلب شحن رصيد</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 1.25rem' }}>حوّل على فودافون كاش أو انستاباي ثم ارفع صورة الإيصال</p>

          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#166534', fontWeight: 700, marginBottom: '1rem' }}>
              ✅ {success}
            </div>
          )}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>المبلغ (ج.م)</label>
              <input
                type="number"
                placeholder="100"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Cairo, sans-serif', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = '#166534'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>صورة الإيصال</label>
              <label htmlFor="receipt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed #bbf7d0', borderRadius: 10, padding: '1rem', cursor: 'pointer', background: file ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={file ? '#166534' : '#94a3b8'} strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: file ? '#166534' : '#94a3b8' }}>
                  {file ? file.name : 'اضغط لرفع الإيصال'}
                </span>
              </label>
              <input type="file" accept="image/*" id="receipt" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            </div>

            <button
              type="submit"
              disabled={uploading}
              style={{ width: '100%', background: uploading ? '#86efac' : '#166534', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'Cairo, sans-serif' }}
            >
              {uploading ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
            </button>
          </form>
        </div>

        {/* TRANSACTIONS */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>سجل المعاملات</h2>
          </div>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: 14 }}>مفيش معاملات لحد دلوقتي</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.status === 'rejected' && t.rejection_reason ? 6 : 0 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 3px' }}>{t.amount} ج.م</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <span style={{ background: STATUS_MAP[t.status]?.bg, color: STATUS_MAP[t.status]?.color, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '4px 12px' }}>
                    {STATUS_MAP[t.status]?.label}
                  </span>
                </div>
                {t.status === 'rejected' && t.rejection_reason && (
                  <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, margin: '6px 0 0', background: '#fef2f2', padding: '6px 10px', borderRadius: 8 }}>
                    سبب الرفض: {t.rejection_reason}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}