import { useEffect, useState } from 'react'
import {
  LuLogIn, LuLogOut, LuUsers, LuWrench, LuCalendarX,
  LuTriangleAlert, LuArrowRight, LuBedDouble,
} from 'react-icons/lu'
import StatCard from '../../ui-tw/StatCard'
import { StatStrip } from '../../ui-tw'
import { usePageHeader, useUiActions } from '../../../store/hooks'
import { bookingsApi, guestsApi, maintenanceApi } from '../../../api/client'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../../utils/format'
import { appLocale } from '../../../i18n'

// ── Date helpers ──────────────────────────────────────────────────────────────
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const dayStart = (iso) => { if (!iso) return null; const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime() }
const isToday = (iso) => dayStart(iso) === startOfToday()
const isPast  = (iso) => { const t = dayStart(iso); return t != null && t < startOfToday() }

const PRIORITY_COLOR = {
  urgent: 'var(--red)', high: 'var(--red)', medium: 'var(--amber)', low: 'var(--text3)',
}

export default function Today() {
  const { t } = useTranslation('today')
  const { setActivePanel, navigateTo } = useUiActions()

  // Front-desk work now lives inside Bookings; deep-link straight to the
  // relevant status tab instead of a standalone check-in/check-out screen.
  const goBookings = (tab) => navigateTo({ panel: 'bookings', params: { tab } })

  usePageHeader({
    title: t('title'),
    subtitle: new Date().toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  })

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
    ]).then(([b, g, tk]) => {
      if (!alive) return
      setBookings(b); setGuests(g); setTickets(tk); setLoading(false)
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
  const openTickets = tickets.filter(tk => ['pending', 'in_progress'].includes(String(tk.status).toLowerCase()))
  const cancellations = bookings.filter(b => String(b.status).toLowerCase() === 'cancelled')

  const kpis = [
    { id: 'arrivals', label: t('kpi.arrivals'), value: arrivals.length, Icon: LuLogIn, tone: 'blue', hint: t('kpi.arrivalsHint'),  onClick: () => goBookings('Upcoming')  },
    { id: 'departures', label: t('kpi.departures'), value: departures.length, Icon: LuLogOut, tone: 'amber', hint: t('kpi.departuresHint'), onClick: () => goBookings('CheckedIn') },
    { id: 'inHouse', label: t('kpi.inHouse'), value: inHouse.length, Icon: LuUsers, tone: 'green', hint: t('kpi.inHouseHint'), onClick: () => goBookings('CheckedIn') },
    { id: 'maintenance', label: t('kpi.openMaintenance'), value: openTickets.length, Icon: LuWrench, tone: 'red', hint: t('kpi.openMaintenanceHint'), onClick: () => setActivePanel('maintenance') },
  ]

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* KPI strip from xl; each segment deep-links. Below xl the columns
          underneath carry the same counts. */}
      <StatStrip>
        {kpis.map(k => (
          <StatCard key={k.id} label={k.label} value={k.value} hint={k.hint} icon={<k.Icon />}
            tone={k.tone} loading={loading} onClick={k.onClick} />
        ))}
      </StatStrip>

      {/* Action columns: stacked on phones, two-up on tablets (Needs Attention
          spans the row), three across from xl. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-start">

        {/* Arrivals */}
        <Column title={t('expectedArrivals')} Icon={LuLogIn} count={arrivals.length} onView={() => goBookings('Upcoming')} viewLabel={t('viewBookings')}>
          {arrivals.length === 0
            ? <Empty text={t('noArrivals')} />
            : arrivals.slice(0, 6).map(b => (
              <Row
                key={b.id}
                name={b.guestName}
                meta={`${t('roomNo', { number: b.roomNumber || '—' })} · ${b.roomType || ''}`}
                right={<DateChip label={isToday(b.checkIn) ? t('common:today') : formatDate(b.checkIn, { month: 'short', day: 'numeric' })} tone={isToday(b.checkIn) ? 'gold' : 'grey'} />}
                action={{ label: t('checkIn'), onClick: () => goBookings('Upcoming') }}
              />
            ))}
        </Column>

        {/* Departures */}
        <Column title={t('departures')} Icon={LuLogOut} count={departures.length} onView={() => goBookings('CheckedIn')} viewLabel={t('viewBookings')}
          note={`${t('kpi.inHouse')}: ${inHouse.length}`}>
          {departures.length === 0
            ? <Empty text={t('noCheckouts')} />
            : departures.slice(0, 6).map(g => {
              const overdue = isPast(g.checkOut)
              return (
                <Row
                  key={g.id}
                  name={g.name}
                  meta={t('roomNo', { number: g.roomNumber || '—' })}
                  right={<DateChip label={overdue ? t('common:overdue') : t('common:today')} tone={overdue ? 'red' : 'amber'} />}
                  action={{ label: t('checkOut'), onClick: () => goBookings('CheckedIn') }}
                />
              )
            })}
        </Column>

        {/* Needs attention */}
        <Column className="md:col-span-2 xl:col-span-1" title={t('needsAttention')} Icon={LuTriangleAlert} count={overdueCheckouts.length + openTickets.length + cancellations.length} accent>
          <AttentionRow
            Icon={LuLogOut} tone="red"
            label={t('overdueCheckouts')}
            value={overdueCheckouts.length}
            onClick={() => goBookings('CheckedIn')}
          />
          <AttentionRow
            Icon={LuCalendarX} tone="amber"
            label={t('cancellationsToday')}
            value={cancellations.length}
            onClick={() => setActivePanel('cancellations')}
          />
          <div className="text-xs font-bold tracking-[0.06em] uppercase text-ink3 pt-3 pb-1">
            {t('openMaintenanceCount', { count: openTickets.length })}
          </div>
          {openTickets.length === 0
            ? <Empty text={t('noOpenTickets')} />
            : openTickets.slice(0, 4).map(tk => (
              <button
                key={tk.id}
                type="button"
                onClick={() => setActivePanel('maintenance')}
                className="w-full flex items-center gap-2.5 py-2 min-h-11 text-left cursor-pointer border-b border-line last:border-b-0
                           bg-transparent transition-colors duration-150 hover:text-ink"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[String(tk.priority).toLowerCase()] || 'var(--text3)' }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-ink truncate">{tk.title}</span>
                  <span className="block t-label">{t('roomNo', { number: tk.roomNumber })} · {t(`priority.${String(tk.priority).toLowerCase()}`, { defaultValue: tk.priority })}</span>
                </span>
                <LuArrowRight size={13} className="text-ink3 shrink-0" />
              </button>
            ))}
        </Column>
      </div>
    </div>
  )
}

// ── Building blocks ───────────────────────────────────────────────────────────
// `note` is a line shown below xl, where the KPI strip (and its figures) is hidden.
function Column({ title, Icon: ColumnIcon, count, children, onView, viewLabel, accent, note, className = '' }) {
  // Capitalised local so it renders as a component (and counts as used for eslint).
  const Icon = ColumnIcon
  const { t } = useTranslation('today')
  return (
    <div className={`card min-w-0 ${accent ? 'border-[var(--gold-border)]' : ''} ${className}`}>
      <div className="card-header flex-nowrap">
        <span className="card-title flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-gold shrink-0" />
          <span className="truncate">{title}</span>
          <span className="t-label bg-[var(--gold-bg)] text-gold px-2 py-px rounded-[10px] shrink-0">{count}</span>
        </span>
        {onView && (
          <button
            onClick={onView}
            aria-label={viewLabel}
            className="bg-transparent border-0 cursor-pointer text-gold text-xs font-semibold flex items-center gap-[3px]
                       shrink-0 whitespace-nowrap pointer-coarse:min-h-11 -my-1"
          >
            {/* "View all" keeps the title readable in the two-up tablet columns. */}
            {t('common:viewAll')} <LuArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="card-body pt-1 pb-2">
        {note && <div className="xl:hidden text-xs font-medium text-ink3 pt-1.5 pb-1">{note}</div>}
        {children}
      </div>
    </div>
  )
}

function Row({ name, meta, right, action }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-line last:border-b-0">
      <div className="hidden min-[400px]:flex w-[30px] h-[30px] rounded-lg bg-surface2 text-ink3 items-center justify-center shrink-0">
        <LuBedDouble size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="t-title truncate">{name}</div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <span className="text-xs text-ink3 truncate">{meta}</span>
          {right}
        </div>
      </div>
      {action && (
        <button onClick={action.onClick} className="btn btn-outline btn-sm shrink-0">{action.label}</button>
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
  const c = tones[tone] || tones.grey
  return (
    <span
      className="text-xs font-bold px-2 py-px rounded-[10px] whitespace-nowrap shrink-0"
      style={{ background: c.bg, color: c.fg }}
    >{label}</span>
  )
}

function AttentionRow({ Icon: RowIcon, tone, label, value, onClick }) {
  const Icon = RowIcon
  const tones = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)' }
  const color = tones[tone] || 'var(--text2)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 py-2 min-h-11 text-left cursor-pointer border-b border-line bg-transparent
                 transition-colors duration-150 hover:text-ink"
    >
      <Icon size={16} className="shrink-0" style={{ color }} />
      <span className="t-sm flex-1 min-w-0 truncate">{label}</span>
      <span className="t-title tabular-nums" style={{ color: value > 0 ? color : 'var(--text3)' }}>{value}</span>
      <LuArrowRight size={13} className="text-ink3 shrink-0" />
    </button>
  )
}

function Empty({ text }) {
  return <div className="py-[18px] text-center text-ink3 text-[13px]">{text}</div>
}
