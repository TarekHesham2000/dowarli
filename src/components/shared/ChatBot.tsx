'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Trash2, Minimize2, Maximize2, X, Sparkles, MapPin, DollarSign } from 'lucide-react'

type UnitType = 'student' | 'family' | 'studio' | 'shared' | 'employee'

type FilterAction = {
  type: 'FILTER'
  unitType: UnitType | ''
  area: string
  maxPrice: number | null
  keywords: string
}

type PropertyResult = {
  id: number
  title: string
  price: number
  area: string
  address: string | null
  unit_type: string
  images: string[]
  last_verified_at?: string
  report_count?: number
}

type BotResponse = {
  message: string
  action: FilterAction | null
  results?: PropertyResult[]
  resultsOtherAreas?: PropertyResult[]
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: FilterAction | null
  results?: PropertyResult[]
  resultsOtherAreas?: PropertyResult[]
  timestamp: Date
}

type ChatBotProps = {
  onFilter?: (params: {
    unitType: UnitType | ''
    area: string
    maxPrice: number | null
    keywords: string
  }) => void
  pendingPrompt?: string | null
  onPendingPromptConsumed?: () => void
  onMobileSheetOpenChange?: (open: boolean) => void
}

const TYPE_LABELS: Record<UnitType, string> = {
  student: 'سكن طلاب',
  family: 'سكن عائلي',
  studio: 'ستوديو',
  shared: 'مشترك',
  employee: 'سكن موظفين',
}

const ACTION_CHIPS: { label: string; message: string }[] = [
  { label: '🎓 سكن طلاب', message: 'دور على سكن طلاب قريب من الجامعة بميزانية محدودة' },
  { label: '🏙️ التجمع',   message: 'عايز وحدة سكنية في التجمع الخامس' },
  { label: '🔑 إيجار',    message: 'ابحث عن شقة للإيجار في القاهرة' },
  { label: '💰 بيع',      message: 'ابحث عن شقة للبيع بميزانية مناسبة' },
]

const MAX_SEND_HISTORY = 28
const uid = () => Math.random().toString(36).slice(2, 9)
const CHAT_FAB_BOTTOM_PX = 100
const MOBILE_MAX_PX = 768

// ─── Ambient background ───────────────────────────────────────────────────────
function AnimatedBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
      style={{ background: 'linear-gradient(160deg, #061a12 0%, #070e1f 55%, #020617 100%)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          animation: 'grid-move 10s linear infinite',
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 65%)',
          filter: 'blur(40px)',
          animation: 'aura-pulse 7s ease-in-out infinite',
        }}
      />
    </div>
  )
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingOrb() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ background: 'rgba(52,211,153,0.7)', animation: `chat-dot 1s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

// ─── Filter badge ─────────────────────────────────────────────────────────────
function FilterBadge({ action }: { action: FilterAction }) {
  if (!action.unitType && !action.area && !action.maxPrice) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(52,211,153,0.5)' }}>فلتر</span>
      {action.area && (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
          <MapPin size={9} />{action.area}
        </span>
      )}
      {action.maxPrice && (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
          <DollarSign size={9} style={{ color: '#6ee7b7' }} />
          حتى {action.maxPrice.toLocaleString('ar-EG')} ج.م
        </span>
      )}
      {action.unitType && (
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
          {TYPE_LABELS[action.unitType as UnitType]}
        </span>
      )}
    </div>
  )
}

// ─── Property card slider ─────────────────────────────────────────────────────
function PropertySlider({
  results,
  sectionTitle = 'عروض مختارة',
  sectionTone = 'amber' as 'amber' | 'slate',
}: {
  results: PropertyResult[]
  sectionTitle?: string
  sectionTone?: 'amber' | 'slate'
}) {
  if (!results?.length) return null
  return (
    <div className="mt-4">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: sectionTone === 'slate' ? 'rgba(148,163,184,0.6)' : 'rgba(52,211,153,0.6)' }}>
        {sectionTitle}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {results.map((r) => {
          const img = r.images?.[0]
          return (
            <a key={r.id} href={`/property/${r.id}`} target="_blank" rel="noopener noreferrer"
              style={{ scrollSnapStop: 'always', scrollSnapAlign: 'start' }}
              className="block w-40 shrink-0 no-underline outline-none">
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, type: 'spring', stiffness: 400, damping: 30 }}
                whileHover={{ scale: 1.02 }}
                className="overflow-hidden rounded-2xl"
                style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800/80">
                  {img
                    ? <img src={img} alt={r.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    : <div className="flex h-full items-center justify-center text-3xl opacity-40">🏠</div>
                  }
                  <span className="absolute top-2 start-2 rounded-lg px-2 py-0.5 text-[10px] font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 2px 8px rgba(5,150,105,0.5)' }}>
                    {r.price.toLocaleString('ar-EG')} ج.م
                  </span>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2.5 pb-2 pt-6">
                    <p className="line-clamp-2 text-[11px] font-bold leading-snug text-white">{r.title}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-2.5 py-2"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="flex min-w-0 truncate items-center gap-1 text-[10px]" style={{ color: '#94a3b8' }}>
                    <MapPin size={8} style={{ color: '#6ee7b7', flexShrink: 0 }} />{r.area}
                  </p>
                  <span className="shrink-0 text-[10px] font-bold" style={{ color: '#34d399' }}>عرض ↗</span>
                </div>
              </motion.div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
      className={`mb-4 flex items-end gap-2.5  ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white mb-0.5"
          style={{ background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 2px 12px rgba(5,150,105,0.35)', flexShrink: 0 }}
          aria-hidden
        >✦</div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed m ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
        style={isUser ? {
          margin: '10px',
          background: 'linear-gradient(135deg, #059669, #047857)',
          color: '#fff',
          boxShadow: '0 4px 18px rgba(5,150,105,0.28)',
        } : {
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.09)',
          color: '#e2e8f0',
        }}
      >
        <div className="whitespace-pre-wrap px-5 py-3 space-y-4 " style={{ margin: '' }} >{msg.content}</div>
        {!isUser && msg.action && <FilterBadge action={msg.action} />}
        {!isUser && msg.results && msg.results.length > 0 && (
          <PropertySlider results={msg.results} sectionTitle="عروض مختارة" sectionTone="amber" />
        )}
        {!isUser && msg.resultsOtherAreas && msg.resultsOtherAreas.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <PropertySlider results={msg.resultsOtherAreas} sectionTitle="من محافظات تانية" sectionTone="slate" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ChatBot({ onFilter, pendingPrompt, onPendingPromptConsumed, onMobileSheetOpenChange }: ChatBotProps) {
  const [mounted, setMounted]           = useState(false)
  const [isMobile, setIsMobile]         = useState(false)
  const [isOpen, setIsOpen]             = useState(false)
  const [expanded, setExpanded]         = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const dragStartY                      = useRef<number | null>(null)
  const [messages, setMessages]         = useState<Message[]>([{
    id: uid(), role: 'assistant',
    content: 'أهلاً بيك في دَورلي 👋\nأنا دليلك العقاري: قولّي الميزانية والمنطقة (أو اسألني أي حاجة) وهظبطلك البحث.',
    action: null, timestamp: new Date(),
  }])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [hasNew, setHasNew]   = useState(false)

  const messagesEndRef    = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)
  const sendingRef        = useRef(false)
  const messagesRef       = useRef(messages)
  const sendMessageFn     = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    const mq   = window.matchMedia(`(max-width: ${MOBILE_MAX_PX - 1}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync(); mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [mounted])

  useEffect(() => { onMobileSheetOpenChange?.(isOpen && isMobile) }, [isOpen, isMobile, onMobileSheetOpenChange])

  useEffect(() => {
    if (!isOpen || !isMobile || typeof window === 'undefined') { setKeyboardInset(0); return }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update(); vv.addEventListener('resize', update); vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [isOpen, isMobile])

  const applyAction = useCallback((action: FilterAction) => {
    if (action.type !== 'FILTER') return
    onFilter?.({ unitType: action.unitType || '', area: action.area || '', maxPrice: action.maxPrice ?? null, keywords: action.keywords || '' })
  }, [onFilter])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sendingRef.current) return
    sendingRef.current = true
    const userMsg: Message = { id: uid(), role: 'user', content: trimmed, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg]); setInput(''); setLoading(true)
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 22_000)
    try {
      const history = [...messagesRef.current, userMsg].slice(-MAX_SEND_HISTORY).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }), signal: controller.signal })
      clearTimeout(timeoutId)
      const rawText = await res.text()
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = rawText ? (JSON.parse(rawText) as { message?: string }) : null; if (j?.message) msg = j.message } catch { const t = rawText.trim(); if (t) msg = t.slice(0, 200) }
        throw new Error(msg)
      }
      let data: BotResponse
      try { data = rawText ? (JSON.parse(rawText) as BotResponse) : ({} as BotResponse) } catch { throw new Error('رد غير متوقع من الخادم') }
      const botMsg: Message = { id: uid(), role: 'assistant', content: data.message || 'تمام، قولّي تفاصيل أكتر عشان أظبطلك البحث.', action: data.action ?? null, results: data.results, resultsOtherAreas: data.resultsOtherAreas, timestamp: new Date() }
      setMessages((prev) => [...prev, botMsg])
      if (data.action?.type === 'FILTER') applyAction(data.action)
      if (!isOpen) setHasNew(true)
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const errMsg  = err instanceof Error && err.message ? err.message : isAbort ? 'الاتصال اتأخر — جرّب تاني 🔄' : 'في مشكلة مؤقتة، جرب بعد لحظة 🙏'
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: errMsg, action: null, timestamp: new Date() }])
    } finally { sendingRef.current = false; setLoading(false) }
  }, [isOpen, applyAction])

  sendMessageFn.current = sendMessage

  useEffect(() => {
    if (!pendingPrompt?.trim() || !mounted) return
    const text = pendingPrompt.trim(); setIsOpen(true); setExpanded(true)
    const t = window.setTimeout(() => { onPendingPromptConsumed?.(); void sendMessageFn.current(text) }, 120)
    return () => window.clearTimeout(t)
  }, [pendingPrompt, mounted, onPendingPromptConsumed])

  useEffect(() => {
    if (!isOpen) return
    const el = messagesScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen, loading])

  useEffect(() => {
    if (isOpen) { setHasNew(false); setTimeout(() => inputRef.current?.focus(), 280) }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void sendMessage(input) }

  const clearChat = () => setMessages([{ id: uid(), role: 'assistant', content: 'اتمسحت المحادثة ✨\nنبدأ من جديد: الموقع الأول ولا الميزانية؟', action: null, timestamp: new Date() }])

  if (!mounted) return null

  const sheetTransition = isMobile
    ? { type: 'spring' as const, stiffness: 440, damping: 38, mass: 0.85 }
    : { type: 'spring' as const, stiffness: 380, damping: 32 }

  return (
    <>
      {/* ══════════ FAB ══════════ */}
      <motion.button
        type="button" layoutId="chat-fab"
        whileHover={{ scale: isMobile && isOpen ? 1 : 1.07 }}
        whileTap={{ scale: isMobile && isOpen ? 1 : 0.93 }}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'إغلاق مساعد دَورلي' : 'فتح مساعد دَورلي'}
        className={['fixed z-[9999] flex h-14 w-14 items-center justify-center rounded-full overflow-hidden', isMobile && isOpen ? 'hidden' : ''].join(' ')}
        style={{ bottom: CHAT_FAB_BOTTOM_PX, right: '20px', left: 'auto', background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #065f46 100%)', boxShadow: '0 8px 28px rgba(5,150,105,0.45), 0 0 0 1px rgba(255,255,255,0.12)' }}
      >
        <motion.div
          animate={isOpen ? { rotate: 90, scale: 0.88 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="flex items-center justify-center text-white"
        >
          {isOpen ? <X size={20} strokeWidth={2.5} /> : <Sparkles size={20} strokeWidth={2} />}
        </motion.div>
        {hasNew && !isOpen && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -left-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </motion.button>

      <AnimatePresence>
        {/* ══════════ Backdrop ══════════ */}
        {isOpen && isMobile && (
          <motion.div key="chat-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[9997] md:hidden"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
            aria-hidden onClick={() => setIsOpen(false)}
          />
        )}

        {/* ══════════ Panel ══════════ */}
        {isOpen && (
          <motion.div
            key="chat-panel"
            role="dialog" aria-label="مساعد دَورلي" aria-modal="true" dir="rtl"
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={sheetTransition}
            className={[
              'fixed z-[9998] flex flex-col overflow-hidden',
              isMobile
                ? 'inset-x-0 bottom-0 h-[90dvh] max-h-[90vh] w-full rounded-t-[1.75rem]'
                : ['max-h-[min(88dvh,640px)] inset-x-0 bottom-0 rounded-t-sm sm:inset-x-auto sm:bottom-[168px] sm:right-5 sm:left-auto sm:w-[min(100vw-2rem,420px)] sm:rounded-3xl', expanded ? 'sm:max-h-[min(92dvh,720px)]' : ''].join(' '),
            ].join(' ')}
            style={{ background: 'rgba(4,12,22,0.97)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(16,185,129,0.06)' }}
          >
            <AnimatedBackground />

            {/* Mobile drag handle */}
            {isMobile && (
              <div
                className="flex shrink-0 flex-col items-center pt-3 pb-1 relative z-10"
                onTouchStart={(e) => { dragStartY.current = e.touches[0]?.clientY ?? null }}
                onTouchEnd={(e) => {
                  if (dragStartY.current == null) return
                  const y = e.changedTouches[0]?.clientY ?? dragStartY.current
                  if (y - dragStartY.current > 72) setIsOpen(false)
                  dragStartY.current = null
                }}
              >
                <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <span className="sr-only">اسحب للأسفل للإغلاق</span>
              </div>
            )}

            {/* Header */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0 relative z-10"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(16,185,129,0.04)' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* Logo — برتقالي/أصفر — لا تعدّل */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden" aria-hidden>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="36" height="36" rx="10" fill="#111827"/>
                    <path d="M18 7L27 12.5V23.5L18 29L9 23.5V12.5L18 7Z" fill="url(#lg1)" opacity="0.15"/>
                    <path d="M18 10L24.5 13.75V21.25L18 25L11.5 21.25V13.75L18 10Z" fill="url(#lg1)"/>
                    <circle cx="18" cy="17.5" r="3.5" fill="#111827" opacity="0.6"/>
                    <defs>
                      <linearGradient id="lg1" x1="11.5" y1="10" x2="24.5" y2="25" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#fb923c"/><stop offset="1" stopColor="#fbbf24"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold tracking-tight text-white">دليل دَورلي</p>
                  <p className="truncate text-[11px]" style={loading ? {
                    background: 'linear-gradient(90deg, #059669, #34d399, #059669)',
                    backgroundSize: '200% auto', animation: 'shimmer 2s linear infinite',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  } : { color: 'rgba(52,211,153,0.8)' }}>
                    {loading ? 'جاري التحليل…' : 'مستشار عقاري · Dowrly Guide'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setExpanded((e) => !e)}
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:text-emerald-400"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  title={expanded ? 'تصغير' : 'توسيع'}>
                  {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button type="button" onClick={clearChat}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:text-rose-400"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  title="مسح المحادثة">
                  <Trash2 size={13} />
                </button>
                <button type="button" onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  aria-label="إغلاق">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesScrollRef}
              className={['scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 relative z-10',
                isMobile ? '' : expanded ? 'min-h-[320px]' : 'max-h-[min(52dvh,420px)] sm:max-h-[min(48dvh,400px)]',
              ].join(' ')}
            >
              {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}

              {loading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="mb-4 flex items-end gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 2px 10px rgba(5,150,105,0.3)', flexShrink: 0 }}>✦</div>
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                    <TypingOrb />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick chips */}
            {messages.length === 1 && !loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 380, damping: 30 }}
                className="shrink-0 px-4 pt-3 pb-3 relative z-10"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  اختيارات سريعة
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {ACTION_CHIPS.map((c, i) => (
                    <motion.button key={c.label} type="button"
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 420, damping: 26 }}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => void sendMessage(c.message)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.background = 'rgba(16,185,129,0.15)'; el.style.borderColor = 'rgba(16,185,129,0.35)'; el.style.color = '#fff'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.background = 'rgba(255,255,255,0.06)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; el.style.color = '#cbd5e1'
                      }}
                    >{c.label}</motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Input */}
            <form
              className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(0,0,0,0.35)',
                paddingBottom: `max(${12 + keyboardInset}px, env(safe-area-inset-bottom, 12px))`,
              }}
              onSubmit={handleSubmit}
            >
              <div className="relative min-w-0 flex-1 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input
                  ref={inputRef} value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder="ميزانية، منطقة، نوع السكن…"
                  enterKeyHint="send"
                  className="w-full h-11 rounded-2xl bg-transparent px-4 text-[13px] font-medium outline-none disabled:opacity-40"
                  style={{ color: '#f1f5f9' }}
                />
              </div>

              <motion.button
                type="submit"
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.88 }}
                whileHover={input.trim() && !loading ? { scale: 1.08 } : {}}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-25"
                style={input.trim() && !loading ? {
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  boxShadow: '0 4px 18px rgba(5,150,105,0.5)',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                aria-label="إرسال"
              >
                <Send size={16} strokeWidth={2.5}
                  style={{ color: input.trim() && !loading ? '#fff' : '#64748b', transform: 'scaleX(-1)' }} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}