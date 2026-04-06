import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { formatCurrency } from '../../utils/format'

const SUGGESTED_PROMPTS = [
  "Who is checking out today?",
  "Show me overdue invoices",
  "Which rooms need maintenance?",
  "How is occupancy trending?",
  "Draft a payment reminder for Room 204",
]

const MOCK_CONTEXT = {
  hotelName: 'Quantum Vorvex',
  today: new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  occupied: 12, totalRooms: 32, occupancyPct: 75,
  checkoutsToday: 2, pendingCount: 3, pendingAmount: 38360,
  overdueCount: 1, overdueAmount: 17024,
}

function buildSystemPrompt(ctx) {
  return `You are the Quantum Vortex Hotel Management Assistant for ${ctx.hotelName}.
Current date: ${ctx.today}
Current occupancy: ${ctx.occupied}/${ctx.totalRooms} rooms (${ctx.occupancyPct}%)
Today's checkouts: ${ctx.checkoutsToday}
Pending invoices: ${ctx.pendingCount} (₹${ctx.pendingAmount.toLocaleString('en-IN')})
Overdue invoices: ${ctx.overdueCount} (₹${ctx.overdueAmount.toLocaleString('en-IN')})

You help hotel staff with: guest queries, billing summaries, room status, reports, and drafting messages.
When the user wants to navigate somewhere, include at the end of your response on a new line: [ACTION:navigate:panelId] where panelId is one of: dashboard, rooms, floorplan, maintenance, housekeeping, checkin, guests, bookings, billing, reports, settings, staff, channels, documents, food.
Keep responses concise and helpful. Use Indian currency formatting (₹ with lakh notation). Be friendly and professional.`
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--gold)',
          animation: 'aiPulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

function Message({ msg, onAction }) {
  const isUser = msg.role === 'user'

  // Parse action from assistant message
  let text = msg.content
  let action = null
  const actionMatch = text.match(/\[ACTION:navigate:(\w+)\]/)
  if (actionMatch) {
    action = actionMatch[1]
    text = text.replace(/\[ACTION:navigate:\w+\]/, '').trim()
  }

  const PANEL_LABELS = {
    dashboard: 'Dashboard', rooms: 'Rooms', floorplan: 'Floor Plan',
    maintenance: 'Maintenance', housekeeping: 'Housekeeping', checkin: 'Check-In',
    guests: 'All Guests', bookings: 'Bookings', billing: 'Billing & Payments',
    reports: 'Reports', settings: 'Settings', staff: 'Staff', channels: 'Channels',
    documents: 'Documents', food: 'Food Options',
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 14px',
    }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? 'var(--gold-bg)' : 'var(--surface2)',
        border: `1px solid ${isUser ? 'var(--gold-border)' : 'var(--border)'}`,
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '9px 13px',
        fontSize: 13,
        color: 'var(--text)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {text}
        {action && (
          <button
            onClick={() => onAction(action)}
            style={{
              display: 'block', marginTop: 8,
              padding: '5px 12px', borderRadius: 6,
              background: 'var(--gold)', color: '#000',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            → Open {PANEL_LABELS[action] || action}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const { setActivePanel, hotelName } = useStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('qv_anthropic_key') || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [dailyInsight, setDailyInsight] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Keyboard shortcut: Shift+A
  useEffect(() => {
    const handler = (e) => {
      if (e.shiftKey && e.key === 'A' && !['input','textarea','select'].includes(e.target.tagName.toLowerCase())) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Generate daily insight on open (cached 1 hour)
  useEffect(() => {
    if (!open || dailyInsight !== null) return
    const cached = localStorage.getItem('qv_daily_insight')
    const cachedTime = localStorage.getItem('qv_daily_insight_time')
    if (cached && cachedTime && Date.now() - Number(cachedTime) < 3600000) {
      setDailyInsight(cached); return
    }
    if (!apiKey) {
      setDailyInsight("Configure your Anthropic API key to get AI-powered daily insights.")
      return
    }
    fetchInsight()
  }, [open])

  const fetchInsight = async () => {
    if (!apiKey) return
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 150,
          system: buildSystemPrompt({ ...MOCK_CONTEXT, hotelName }),
          messages: [{ role: 'user', content: 'Give me a 2-sentence daily insight about today\'s hotel performance. Be specific, concise, and actionable.' }],
        }),
      })
      const data = await res.json()
      const insight = data.content?.[0]?.text || "Today's insights are unavailable."
      setDailyInsight(insight)
      localStorage.setItem('qv_daily_insight', insight)
      localStorage.setItem('qv_daily_insight_time', String(Date.now()))
    } catch {
      setDailyInsight("Could not load insight. Check your API key in settings.")
    }
  }

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim()) return
    const userMsg = { role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    // If no API key — use mock response
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 600))
      const mockResponse = getMockResponse(userText)
      setMessages(prev => [...prev, { role: 'assistant', content: mockResponse }])
      setLoading(false)
      return
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          system: buildSystemPrompt({ ...MOCK_CONTEXT, hotelName }),
          messages: history,
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || "Sorry, I couldn't process that request."
      setMessages(prev => [...prev, { role: 'assistant', content: text }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please check your API key and try again." }])
    }
    setLoading(false)
  }, [messages, apiKey, hotelName])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleAction = (panelId) => {
    setActivePanel(panelId)
    setOpen(false)
  }

  const saveApiKey = () => {
    localStorage.setItem('qv_anthropic_key', apiKey)
    setShowKeyInput(false)
    setDailyInsight(null) // refresh insight
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Quantum Assistant (Shift+A)"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--gold)', color: '#000',
          border: 'none', cursor: 'pointer',
          fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(201,168,76,0.4)',
          zIndex: 1500, transition: 'all 0.2s',
          fontFamily: 'Inter, sans-serif',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(201,168,76,0.55)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.4)' }}
      >✦</button>
    )
  }

  return (
    <>
      <style>{`
        @keyframes aiPulse {
          0%,100% { opacity:0.4; transform:scale(0.8); }
          50% { opacity:1; transform:scale(1.2); }
        }
      `}</style>

      {/* Backdrop on mobile */}
      <div
        onClick={() => setOpen(false)}
        style={{
          display: 'none',
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 1498,
        }}
        className="ai-backdrop"
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        width: 360, height: 560,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        zIndex: 1500,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '13px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: 'var(--gold)' }}>✦</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Quantum Assistant
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setMessages([])}
              title="Clear chat"
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '3px 7px', borderRadius: 4 }}
            >Clear</button>
            <button
              onClick={() => setShowKeyInput(k => !k)}
              title="Configure API key"
              style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '3px 8px', borderRadius: 4 }}
            >⚙</button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            >×</button>
          </div>
        </div>

        {/* API Key input (collapsible) */}
        {showKeyInput && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Anthropic API Key
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
              />
              <button onClick={saveApiKey} className="btn btn-primary btn-xs">Save</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>
              Key stored locally in your browser. Never sent to our servers.
            </div>
          </div>
        )}

        {/* Daily insight card */}
        {dailyInsight && messages.length === 0 && (
          <div style={{
            margin: '12px 14px 0',
            padding: '10px 13px',
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-border)',
            borderRadius: 8,
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              ✦ Today's Insight
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{dailyInsight}</div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {messages.length === 0 && (
            <div style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Suggested questions
              </div>
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', marginBottom: 6,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text2)', cursor: 'pointer',
                    fontSize: 12.5, fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <Message key={i} msg={msg} onAction={handleAction} />
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 14px' }}>
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '12px 12px 12px 2px',
              }}>
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send)"
            rows={1}
            style={{
              flex: 1, resize: 'none', overflow: 'hidden',
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'Inter, sans-serif',
              outline: 'none', lineHeight: 1.4,
              transition: 'border-color 0.14s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: input.trim() && !loading ? 'var(--gold)' : 'var(--surface2)',
              color: input.trim() && !loading ? '#000' : 'var(--text3)',
              border: '1px solid var(--border2)',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              fontSize: 16, fontWeight: 700, flexShrink: 0,
              transition: 'all 0.14s',
            }}
          >↑</button>
        </div>
      </div>
    </>
  )
}

// Mock responses when no API key
function getMockResponse(query) {
  const q = query.toLowerCase()
  if (q.includes('checkout') || q.includes('check out')) {
    return "Today's checkouts: Sneha Rao from Room 118 and Arjun Patel from Room 312. Both have pending dues — Sneha's final bill is ₹3,240 and Arjun's is ₹6,800. [ACTION:navigate:guests]"
  }
  if (q.includes('overdue') || q.includes('invoice')) {
    return "There is 1 overdue invoice: INV-003 for Ankit Singh (Room 312), amount ₹17,024 — overdue since 31 Mar 2026. Recommend sending a payment reminder immediately. [ACTION:navigate:billing]"
  }
  if (q.includes('maintenance') || q.includes('repair')) {
    return "3 maintenance requests are currently open: MNT-001 (Room 103 — AC issue, High priority), MNT-003 (Room 312 — Electrical, High priority), and MNT-002 (Room 207 — Plumbing, In Progress). [ACTION:navigate:maintenance]"
  }
  if (q.includes('occupancy') || q.includes('trend')) {
    return "Current occupancy is 75% (12/32 rooms). This is up 8% from yesterday. Suite and Deluxe categories are fully occupied. 8 Single rooms are available — consider a walk-in promotion. [ACTION:navigate:reports]"
  }
  if (q.includes('reminder') || q.includes('payment') || q.includes('room 204')) {
    return `Here is a draft reminder for Room 204:\n\n"Dear Guest, your payment of ₹29,344 for Room 204 (Apr 2026) is due. Please contact reception at your earliest convenience. Thank you for staying with Quantum Vorvex."\n\nYou can send this via WhatsApp or SMS from the Billing page. [ACTION:navigate:billing]`
  }
  return `I'm your Quantum Vortex assistant. I can help with guest queries, room status, billing, and more. Add your Anthropic API key (⚙ above) to enable full AI responses. Current occupancy: 75% | Pending: ₹38,360 | Overdue: ₹17,024.`
}
