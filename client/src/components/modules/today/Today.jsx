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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={() => setActivePanel(k.panel)}
            className="stat-card"
            style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'var(--gold-bg)', color: k.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <k.Icon size={21} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                {loading ? '—' : k.value}
              </div>
              <div className="t-xs" style={{ color: 'var(--text3)', marginTop: 3 }}>{k.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Three action columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>

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
          <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 2px' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', padding: '6px 0 4px' }}>
            Open maintenance ({openTickets.length})
          </div>
          {openTickets.length === 0
            ? <Empty text="No open tickets" />
            : openTickets.slice(0, 4).map(t => (
              <div
                key={t.id}
                onClick={() => setActivePanel('maintenance')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLOR[String(t.priority).toLowerCase()] || 'var(--text3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div className="t-label" style={{ color: 'var(--text3)' }}>Room {t.roomNumber} · {t.priority}</div>
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
    <div className="card" style={accent ? { borderColor: 'var(--gold-border)' } : undefined}>
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} style={{ color: 'var(--gold)' }} />
          {title}
          <span className="t-label" style={{ background: 'var(--gold-bg)', color: 'var(--gold)', padding: '1px 8px', borderRadius: 10 }}>{count}</span>
        </span>
        {onView && (
          <button onClick={onView} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            {viewLabel} <LuArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: 4, paddingBottom: 8 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ name, meta, right, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <LuBedDouble size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title" style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{meta}</div>
      </div>
      {right}
      {action && (
        <button onClick={action.onClick} className="btn btn-outline btn-xs" style={{ flexShrink: 0 }}>{action.label}</button>
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
    <span style={{ background: t.bg, color: t.fg, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
  )
}

function AttentionRow({ Icon, tone, label, value, onClick }) {
  const tones = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)' }
  const color = tones[tone] || 'var(--text2)'
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span className="t-sm" style={{ flex: 1, color: 'var(--text)' }}>{label}</span>
      <span className="t-title" style={{ color: value > 0 ? color : 'var(--text3)' }}>{value}</span>
      <LuArrowRight size={13} style={{ color: 'var(--text3)' }} />
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{text}</div>
}
