import { useEffect, useState } from 'react'
import {
  LuLogIn, LuLogOut, LuUsers, LuWrench, LuCalendarX,
  LuTriangleAlert, LuArrowRight, LuBedDouble,
} from 'react-icons/lu'
import { useUiActions } from '../../../store/hooks'
import { bookingsApi, guestsApi, maintenanceApi } from '../../../api/client'
import { formatDate } from '../../../utils/format'

// ── Date helpers ──────────────────────────────────────────────────────────────
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const dayStart = (iso) => { if (!iso) return null; const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime() }
const isToday = (iso) => dayStart(iso) === startOfToday()
const isPast  = (iso) => { const t = dayStart(iso); return t != null && t < startOfToday() }

const PRIORITY_COLOR = {
  urgent: 'var(--red)', high: 'var(--red)', medium: 'var(--amber)', low: 'var(--text3)',
}

export default function Today() {
  const { setActivePanel } = useUiActions()

  const [bookings, setBookings] = useState([])
  const [guests,   setGuests]   = useState([])
  const [tickets,  setTickets]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      bookingsApi.getAll().then(r => r.data?.bookings || []).catch(() => []),
      guestsApi.getAll().then(r => r.data?.guests || []).catch(() => []),
      maintenanceApi.getAll().then(r => r.data?.requests || []).catch(() => []),
    ]).then(([b, g, t]) => {
      if (!alive) return
      setBookings(b); setGuests(g); setTickets(t); setLoading(false)
    })
    return () => { alive = false }
  }, [])

  // ── Derived front-desk state (consistent with the individual modules) ─────────
  const arrivals = bookings
    .filter(b => ['confirmed', 'pending'].includes(String(b.status).toLowerCase()))
    .sort((a, b) => (dayStart(a.checkIn) || 0) - (dayStart(b.checkIn) || 0))

  const inHouse = guests.filter(g => g.status === 'checked_in')

  const departures = inHouse
    .filter(g => isToday(g.checkOut) || isPast(g.checkOut))
    .sort((a, b) => (dayStart(a.checkOut) || 0) - (dayStart(b.checkOut) || 0))

  const overdueCheckouts = inHouse.filter(g => isPast(g.checkOut))
  const openTickets = tickets.filter(t => ['pending', 'in_progress'].includes(String(t.status).toLowerCase()))
  const cancellations = bookings.filter(b => String(b.status).toLowerCase() === 'cancelled')

  const kpis = [
    { label: 'Arrivals',        value: arrivals.length,    Icon: LuLogIn,   color: 'var(--blue)',  panel: 'checkin'  },
    { label: 'Departures',      value: departures.length,  Icon: LuLogOut,  color: 'var(--amber)', panel: 'checkout' },
    { label: 'In-house',        value: inHouse.length,     Icon: LuUsers,   color: 'var(--green)', panel: 'checkout' },
    { label: 'Open maintenance', value: openTickets.length, Icon: LuWrench,  color: 'var(--red)',   panel: 'maintenance' },
  ]

  return (
    <div>
      {/* KPI strip */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[14px] mb-[22px]">
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={() => setActivePanel(k.panel)}
            className="stat-card text-left cursor-pointer border border-line flex items-center gap-[14px]"
          >
            <div
              className="w-11 h-11 rounded-[12px] shrink-0 bg-[var(--gold-bg)] flex items-center justify-center"
              style={{ color: k.color }}
            >
              <k.Icon size={21} />
            </div>
            <div>
              <div className="text-[26px] font-extrabold text-ink leading-none">
                {loading ? '—' : k.value}
              </div>
              <div className="t-xs text-ink3 mt-[3px]">{k.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Three action columns */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4 items-start">

        {/* Arrivals */}
        <Column title="Expected Arrivals" Icon={LuLogIn} count={arrivals.length} onView={() => setActivePanel('checkin')} viewLabel="Check-In desk">
          {arrivals.length === 0
            ? <Empty text="No arrivals scheduled" />
            : arrivals.slice(0, 6).map(b => (
              <Row
                key={b.id}
                name={b.guestName}
                meta={`Room ${b.roomNumber || '—'} · ${b.roomType || ''}`}
                right={<DateChip label={isToday(b.checkIn) ? 'Today' : formatDate(b.checkIn, { month: 'short', day: 'numeric' })} tone={isToday(b.checkIn) ? 'gold' : 'grey'} />}
                action={{ label: 'Check in', onClick: () => setActivePanel('checkin') }}
              />
            ))}
        </Column>

        {/* Departures */}
        <Column title="Departures" Icon={LuLogOut} count={departures.length} onView={() => setActivePanel('checkout')} viewLabel="Check-Out desk">
          {departures.length === 0
            ? <Empty text="No checkouts due" />
            : departures.slice(0, 6).map(g => {
              const overdue = isPast(g.checkOut)
              return (
                <Row
                  key={g.id}
                  name={g.name}
                  meta={`Room ${g.roomNumber || '—'}`}
                  right={<DateChip label={overdue ? 'Overdue' : 'Today'} tone={overdue ? 'red' : 'amber'} />}
                  action={{ label: 'Check out', onClick: () => setActivePanel('checkout') }}
                />
              )
            })}
        </Column>

        {/* Needs attention */}
        <Column title="Needs Attention" Icon={LuTriangleAlert} count={overdueCheckouts.length + openTickets.length + cancellations.length} accent>
          <AttentionRow
            Icon={LuLogOut} tone="red"
            label="Overdue checkouts"
            value={overdueCheckouts.length}
            onClick={() => setActivePanel('checkout')}
          />
          <AttentionRow
            Icon={LuCalendarX} tone="amber"
            label="Cancellations today"
            value={cancellations.length}
            onClick={() => setActivePanel('cancellations')}
          />
          <div className="border-t border-line mt-1.5 mb-0.5" />
          <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink3 pt-1.5 pb-1">
            Open maintenance ({openTickets.length})
          </div>
          {openTickets.length === 0
            ? <Empty text="No open tickets" />
            : openTickets.slice(0, 4).map(t => (
              <div
                key={t.id}
                onClick={() => setActivePanel('maintenance')}
                className="flex items-center gap-2.5 py-2 cursor-pointer border-b border-line"
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[String(t.priority).toLowerCase()] || 'var(--text3)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink whitespace-nowrap overflow-hidden text-ellipsis">{t.title}</div>
                  <div className="t-label">Room {t.roomNumber} · {t.priority}</div>
                </div>
              </div>
            ))}
        </Column>
      </div>
    </div>
  )
}

// ── Building blocks ───────────────────────────────────────────────────────────
function Column({ title, Icon, count, children, onView, viewLabel, accent }) {
  return (
    <div className={`card ${accent ? 'border-[var(--gold-border)]' : ''}`}>
      <div className="card-header">
        <span className="card-title flex items-center gap-2">
          <Icon size={16} className="text-gold" />
          {title}
          <span className="t-label bg-[var(--gold-bg)] text-gold px-2 py-px rounded-[10px]">{count}</span>
        </span>
        {onView && (
          <button onClick={onView} className="bg-none border-0 cursor-pointer text-gold text-[11.5px] font-semibold flex items-center gap-[3px]">
            {viewLabel} <LuArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="card-body pt-1 pb-2">
        {children}
      </div>
    </div>
  )
}

function Row({ name, meta, right, action }) {
  return (
    <div className="flex items-center gap-2.5 py-[9px] border-b border-line">
      <div className="w-[30px] h-[30px] rounded-lg bg-surface2 text-ink3 flex items-center justify-center shrink-0">
        <LuBedDouble size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="t-title whitespace-nowrap overflow-hidden text-ellipsis">{name}</div>
        <div className="text-[11.5px] text-ink3">{meta}</div>
      </div>
      {right}
      {action && (
        <button onClick={action.onClick} className="btn btn-outline btn-xs shrink-0">{action.label}</button>
      )}
    </div>
  )
}

function DateChip({ label, tone }) {
  const tones = {
    gold:  { bg: 'var(--gold-bg)',  fg: 'var(--gold)'      },
    amber: { bg: 'var(--amber-bg)', fg: 'var(--amber-text)' },
    red:   { bg: 'var(--red-bg)',   fg: 'var(--red-text)'   },
    grey:  { bg: 'var(--surface2)', fg: 'var(--text3)'      },
  }
  const t = tones[tone] || tones.grey
  return (
    <span
      className="text-[10.5px] font-bold px-2 py-0.5 rounded-[10px] whitespace-nowrap shrink-0"
      style={{ background: t.bg, color: t.fg }}
    >{label}</span>
  )
}

function AttentionRow({ Icon, tone, label, value, onClick }) {
  const tones = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)' }
  const color = tones[tone] || 'var(--text2)'
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 py-[9px] cursor-pointer border-b border-line"
    >
      <Icon size={16} className="shrink-0" style={{ color }} />
      <span className="t-sm flex-1">{label}</span>
      <span className="t-title" style={{ color: value > 0 ? color : 'var(--text3)' }}>{value}</span>
      <LuArrowRight size={13} className="text-ink3" />
    </div>
  )
}

function Empty({ text }) {
  return <div className="py-[18px] text-center text-ink3 text-[12.5px]">{text}</div>
}
