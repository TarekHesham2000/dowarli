'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Banner = {
  id: string
  text: string
}

export default function Banner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'banner_text')
        .maybeSingle()

      const text = data?.value?.trim()
      if (text) setBanner({ id: 'settings-banner', text })
      else setBanner(null)
    }
    load()
  }, [])

  if (!banner || !visible) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1B783C, #166534)',
      color: 'white',
      padding: '10px 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'Cairo, sans-serif',
      direction: 'rtl',
    }}>
      <span>{banner.text}</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          width: 24,
          height: 24,
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}