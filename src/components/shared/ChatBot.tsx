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
  { label: 'سكن طلاب', message: 'دور على سكن طلاب قريب من الجامعة بميزانية محدودة' },
  { label: 'التجمع', message: 'عايز وحدة سكنية في التجمع الخامس' },
  { label: 'إيجار', message: 'ابحث عن شقة للإيجار في القاهرة' },
  { label: 'بيع', message: 'ابحث عن شقة للبيع بميزانية مناسبة' },
]

const MAX_SEND_HISTORY = 28
const uid = () => Math.random().toString(36).slice(2, 9)

const CHAT_FAB_BOTTOM_PX = 100
const MOBILE_MAX_PX = 768

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(251,191,36,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251,191,36,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          animation: 'grid-move 8s linear infinite',
        }}
      />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)',
          animation: 'aura-pulse 6s ease-in-out infinite',
          filter: 'blur(20px)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 60%)',
          animation: 'aura-pulse 8s ease-in-out infinite 2s',
          filter: 'blur(16px)',
        }}
      />
    </div>
  )
}

function TypingOrb() {
  return (
    <div className="flex items-center gap-3 px-1 py-0.5">
      <div
        className="w-7 h-7 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, rgba(251,191,36,0.9), rgba(245,158,11,0.6))',
          animation: 'orb-thinking 1.4s ease-in-out infinite',
          boxShadow: '0 0 16px rgba(251,191,36,0.4)',
        }}
      />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #60a5fa)',
              animation: `chat-dot 0.9s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function FilterBadge({ action }: { action: FilterAction }) {
  const parts: string[] = []
  if (action.unitType) parts.push(TYPE_LABELS[action.unitType as UnitType])
  if (action.area) parts.push(action.area)
  if (action.maxPrice) parts.push(`${action.maxPrice.toLocaleString('ar-EG')} ج.م`)
  if (!parts.length) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/60">فلتر نشط</span>
      {action.area && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300/80 backdrop-blur-sm">
          <MapPin size={9} className="shrink-0" />
          {action.area}
        </span>
      )}
      {action.maxPrice && (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-400/5 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300/80 backdrop-blur-sm">
          <DollarSign size={9} className="shrink-0" />
          حتى {action.maxPrice.toLocaleString('ar-EG')} ج.م
        </span>
      )}
      {action.unitType && (
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300/80 backdrop-blur-sm">
          {TYPE_LABELS[action.unitType as UnitType]}
        </span>
      )}
    </div>
  )
}

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

  const titleClass =
    sectionTone === 'slate'
      ? 'text-slate-400/80'
      : 'text-amber-400/50'

  return (
    <div className="mt-3 -mx-1">
      <p className={`mb-2 text-[9px] font-bold uppercase tracking-wider ${titleClass}`}>{sectionTitle}</p>
      <div
        className="flex gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-hide snap-x snap-mandatory scroll-pl-1"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {results.map((r) => {
          const img = r.images?.[0]
          return (
            <a
              key={r.id}
              href={`/property/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ scrollSnapStop: 'always' }}
              className="block w-[min(175px,72vw)] shrink-0 cursor-pointer snap-center no-underline outline-none"
            >
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 400, damping: 30 }}
                className="group overflow-hidden rounded-2xl border border-white/10 shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(12px)',
                }}
                whileHover={{ scale: 1.02, borderColor: 'rgba(251,191,36,0.3)' }}
              >
                <div className="relative aspect-[5/4] w-full bg-slate-900">
                  {img ? (
                    <img
                      src={img}
                      alt={r.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl text-slate-600">🏠</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2.5 pb-2 pt-8">
                    <p className="line-clamp-2 text-[11px] font-bold leading-snug text-white">{r.title}</p>
                  </div>
                  <span
                    className="absolute start-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-black tabular-nums text-black"
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      boxShadow: '0 2px 8px rgba(251,191,36,0.4)',
                    }}
                  >
                    {r.price.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-white/5 px-2.5 py-1.5">
                  <p className="min-w-0 truncate text-[10px] text-slate-400 flex items-center gap-1">
                    <MapPin size={8} className="shrink-0 text-amber-400/60" />
                    {r.area}
                  </p>
                  <span
                    className="shrink-0 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  >
                    عرض ↗
                  </span>
                </div>
              </motion.div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.7 }}
      className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full me-2 mt-0.5"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(251,191,36,0.9), rgba(245,158,11,0.5))',
            boxShadow: '0 0 10px rgba(251,191,36,0.25)',
            fontSize: '12px',
          }}
          aria-hidden
        >
          ✦
        </div>
      )}
      <div
        className={[
          'max-w-[min(88%,380px)] px-4 py-2.5 text-[13px] leading-relaxed tracking-tight rounded-2xl',
          isUser
            ? 'rounded-tr-sm text-white'
            : 'rounded-tl-sm text-slate-100',
        ].join(' ')}
        style={isUser ? {
          background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(37,99,235,0.15))',
          border: '1px solid rgba(96,165,250,0.2)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(59,130,246,0.1)',
        } : {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        <div className="whitespace-pre-wrap antialiased">{msg.content}</div>
        {!isUser && msg.action && <FilterBadge action={msg.action} />}
        {!isUser && msg.results && msg.results.length > 0 && (
          <PropertySlider results={msg.results} sectionTitle="عروض مختارة" sectionTone="amber" />
        )}
        {!isUser && msg.resultsOtherAreas && msg.resultsOtherAreas.length > 0 && (
          <div
            className="mt-4 border-t border-white/10 pt-3"
            role="region"
            aria-label="اقتراحات من محافظات أخرى"
          >
            <PropertySlider
              results={msg.resultsOtherAreas}
              sectionTitle="من محافظات تانية"
              sectionTone="slate"
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function ChatBot({
  onFilter,
  pendingPrompt,
  onPendingPromptConsumed,
  onMobileSheetOpenChange,
}: ChatBotProps) {
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const dragStartY = useRef<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: 'assistant',
      content:
        'أهلاً بيك في دَورلي 👋\nأنا دليلك العقاري: قولّي الميزانية والمنطقة (أو اسألني أي حاجة) وهظبطلك البحث.',
      action: null,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasNew, setHasNew] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const messagesRef = useRef(messages)
  const sendMessageFn = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX - 1}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [mounted])

  useEffect(() => {
    onMobileSheetOpenChange?.(isOpen && isMobile)
  }, [isOpen, isMobile, onMobileSheetOpenChange])

  useEffect(() => {
    if (!isOpen || !isMobile || typeof window === 'undefined') {
      setKeyboardInset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(hidden)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [isOpen, isMobile])

  const applyAction = useCallback(
    (action: FilterAction) => {
      if (action.type !== 'FILTER') return
      onFilter?.({
        unitType: action.unitType || '',
        area: action.area || '',
        maxPrice: action.maxPrice ?? null,
        keywords: action.keywords || '',
      })
    },
    [onFilter],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sendingRef.current) return
      sendingRef.current = true

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 22_000)

      try {
        const history = [...messagesRef.current, userMsg]
          .slice(-MAX_SEND_HISTORY)
          .map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const rawText = await res.text()
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            const j = rawText ? (JSON.parse(rawText) as { message?: string }) : null
            if (j?.message) msg = j.message
          } catch {
            const t = rawText.trim()
            if (t) msg = t.slice(0, 200)
          }
          throw new Error(msg)
        }

        let data: BotResponse
        try {
          data = rawText ? (JSON.parse(rawText) as BotResponse) : ({} as BotResponse)
        } catch {
          throw new Error('رد غير متوقع من الخادم')
        }

        const botMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: data.message || 'تمام، قولّي تفاصيل أكتر عشان أظبطلك البحث.',
          action: data.action ?? null,
          results: data.results,
          resultsOtherAreas: data.resultsOtherAreas,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, botMsg])

        if (data.action?.type === 'FILTER') {
          applyAction(data.action)
        }

        if (!isOpen) setHasNew(true)
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        const isAbort = err instanceof Error && err.name === 'AbortError'
        const errMsg =
          err instanceof Error && err.message
            ? err.message
            : isAbort
              ? 'الاتصال اتأخر — جرّب تاني 🔄'
              : 'في مشكلة مؤقتة، جرب بعد لحظة 🙏'

        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'assistant', content: errMsg, action: null, timestamp: new Date() },
        ])
      } finally {
        sendingRef.current = false
        setLoading(false)
      }
    },
    [isOpen, applyAction],
  )

  sendMessageFn.current = sendMessage

  useEffect(() => {
    if (!pendingPrompt?.trim() || !mounted) return
    const text = pendingPrompt.trim()
    setIsOpen(true)
    setExpanded(true)
    const t = window.setTimeout(() => {
      onPendingPromptConsumed?.()
      void sendMessageFn.current(text)
    }, 120)
    return () => window.clearTimeout(t)
  }, [pendingPrompt, mounted, onPendingPromptConsumed])

  useEffect(() => {
    if (!isOpen) return
    const el = messagesScrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, loading])

  useEffect(() => {
    if (isOpen) {
      setHasNew(false)
      setTimeout(() => inputRef.current?.focus(), 280)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage(input)
  }

  const clearChat = () =>
    setMessages([
      {
        id: uid(),
        role: 'assistant',
        content: 'اتمسحت المحادثة ✨\nنبدأ من جديد: الموقع الأول ولا الميزانية؟',
        action: null,
        timestamp: new Date(),
      },
    ])

  if (!mounted) return null

  const sheetTransition = isMobile
    ? { type: 'spring' as const, stiffness: 440, damping: 38, mass: 0.85 }
    : { type: 'spring' as const, stiffness: 380, damping: 32 }

  return (
    <>
      <motion.button
        type="button"
        layoutId="chat-fab"
        whileHover={{ scale: isMobile && isOpen ? 1 : 1.07 }}
        whileTap={{ scale: isMobile && isOpen ? 1 : 0.93 }}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'إغلاق مساعد دَورلي' : 'فتح مساعد دَورلي'}
        className={[
          'fixed z-[9999] flex h-14 w-14 items-center justify-center rounded-full relative overflow-hidden',
          isMobile && isOpen ? 'hidden' : '',
        ].join(' ')}
        style={{
          bottom: CHAT_FAB_BOTTOM_PX,
          right: '20px',
          left: 'auto',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #3b82f6 100%)',
          boxShadow: '0 8px 32px rgba(251,191,36,0.35), 0 0 0 1px rgba(255,255,255,0.1)',
        }}
      >
        <motion.div
          animate={isOpen ? { rotate: 90, scale: 0.9 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="flex items-center justify-center text-black font-bold text-lg"
        >
          {isOpen ? <X size={20} strokeWidth={2.5} /> : <Sparkles size={20} strokeWidth={2} />}
        </motion.div>
        {hasNew && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -left-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-[#050505]"
          />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[9997] md:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            aria-hidden
            onClick={() => setIsOpen(false)}
          />
        )}

        {isOpen && (
          <motion.div
            key="chat-panel"
            role="dialog"
            aria-label="مساعد دَورلي"
            aria-modal="true"
            dir="rtl"
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={sheetTransition}
            className={[
              'fixed z-[9998] flex flex-col overflow-hidden',
              isMobile
                ? 'inset-x-0 bottom-0 h-[90dvh] max-h-[90vh] w-full rounded-b-none rounded-t-[1.5rem]'
                : [
                    'max-h-[min(88dvh,640px)] inset-x-0 bottom-0 rounded-t-3xl sm:inset-x-auto sm:bottom-[168px] sm:right-5 sm:left-auto sm:w-[min(100vw-2rem,440px)] sm:rounded-3xl',
                    expanded ? 'sm:max-h-[min(92dvh,720px)]' : '',
                  ].join(' '),
            ].join(' ')}
            style={{
              background: 'rgba(5,5,5,0.92)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 32px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,191,36,0.05), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <AnimatedBackground />

            {isMobile && (
              <div
                className="flex shrink-0 flex-col items-center px-4 pt-2.5 pb-2 relative z-10"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onTouchStart={(e) => {
                  dragStartY.current = e.touches[0]?.clientY ?? null
                }}
                onTouchEnd={(e) => {
                  if (dragStartY.current == null) return
                  const y = e.changedTouches[0]?.clientY ?? dragStartY.current
                  if (y - dragStartY.current > 72) setIsOpen(false)
                  dragStartY.current = null
                }}
              >
                <div
                  className="mb-2 h-1 w-10 shrink-0 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  aria-hidden
                />
                <span className="sr-only">مقبض السحب — اسحب للأسفل للإغلاق</span>
              </div>
            )}

            <div
              className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 relative z-10"
              style={{
                background: 'linear-gradient(to left, rgba(5,5,5,0.8), rgba(20,10,0,0.5), rgba(5,5,8,0.7))',
                borderBottom: '1px solid rgba(251,191,36,0.1)',
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-black"
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    boxShadow: '0 4px 14px rgba(251,191,36,0.3)',
                  }}
                  aria-hidden
                >
                  ✦
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold tracking-tight text-white">دليل دَورلي</p>
                  <p
                    className="truncate text-[10px] font-medium"
                    style={{
                      background: loading
                        ? 'linear-gradient(90deg, #fbbf24, #60a5fa, #fbbf24)'
                        : 'linear-gradient(135deg, #fbbf24, #a78bfa)',
                      backgroundSize: loading ? '200% auto' : undefined,
                      animation: loading ? 'shimmer 2s linear infinite' : undefined,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Dowrly Guide · {loading ? 'جاري التحليل…' : 'مستشار عقاري'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:text-amber-300/80 hover:bg-white/5 sm:flex items-center"
                  title={expanded ? 'تصغير' : 'توسيع'}
                >
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={clearChat}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:text-rose-400/80 hover:bg-white/5 flex items-center"
                  title="مسح المحادثة"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:text-white hover:bg-white/5 flex items-center"
                  aria-label="إغلاق"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div
              ref={messagesScrollRef}
              className={[
                'scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 relative z-10',
                isMobile ? '' : expanded ? 'min-h-[320px]' : 'max-h-[min(52dvh,420px)] sm:max-h-[min(48dvh,400px)]',
              ].join(' ')}
            >
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} />
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex justify-start items-start gap-2"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5"
                    style={{
                      background: 'radial-gradient(circle at 35% 35%, rgba(251,191,36,0.9), rgba(245,158,11,0.5))',
                      boxShadow: '0 0 10px rgba(251,191,36,0.25)',
                      fontSize: '12px',
                    }}
                  >
                    ✦
                  </div>
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <TypingOrb />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {messages.length === 1 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="shrink-0 space-y-2.5 px-3 py-2.5 relative z-10"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
              >
                <p
                  className="text-center text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(251,191,36,0.4)' }}
                >
                  اختيارات سريعة
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {ACTION_CHIPS.map((c, i) => (
                    <motion.button
                      key={c.label}
                      type="button"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.06, type: 'spring', stiffness: 400, damping: 25 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => void sendMessage(c.message)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white/90 transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget
                        el.style.border = '1px solid rgba(251,191,36,0.3)'
                        el.style.background = 'rgba(251,191,36,0.07)'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget
                        el.style.border = '1px solid rgba(255,255,255,0.1)'
                        el.style.background = 'rgba(255,255,255,0.04)'
                      }}
                    >
                      {c.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            <form
              className="flex shrink-0 items-center gap-2.5 px-3 py-3 relative z-10"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(5,5,5,0.85)',
                backdropFilter: 'blur(12px)',
                paddingBottom: `max(${12 + keyboardInset}px, env(safe-area-inset-bottom, 0px))`,
              }}
              onSubmit={handleSubmit}
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder="ميزانية، منطقة، نوع السكن…"
                  enterKeyHint="send"
                  className="w-full min-h-[48px] sm:h-12 sm:min-h-0 rounded-2xl px-4 text-[13px] sm:text-[13px] text-base font-medium text-white placeholder:text-slate-500 disabled:opacity-50 bg-transparent outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(251,191,36,0.3)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.07), 0 0 20px rgba(251,191,36,0.05)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
              <motion.button
                type="submit"
                disabled={!input.trim() || loading}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.05 }}
                className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-2xl font-bold text-black shadow-lg disabled:cursor-not-allowed disabled:opacity-30"
                style={{
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'rgba(255,255,255,0.06)',
                  boxShadow: input.trim() && !loading ? '0 4px 16px rgba(251,191,36,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}
                aria-label="إرسال"
              >
                <Send size={16} strokeWidth={2.5} className={input.trim() && !loading ? 'text-black' : 'text-slate-500'} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
