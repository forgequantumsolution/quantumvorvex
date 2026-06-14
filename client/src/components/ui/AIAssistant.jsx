import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppSelector, useUiActions } from '../../store/hooks'
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
    <div className="flex items-center gap-1 px-[14px] py-2.5">
      {[0,1,2].map(i => (
        <div key={i} className="w-[7px] h-[7px] rounded-full bg-[var(--gold)]" style={{
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
    <div className={`flex px-[14px] py-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`t-sm max-w-[85%] border px-[13px] py-[9px] text-ink whitespace-pre-wrap ${isUser ? 'bg-[var(--gold-bg)] border-[var(--gold-border)] rounded-[12px_12px_2px_12px]' : 'bg-surface2 border-line rounded-[12px_12px_12px_2px]'}`} style={{
        lineHeight: 1.5,
      }}>
        {text}
        {action && (
          <button
            onClick={() => onAction(action)}
            className="t-xs block mt-2 px-3 py-[5px] rounded-md bg-[var(--gold)] border-none cursor-pointer"
            style={{ color: '#000' }}
          >
            → Open {PANEL_LABELS[action] || action}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const hotelName = useAppSelector((s) => s.hotel.hotelName)
  const { setActivePanel } = useUiActions()
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
        className="t-h1 fixed bottom-[24px] right-[24px] w-[52px] h-[52px] rounded-full bg-[var(--gold)] border-none cursor-pointer flex items-center justify-center shadow-[0_4px_20px_rgba(201,168,76,0.4)] z-[1500] transition-all duration-200"
        style={{ color: '#000' }}
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
        className="ai-backdrop hidden fixed inset-0 bg-[rgba(0,0,0,0.3)] z-[1498]"
      />

      {/* Panel */}
      <div className="fixed bottom-[24px] right-[24px] w-[360px] h-[560px] bg-surface border border-line rounded-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] z-[1500] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-[13px] border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <span className="t-h3 text-gold">✦</span>
            <span className="t-title text-ink">
              Quantum Assistant
            </span>
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => setMessages([])}
              title="Clear chat"
              className="t-label bg-none border-none text-ink3 cursor-pointer px-[7px] py-[3px] rounded"
            >Clear</button>
            <button
              onClick={() => setShowKeyInput(k => !k)}
              title="Configure API key"
              className="t-xs bg-none border border-line2 text-ink3 cursor-pointer px-2 py-[3px] rounded"
            >⚙</button>
            <button
              onClick={() => setOpen(false)}
              className="t-h2 bg-none border-none text-ink3 cursor-pointer leading-none px-0.5"
            >×</button>
          </div>
        </div>

        {/* API Key input (collapsible) */}
        {showKeyInput && (
          <div className="px-4 py-2.5 border-b border-line bg-surface2 shrink-0">
            <div className="t-label text-ink3 mb-1.5">
              Anthropic API Key
            </div>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink text-[12px] outline-none"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <button onClick={saveApiKey} className="btn btn-primary btn-xs">Save</button>
            </div>
            <div className="t-xs text-ink3 mt-[5px]">
              Key stored locally in your browser. Never sent to our servers.
            </div>
          </div>
        )}

        {/* Daily insight card */}
        {dailyInsight && messages.length === 0 && (
          <div className="mt-3 mx-[14px] px-[13px] py-2.5 bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-lg shrink-0">
            <div className="t-label text-gold mb-[5px]">
              ✦ Today's Insight
            </div>
            <div className="t-xs text-ink2" style={{ lineHeight: 1.5 }}>{dailyInsight}</div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-0 py-3">
          {messages.length === 0 && (
            <div className="px-[14px] py-2">
              <div className="t-label text-ink3 mb-2.5">
                Suggested questions
              </div>
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="block w-full text-left px-3 py-2 mb-1.5 bg-surface2 border border-line rounded-lg text-ink2 cursor-pointer text-[12.5px] transition-all duration-[120ms]"
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
            <div className="flex justify-start px-[14px] py-1">
              <div className="bg-surface2 border border-line rounded-[12px_12px_12px_2px]">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-[14px] py-2.5 border-t border-line flex gap-2 items-end bg-surface shrink-0">
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
            className="t-sm flex-1 resize-none overflow-hidden px-2.5 py-2 rounded-lg border border-line bg-surface2 text-ink outline-none leading-[1.4] transition-[border-color] duration-[140ms]"
            onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={`t-h3 px-[14px] py-2 rounded-lg border border-line2 shrink-0 transition-all duration-[140ms] ${input.trim() && !loading ? 'bg-[var(--gold)] cursor-pointer' : 'bg-surface2 text-ink3 cursor-not-allowed'}`}
            style={{ color: input.trim() && !loading ? '#000' : undefined }}
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
