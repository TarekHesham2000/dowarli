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

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()

    const { data: trans } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, rejection_reason')
      .eq('broker_id', user.id)
      .order('created_at', { ascending: false })

    setBalance(profile?.wallet_balance ?? 0)
    setTransactions(trans ?? [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !amount) { setError('اختار صورة وادخل المبلغ'); return }
    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileName = `receipts/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('properties')
      .upload(fileName, file)

    if (uploadError) { setError('فشل رفع الصورة'); setUploading(false); return }

    const { data: urlData } = supabase.storage
      .from('properties')
      .getPublicUrl(fileName)

    await supabase.from('transactions').insert({
      broker_id: user.id,
      amount: Number(amount),
      screenshot_url: urlData.publicUrl,
      status: 'pending'
    })

    setSuccess('تم إرسال طلب الشحن! هينضاف رصيدك بعد تأكيد الأدمن.')
    setAmount('')
    setFile(null)
    setUploading(false)
    loadData()
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending:  { label: 'قيد المراجعة', color: 'text-yellow-600' },
    verified: { label: 'تم التأكيد',   color: 'text-green-600' },
    rejected: { label: 'مرفوض',        color: 'text-red-600' },
  }

  if (loading) return (
    <div className='min-h-screen flex items-center justify-center'>
      <p className='text-gray-500'>جاري التحميل...</p>
    </div>
  )

  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      <div className='bg-white shadow-sm px-6 py-4 flex justify-between items-center'>
        <h1 className='text-xl font-bold text-blue-600'>المحفظة</h1>
        <button onClick={() => router.push('/broker')} className='text-sm text-blue-500'>العودة للوحة التحكم</button>
      </div>
      <div className='max-w-2xl mx-auto px-4 py-8 space-y-6'>
        <div className='bg-white rounded-2xl shadow-sm p-6 text-center'>
          <p className='text-4xl font-bold text-yellow-600'>{balance} ج.م</p>
          <p className='text-gray-500 mt-1'>رصيدك الحالي</p>
        </div>
        <div className='bg-white rounded-2xl shadow-sm p-6'>
          <h2 className='text-lg font-bold mb-4'>طلب شحن رصيد</h2>
          <p className='text-sm text-gray-500 mb-4'>حوّل على فودافون كاش أو انستاباي ثم ارفع صورة الإيصال</p>
          {success && <div className='bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm'>{success}</div>}
          {error && <div className='bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm'>{error}</div>}
          <form onSubmit={handleSubmit} className='space-y-4'>
            <input
              type='number'
              placeholder='المبلغ (ج.م)'
              required
              className='w-full border rounded-lg p-3 text-right'
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <div className='border-2 border-dashed rounded-lg p-4 text-center'>
              <input type='file' accept='image/*' onChange={e => setFile(e.target.files?.[0] ?? null)} className='hidden' id='receipt' />
              <label htmlFor='receipt' className='cursor-pointer text-blue-600 text-sm'>
                {file ? file.name : 'ارفع صورة الإيصال'}
              </label>
            </div>
            <button type='submit' disabled={uploading} className='w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50'>
              {uploading ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
            </button>
          </form>
        </div>
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <div className='p-4 border-b'><h2 className='font-bold'>سجل المعاملات</h2></div>
          {transactions.length === 0 ? (
            <p className='text-center text-gray-400 py-8'>مفيش معاملات لحد دلوقتي</p>
          ) : (
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 text-gray-500'>
                <tr>
                  <th className='p-4 text-right'>المبلغ</th>
                  <th className='p-4 text-right'>الحالة</th>
                  <th className='p-4 text-right'>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className='border-t'>
                    <td className='p-4 font-medium'>{t.amount} ج.م</td>
                    <td className='p-4'>
                      <span className={`font-bold ${STATUS_MAP[t.status]?.color}`}>{STATUS_MAP[t.status]?.label}</span>
                      {t.status === 'rejected' && t.rejection_reason && (
                        <p className='text-xs text-red-400 mt-1'>السبب: {t.rejection_reason}</p>
                      )}
                    </td>
                    <td className='p-4 text-gray-500'>{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}