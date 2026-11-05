import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppSelector, useUiActions } from '../../store/hooks'
import i18n, { appLocale, LANGUAGES } from '../../i18n'
import { useTranslation } from 'react-i18next'

// Suggested questions — text in shell:ai.prompt.<id>; the id also picks the demo answer.
const SUGGESTED_PROMPTS = ['checkouts', 'overdue', 'maintenance', 'occupancy', 'reminder']

const MOCK_CONTEXT = {
  hotelName: 'Quantum Vorvex',
  today: new Date().toLocaleDateString(appLocale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
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
Keep responses concise and helpful. Use Indian currency formatting (₹ with lakh notation). Be friendly and professional.
Reply in ${LANGUAGES.find((l) => l.code === i18n.language)?.label || 'English'}.`
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
  const { t } = useTranslation('shell')
  const isUser = msg.role === 'user'

  // Parse action from assistant message
  let text = msg.content
  let action = null
  const actionMatch = text.match(/\[ACTION:navigate:(\w+)\]/)
  if (actionMatch) {
    action = actionMatch[1]
    text = text.replace(/\[ACTION:navigate:\w+\]/, '').trim()
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
            → {t('ai.open', { panel: t(`nav:${action}`, { defaultValue: action }) })}
          </button>
        )}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const hotelName = useAppSelector((s) => s.hotel.hotelName)
  const { setActivePanel } = useUiActions()
  const { t } = useTranslation('shell')
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
      setDailyInsight(INSIGHT_NO_KEY)
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
      const insight = data.content?.[0]?.text || INSIGHT_FAILED
      setDailyInsight(insight)
      localStorage.setItem('qv_daily_insight', insight)
      localStorage.setItem('qv_daily_insight_time', String(Date.now()))
    } catch {
      setDailyInsight(INSIGHT_FAILED)
    }
  }

  // promptId: set when a suggested question was tapped, so the demo answer
  // doesn't depend on the language the question is shown in.
  const sendMessage = useCallback(async (userText, promptId) => {
    if (!userText.trim()) return
    const userMsg = { role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    // If no API key — use mock response
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 600))
      const mockResponse = getMockResponse(userText, promptId)
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
      const text = data.content?.[0]?.text || i18n.t('shell:ai.cantProcess')
      setMessages(prev => [...prev, { role: 'assistant', content: text }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: i18n.t('shell:ai.connectionError') }])
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
    // Size and position come from --fab-* (index.css), which pages use to keep
    // their bottom-right controls clear of the button (.pr-fab).
    return (
      <button
        onClick={() => setOpen(true)}
        title={`${t('ai.title')} (Shift+A)`}
        aria-label={t('ai.title')}
        className="t-h1 fixed bottom-[calc(var(--bottom-nav-h)+var(--fab-offset))] right-[max(var(--fab-offset),env(safe-area-inset-right))] w-[var(--fab-size)] h-[var(--fab-size)] rounded-full bg-[var(--gold)] border-none cursor-pointer flex items-center justify-center shadow-[0_4px_20px_rgba(201,168,76,0.4)] z-[150] transition-all duration-200"
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
        className="ai-backdrop sm:hidden fixed inset-0 bg-[rgba(0,0,0,0.3)] z-[1498]"
      />

      {/* Panel */}
      {/* Phones: a sheet filling the screen above the bottom bar. sm+: floating card. */}
      <div className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+8px)] bottom-[calc(var(--bottom-nav-h)+8px)] sm:inset-auto sm:bottom-[24px] sm:right-[24px] sm:w-[360px] sm:h-[min(560px,calc(100dvh-48px))] bg-surface border border-line rounded-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] z-[1500] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-[13px] border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <span className="t-h3 text-gold">✦</span>
            <span className="t-title text-ink">
              {t('ai.title')}
            </span>
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => setMessages([])}
              title={t('ai.clearChat')}
              className="t-label bg-none border-none text-ink3 cursor-pointer px-[7px] py-[3px] rounded"
            >{t('ai.clear')}</button>
            <button
              onClick={() => setShowKeyInput(k => !k)}
              title={t('ai.configureKey')} aria-label={t('ai.configureKey')}
              className="t-xs bg-none border border-line2 text-ink3 cursor-pointer px-2 py-[3px] rounded"
            >⚙</button>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('ai.close')}
              className="t-h2 bg-none border-none text-ink3 cursor-pointer leading-none w-9 h-9 flex items-center justify-center"
            >×</button>
          </div>
        </div>

        {/* API Key input (collapsible) */}
        {showKeyInput && (
          <div className="px-4 py-2.5 border-b border-line bg-surface2 shrink-0">
            <div className="t-label text-ink3 mb-1.5">
              {t('ai.apiKey')}
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
              <button onClick={saveApiKey} className="btn btn-primary btn-xs">{t('common:save')}</button>
            </div>
            <div className="t-xs text-ink3 mt-[5px]">
              {t('ai.keyNote')}
            </div>
          </div>
        )}

        {/* Daily insight card */}
        {dailyInsight && messages.length === 0 && (
          <div className="mt-3 mx-[14px] px-[13px] py-2.5 bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-lg shrink-0">
            <div className="t-label text-gold mb-[5px]">
              ✦ {t('ai.insight')}
            </div>
            <div className="t-xs text-ink2" style={{ lineHeight: 1.5 }}>
              {dailyInsight === INSIGHT_NO_KEY ? t('ai.insightNoKey') : dailyInsight === INSIGHT_FAILED ? t('ai.insightFailed') : dailyInsight}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-0 py-3">
          {messages.length === 0 && (
            <div className="px-[14px] py-2">
              <div className="t-label text-ink3 mb-2.5">
                {t('ai.suggested')}
              </div>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(t(`ai.prompt.${p}`), p)}
                  className="block w-full text-left px-3 py-2 mb-1.5 bg-surface2 border border-line rounded-lg text-ink2 cursor-pointer text-[12.5px] transition-all duration-[120ms]"
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  {t(`ai.prompt.${p}`)}
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
            placeholder={t('ai.placeholder')}
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
            aria-label={t('ai.send')}
          >↑</button>
        </div>
      </div>
    </>
  )
}

// Placeholders kept in state for the two built-in insight messages, so they
// are shown in the current language rather than the one active when set.
const INSIGHT_NO_KEY = '__qv_insight_no_key__'
const INSIGHT_FAILED = '__qv_insight_failed__'

// Demo answers when no API key is set (text in shell:ai.mock.*). A tapped
// suggestion passes its id; typed questions are matched on English keywords.
const MOCK_ACTIONS = { checkouts: 'guests', overdue: 'billing', maintenance: 'maintenance', occupancy: 'reports', reminder: 'billing' }
function getMockResponse(query, promptId) {
  const q = query.toLowerCase()
  let id = promptId
  if (!id) {
    if (q.includes('checkout') || q.includes('check out')) id = 'checkouts'
    else if (q.includes('overdue') || q.includes('invoice')) id = 'overdue'
    else if (q.includes('maintenance') || q.includes('repair')) id = 'maintenance'
    else if (q.includes('occupancy') || q.includes('trend')) id = 'occupancy'
    else if (q.includes('reminder') || q.includes('payment') || q.includes('room 204')) id = 'reminder'
  }
  if (!id) return i18n.t('shell:ai.mock.default')
  return `${i18n.t(`shell:ai.mock.${id}`)} [ACTION:navigate:${MOCK_ACTIONS[id]}]`
}
