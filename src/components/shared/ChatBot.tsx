'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type UnitType = 'student' | 'family' | 'studio' | 'shared' | 'employee'

type Property = {
  id: number
  title: string
  price: number
  area: string
  address: string
  unit_type: UnitType
  description?: string
  rental_unit?: 'bed' | 'room' | null
  beds_count?: number | null
}

type FilterAction = {
  type: 'FILTER'
  unitType: UnitType | ''
  area: string
  maxPrice: number | null
  keywords: string
}

type BotResponse = {
  message: string
  action: FilterAction | null
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: FilterAction | null
  timestamp: Date
}

// ──────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────
type ChatBotProps = {
  properties: Property[]
  onFilter?: (params: {
    unitType: UnitType | ''
    area: string
    maxPrice: number | null
    keywords: string
  }) => void
  onActiveFilterChange?: (filter: UnitType | 'all') => void
  onSearchQueryChange?: (query: string) => void
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<UnitType, string> = {
  student: 'سكن طلاب',
  family: 'سكن عائلي',
  studio: 'ستوديو',
  shared: 'مشترك',
  employee: 'سكن موظفين',
}

const SUGGESTIONS = [
  'عايز سكن طلاب رخيص',
  'في إيه في المنصورة؟',
  'ستوديو بحد أقصى 3000',
  'سكن عائلي في القاهرة',
]

// Unique ID generator
const uid = () => Math.random().toString(36).slice(2)

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

/** Typing dots animation */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#10b981',
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/** Single chat bubble */
function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-start' : 'flex-end',
        marginBottom: 8,
      }}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            flexShrink: 0,
            marginLeft: 8,
            boxShadow: '0 0 10px rgba(16,185,129,0.4)',
            order: 2,
          }}
        >
          🤖
        </div>
      )}

      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser
            ? '18px 18px 18px 4px'
            : '18px 18px 4px 18px',
          background: isUser
            ? 'rgba(255,255,255,0.07)'
            : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.12))',
          border: isUser
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(16,185,129,0.3)',
          fontSize: 13,
          lineHeight: 1.75,
          color: '#e2e8f0',
          wordBreak: 'break-word',
          order: isUser ? 2 : 1,
        }}
      >
        {msg.content}

        {/* Filter action badge */}
        {msg.action && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              marginTop: 8,
              padding: '5px 10px',
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexWrap: 'wrap',
            }}
          >
            <span>✦ تم تطبيق الفلتر:</span>
            {msg.action.unitType && (
              <span>{TYPE_LABELS[msg.action.unitType as UnitType]}</span>
            )}
            {msg.action.area && <span>📍 {msg.action.area}</span>}
            {msg.action.maxPrice && (
              <span>💰 حتى {msg.action.maxPrice.toLocaleString()} ج.م</span>
            )}
          </motion.div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            flexShrink: 0,
            marginRight: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            order: 1,
          }}
        >
          👤
        </div>
      )}
    </motion.div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────
export default function ChatBot({
  properties,
  onFilter,
  onActiveFilterChange,
  onSearchQueryChange,
}: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: 'assistant',
      content:
        'أهلاً! 👋 أنا دَورلي بوت، هساعدك تلاقي سكنك المثالي بسرعة.\nقولي بتدور على إيه؟ 🏠',
      action: null,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, loading])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
      setHasNew(false)
    }
  }, [isOpen])

// ── Apply filter or navigation action to parent UI ──────────────────────
  const applyAction = useCallback(
    (action: any) => {
      // 1. إذا كان الأكشن هو فتح إعلان محدد (Navigation)
      if (action.type === 'VIEW_PROPERTY' && action.propertyId) {
        // بنفتح رابط الإعلان في صفحة جديدة أو نفس الصفحة حسب تصميمك
        window.location.href = `/property/${action.propertyId}`;
        return; // بنوقف التنفيذ هنا مش محتاجين نكمل للفلاتر
      }

      // 2. تحديث الـ Active Filter Chip (المنطق القديم بتاعك)
      if (onActiveFilterChange) {
        onActiveFilterChange(action.unitType ? (action.unitType as UnitType) : 'all')
      }

      // 3. تحديث نص البحث (Area + Keywords)
      if (onSearchQueryChange) {
        const parts: string[] = []
        if (action.area) parts.push(action.area)
        if (action.keywords) parts.push(action.keywords)
        if (action.maxPrice) parts.push(action.maxPrice.toString())
        onSearchQueryChange(parts.join(' '))
      }

      // 4. تشغيل الفلتر النهائي
      if (onFilter) {
        onFilter({
          unitType: action.unitType as UnitType | '',
          area: action.area,
          maxPrice: action.maxPrice,
          keywords: action.keywords,
        })
      }
    },
    [onFilter, onActiveFilterChange, onSearchQueryChange]
  )

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)

      try {
        // Build message history for API (exclude action metadata)
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            properties: properties.slice(0, 50), // send up to 50 properties
          }),
        })

        const data: BotResponse = await response.json()

        const botMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: data.message || 'معلش، مش قادر أساعدك دلوقتي 😅',
          action: data.action ?? null,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, botMsg])

        // Apply filter action if present
        if (data.action?.type === 'FILTER') {
          applyAction(data.action)
        }

        // Show notification dot if chat is closed
        if (!isOpen) {
          setHasNew(true)
        }
      } catch (error) {
        console.error("Chat Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: 'معلش يا بطل، الضغط عالي عليا شوية 😅.. ثانية واحدة وبجرب تاني أو اعمل Refresh للموقع.',
            action: null,
            timestamp: new Date(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [messages, properties, loading, isOpen, applyAction]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestion = (text: string) => {
    sendMessage(text)
  }

  const clearChat = () => {
    setMessages([
      {
        id: uid(),
        role: 'assistant',
        content: 'تم مسح المحادثة 🗑️\nقولي بتدور على إيه؟ 😊',
        action: null,
        timestamp: new Date(),
      },
    ])
  }

  return (
    <>
      {/* ── Floating Button ── */}
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        style={{
          position: 'fixed',
          bottom: 100,
          right: 40,
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          zIndex: 9999,
          boxShadow:
            '0 0 0 0 rgba(16,185,129,0.4), 0 8px 32px rgba(16,185,129,0.5)',
          animation: isOpen ? 'none' : 'chatPulse 2.5s ease infinite',
        }}
        aria-label={isOpen ? 'إغلاق المحادثة' : 'فتح المحادثة مع المساعد'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 20, color: '#fff', lineHeight: 1 }}
            >
              ✕
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              🤖
            </motion.span>
          )}
        </AnimatePresence>

        {/* New message indicator */}
        {hasNew && !isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 14,
              height: 14,
              background: '#ef4444',
              borderRadius: '50%',
              border: '2px solid #020617',
            }}
          />
        )}
      </motion.button>

      {/* ── Chat Window ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            dir="rtl"
            style={{
              position: 'fixed',
              bottom: 100,
              left: 20,
              width: 'min(360px, calc(100vw - 40px))',
              height: 'min(540px, calc(100vh - 130px))',
              background: 'rgba(4, 10, 22, 0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 9998,
              boxShadow:
                '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.08) inset',
              fontFamily: "'Cairo', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                background:
                  'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
                borderBottom: '1px solid rgba(16,185,129,0.15)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    boxShadow: '0 0 14px rgba(16,185,129,0.5)',
                  }}
                >
                  🤖
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: '#fff',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    دَورلي بوت
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10b981',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {loading ? 'بيفكر...' : 'متاح دلوقتي'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {/* Clear chat */}
                <button
                  onClick={clearChat}
                  title="مسح المحادثة"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    cursor: 'pointer',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }}
                >
                  🗑️
                </button>
                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Stats bar */}
            <div
              style={{
                padding: '7px 16px',
                background: 'rgba(16,185,129,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                gap: 12,
                flexShrink: 0,
              }}
            >
              {[
                { label: 'إعلان متاح', value: properties.length },
                {
                  label: 'منطقة',
                  value: new Set(properties.map((p) => p.area)).size,
                },
              ].map((stat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#10b981',
                    }}
                  >
                    {stat.value}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
              <div
                style={{
                  marginRight: 'auto',
                  fontSize: 11,
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                مدعوم بـ AI ⚡
              </div>
            </div>

            {/* Messages area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} />
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      marginLeft: 8,
                    }}
                  >
                    🤖
                  </div>
                  <div
                    style={{
                      padding: '10px 14px',
                      background:
                        'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.12))',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '18px 18px 4px 18px',
                    }}
                  >
                    <TypingDots />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions (show if only 1 message = welcome) */}
            {messages.length === 1 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{
                  padding: '0 12px 10px',
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  flexShrink: 0,
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    style={{
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: 99,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#10b981',
                      cursor: 'pointer',
                      fontFamily: "'Cairo', sans-serif",
                      transition: 'background 0.2s, border-color 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        'rgba(16,185,129,0.15)'
                      e.currentTarget.style.borderColor =
                        'rgba(16,185,129,0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        'rgba(16,185,129,0.08)'
                      e.currentTarget.style.borderColor =
                        'rgba(16,185,129,0.2)'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Input area */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'rgba(2,6,23,0.6)',
                flexShrink: 0,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1.5px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: "'Cairo', sans-serif",
                  color: '#f8fafc',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = 'rgba(16,185,129,0.5)')
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = 'rgba(255,255,255,0.08)')
                }
              />
              <motion.button
                type="submit"
                disabled={!input.trim() || loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background:
                    input.trim() && !loading
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                  transition: 'background 0.2s',
                  boxShadow:
                    input.trim() && !loading
                      ? '0 0 16px rgba(16,185,129,0.35)'
                      : 'none',
                }}
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTop: '2px solid #fff',
                    }}
                  />
                ) : (
                  <span style={{ transform: 'rotate(180deg)' }}>➤</span>
                )}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global styles */}
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4), 0 8px 32px rgba(16,185,129,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(16,185,129,0), 0 8px 32px rgba(16,185,129,0.3); }
        }
      `}</style>
    </>
  )
}
