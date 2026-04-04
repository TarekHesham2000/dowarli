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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>جاري التحميل...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: 'inherit', direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ fontSize: 22, fontWeight: 900, color: '#065f46', textDecoration: 'none' }}>أجرلي</a>
          <span style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', color: '#065f46', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid #bbf7d0' }}>المحفظة</span>
        </div>
        <button onClick={() => router.push('/broker')} style={{ background: 'none', border: 'none', color: '#065f46', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#047857'} onMouseLeave={e => e.currentTarget.style.color = '#065f46'}>
          ← لوحة التحكم
        </button>
      </nav>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* BALANCE CARD */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', borderRadius: 20, padding: '2.5rem 2rem', marginBottom: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 20px 25px -5px rgba(6, 95, 70, 0.2)' }}>
          <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 10px', fontWeight: 500 }}>رصيدك الحالي</p>
          <p style={{ fontSize: 52, fontWeight: 900, margin: '0 0 8px' }}>{balance}</p>
          <p style={{ fontSize: 16, opacity: 0.8, margin: 0, fontWeight: 500 }}>جنيه مصري</p>
        </div>

        {/* CHARGE FORM */}
        <div style={{ background: '#ffffff', borderRadius: 20, padding: '2rem', border: '1px solid #f1f5f9', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>طلب شحن رصيد</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 1.5rem', fontWeight: 500 }}>حوّل على فودافون كاش أو انستاباي ثم ارفع صورة الإيصال</p>

          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#065f46', fontWeight: 700, marginBottom: '1.5rem' }}>
              ✅ {success}
            </div>
          )}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626', marginBottom: '1.5rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>المبلغ (ج.م)</label>
              <input
                type="number"
                placeholder="100"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', transition: 'all 0.3s ease', background: '#ffffff' }}
                onFocus={e => { e.target.style.borderColor = '#065f46'; e.target.style.boxShadow = '0 0 0 3px rgba(6, 95, 70, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>صورة الإيصال</label>
              <label htmlFor="receipt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #bbf7d0', borderRadius: 12, padding: '2rem 1rem', cursor: 'pointer', background: file ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : '#fafafa', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#065f46'; e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#bbf7d0'; if (!file) e.currentTarget.style.background = '#fafafa'; }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={file ? '#065f46' : '#94a3b8'} strokeWidth="2" style={{ width: 24, height: 24, transition: 'all 0.3s ease' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: file ? '#065f46' : '#94a3b8', transition: 'all 0.3s ease' }}>
                  {file ? file.name : 'اضغط لرفع الإيصال'}
                </span>
              </label>
              <input type="file" accept="image/*" id="receipt" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            </div>

            <button
              type="submit"
              disabled={uploading}
              style={{ width: '100%', background: uploading ? 'linear-gradient(135deg, #d1fae5 0%, #c7f0e0 100%)' : 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: uploading ? '#047857' : 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.3s ease', marginTop: 4, boxShadow: uploading ? 'none' : '0 4px 12px rgba(6, 95, 70, 0.2)' }} onMouseEnter={e => { if (!uploading) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 95, 70, 0.3)'; } }} onMouseLeave={e => { if (!uploading) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 95, 70, 0.2)'; } }}
            >
              {uploading ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
            </button>
          </form>
        </div>

        {/* TRANSACTIONS */}
        <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>سجل المعاملات</h2>
          </div>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 1rem', fontSize: 14, fontWeight: 500 }}>مفيش معاملات لحد دلوقتي</p>
          ) : (
            transactions.map((t, idx) => (
              <div key={t.id} style={{ padding: '1.25rem 1.5rem', borderBottom: idx !== transactions.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: t.status === 'rejected' && t.rejection_reason ? 8 : 0 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>{t.amount} ج.م</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <span style={{ background: STATUS_MAP[t.status]?.bg, color: STATUS_MAP[t.status]?.color, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '4px 12px', whiteSpace: 'nowrap', marginLeft: '1rem', border: '1px solid currentColor', borderOpacity: 0.2 }}>
                    {STATUS_MAP[t.status]?.label}
                  </span>
                </div>
                {t.status === 'rejected' && t.rejection_reason && (
                  <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, margin: 0, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>
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
