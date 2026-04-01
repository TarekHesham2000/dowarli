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
  images: string[]
description: string
address: string
profiles: { name: string; phone: string }

}

type Transaction = {
  id: number
  amount: number
  screenshot_url: string
  status: string
  broker_id: string
  images: string[]
description: string
address: string
profiles: { name: string; phone: string }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'properties' | 'transactions'>('properties')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: props } = await supabase
      .from('properties')
      .select('id, title, area, price, status, images, description, address, profiles(name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const { data: trans } = await supabase
      .from('transactions')
      .select('id, amount, screenshot_url, status, broker_id, profiles(name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setProperties((props as unknown as Property[]) ?? [])
    setTransactions((trans as unknown as Transaction[]) ?? [])
    setLoading(false)
  }

  const handleProperty = async (id: number, status: 'active' | 'rejected') => {
    await supabase.from('properties').update({ status }).eq('id', id)
    loadData()
  }

  const handleTransaction = async (id: number, brokerId: string, amount: number) => {
    await supabase.from('transactions').update({ status: 'verified' }).eq('id', id)
    await supabase.rpc('add_wallet', { user_id: brokerId, amount })
    loadData()
  }
  const handleRejectProperty = async () => {
  if (!rejectId || !rejectReason) return
  await supabase.from('properties').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
  setRejectId(null)
  setRejectReason('')
  loadData()
  }
  const handleRejectTransaction = async () => {
    if (!rejectId || !rejectReason) return
    await supabase.from('transactions').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
    setRejectId(null)
    setRejectReason('')
    loadData()
  }

  if (loading) return (
    <div className='min-h-screen flex items-center justify-center'>
      <p className='text-gray-500'>loading...</p>
    </div>
  )

  return (
    <div className='min-h-screen bg-gray-50' dir='rtl'>
      <div className='bg-white shadow-sm px-6 py-4 flex justify-between items-center'>
        <h1 className='text-xl font-bold text-blue-600'>Admin Panel</h1>
        <div className='flex gap-4'>
          <button onClick={loadData} className='text-sm text-blue-500'>refresh</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className='text-sm text-red-500'>logout</button>
        </div>
      </div>
      
      {selectedProperty && (
        <div className='fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50'>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4' >
            <div className='flex justify-between items-center mb-4'>
              <h2 className='font-bold text-lg'>{selectedProperty.title}</h2>
              <button onClick={() => setSelectedProperty(null)} className='text-gray-400 text-xl'>x</button>
            </div>
            <p className='text-gray-500 text-sm mb-1'>المنطقة: {selectedProperty.area}</p>
            <p className='text-gray-500 text-sm mb-1'>السعر: {selectedProperty.price}</p>
            <p className='text-gray-500 text-sm mb-4'>السمسار: {selectedProperty.profiles?.name}</p>
            {selectedProperty.address && <p className='text-gray-500 text-sm mb-1'>العنوان: {selectedProperty.address}</p>}
            {selectedProperty.description && <p className='text-gray-500 text-sm mb-4'>الوصف: {selectedProperty.description}</p>}
            {selectedProperty.images?.length > 0 && (
              <div className='grid grid-cols-3 gap-2 mt-2'>
                {selectedProperty.images.map((img, i) => (
                  <img key={i} src={img} alt='property' className='w-full h-24 object-cover rounded-lg' />
                ))}
              </div>
            )}
            <div className='flex gap-2 mt-4'>
              <button onClick={() => { handleProperty(selectedProperty.id, 'active'); setSelectedProperty(null) }} className='flex-1 bg-green-500 text-white py-2 rounded-lg font-bold'>موافقة</button>
              <button onClick={() => { 
  setRejectId(selectedProperty.id); 
  setSelectedProperty(null) 
}} className='flex-1 bg-red-500 text-white py-2 rounded-lg font-bold'>رفض</button>
            </div>
          </div>
        </div>
      )}



      
      {rejectId && (
        <div className='fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50'>
          <div className='bg-white rounded-2xl p-6 w-full max-w-md mx-4'>
            <h2 className='font-bold text-lg mb-4'>Rejection Reason</h2>
            <textarea
              rows={3}
              placeholder='Write rejection reason...'
              className='w-full border rounded-lg p-3 mb-4'
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className='flex gap-2'>
              <button onClick={handleRejectProperty} className='flex-1 bg-red-500 text-white py-2 rounded-lg font-bold'>Confirm Reject</button>
              <button onClick={() => { setRejectId(null); setRejectReason('') }} className='flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold'>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className='max-w-5xl mx-auto px-4 py-8'>
        <div className='flex gap-2 mb-6'>
          <button onClick={() => setTab('properties')} className={tab === 'properties' ? 'px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white' : 'px-4 py-2 rounded-lg font-bold text-sm bg-white text-gray-600'}>Properties ({properties.length})</button>
          <button onClick={() => setTab('transactions')} className={tab === 'transactions' ? 'px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white' : 'px-4 py-2 rounded-lg font-bold text-sm bg-white text-gray-600'}>Transactions ({transactions.length})</button>
        </div>
        {tab === 'properties' && (
          <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
            {properties.length === 0 ? <p className='text-center text-gray-400 py-12'>No pending properties</p> : (
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 text-gray-500'>
                  <tr>
                    <th className='p-4 text-right'>Title</th>
                    <th className='p-4 text-right'>Broker</th>
                    <th className='p-4 text-right'>Area</th>
                    <th className='p-4 text-right'>Price</th>
                    <th className='p-4 text-right'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(p => (
                    <tr key={p.id} className='border-t cursor-pointer hover:bg-gray-50' onClick={() => setSelectedProperty(p)}>
                      <td className='p-4 font-medium'>{p.title}</td>
                      <td className='p-4 text-gray-500'>{p.profiles?.name}</td>
                      <td className='p-4 text-gray-500'>{p.area}</td>
                      <td className='p-4 text-gray-500'>{p.price}</td>
                      <td className='p-4'>
                        <div className='flex gap-2'>
                          <button onClick={() => handleProperty(p.id, 'active')} className='bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold'>Approve</button>
                          <button onClick={() => { setRejectId(p.id); setSelectedProperty(null) }} className='bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold'>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {tab === 'transactions' && (
          <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
            {transactions.length === 0 ? <p className='text-center text-gray-400 py-12'>No pending transactions</p> : (
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 text-gray-500'>
                  <tr>
                    <th className='p-4 text-right'>Broker</th>
                    <th className='p-4 text-right'>Amount</th>
                    <th className='p-4 text-right'>Receipt</th>
                    <th className='p-4 text-right'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className='border-t'>
                      <td className='p-4 font-medium'>{t.profiles?.name}</td>
                      <td className='p-4 text-gray-500'>{t.amount}</td>
                      <td className='p-4'>
                        <a href={t.screenshot_url} target='_blank' rel='noreferrer' className='text-blue-600 hover:underline text-xs'>View Receipt</a>
                      </td>
                      <td className='p-4'>
                        <div className='flex gap-2'>
                          <button onClick={() => handleTransaction(t.id, t.broker_id, t.amount)} className='bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold'>Approve</button>
                          <button onClick={() => setRejectId(t.id)} className='bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold'>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}