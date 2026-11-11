import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { useAppSelector, usePageHeader, useUiActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatCurrencyCompact, statusColor } from '../../../utils/format'
import { LuBedDouble, LuDoorOpen, LuUserCheck, LuWrench, LuIndianRupee, LuChartPie, LuKeyboard, LuPrinter } from 'react-icons/lu'
import StatCard from '../../ui/StatCard'
import { DataTable } from '../../ui-tw'
import Modal from '../../ui/Modal'
import { appLocale } from '../../../i18n'

// ─── Mock data (replace with React Query) ────────────────────────────────────
const mockStats = {
  total: 32,
  available: 18,
  occupied: 12,
  maintenance: 2,
  revenue: 180000,
  occupancyRate: 75,
}

const mockGuests = [
  { id: '1', name: 'Rahul Sharma',  room: '101', type: 'Monthly', tags: ['VIP'],        status: 'Active', checkIn: '2026-04-01' },
  { id: '2', name: 'Priya Patel',   room: '205', type: 'Daily',   tags: ['Corporate'],  status: 'Active', checkIn: '2026-04-03' },
  { id: '3', name: 'Ankit Singh',   room: '312', type: 'Monthly', tags: [],             status: 'Due',    checkIn: '2026-03-15' },
]

// date: 'today' | 'tomorrow' | an ISO date.
const mockCheckouts = [
  { name: 'Sneha Rao',    room: '118', date: 'today' },
  { name: 'Arjun Patel',  room: '312', date: 'tomorrow' },
  { name: 'Vijay Kumar',  room: '221', date: '2026-04-08' },
]

const mockRevenue = [
  { month: 10, amount: 120000 },
  { month: 11, amount: 145000 },
  { month: 0, amount: 98000 },
  { month: 1, amount: 165000 },
  { month: 2, amount: 152000 },
  { month: 3, amount: 180000 },
]

const mockOccupancy = [
  { month: 10, rate: 62 },
  { month: 11, rate: 71 },
  { month: 0, rate: 54 },
  { month: 1, rate: 80 },
  { month: 2, rate: 73 },
  { month: 3, rate: 75 },
]

// msg / event are keys in locales/<lang>/dashboard.json; params fill them in.
// hoursAgo: null means "yesterday".
const mockNotifs = [
  { id: 1, type: 'warn',    icon: '⚠', msg: 'notif.paymentDue',      params: { room: '312', count: 3 },           hoursAgo: 2 },
  { id: 2, type: 'info',    icon: 'ℹ', msg: 'notif.maintTomorrow',   params: { room: '207' },                     hoursAgo: 4 },
  { id: 3, type: 'success', icon: '✓', msg: 'notif.newCheckIn',      params: { room: '405', name: 'Kavita Joshi' }, hoursAgo: 6 },
  { id: 4, type: 'danger',  icon: '!', msg: 'notif.idPending',       params: { room: '110' },                     hoursAgo: null },
]

const todayTimeline = [
  { time: '07:30', event: 'timeline.hkShift',     params: {},                                                         type: 'hk',      icon: '🧹', done: true  },
  { time: '09:15', event: 'timeline.checkedIn',   params: { name: 'Anjali Singh', room: '103' },                      type: 'checkin', icon: '↗',  done: true  },
  { time: '11:00', event: 'timeline.paid',        params: { invoice: 'INV-002', name: 'Priya Patel', amount: '₹9,016' }, type: 'billing', icon: '◑',  done: true  },
  { time: '12:00', event: 'timeline.checkoutDue', params: { name: 'Sneha Rao', room: '118' },                         type: 'urgent',  icon: '⚠',  done: false },
  { time: '14:00', event: 'timeline.arriving',    params: { name: 'Farhan Ahmed', room: '201' },                      type: 'checkin', icon: '↗',  done: false },
  { time: '16:00', event: 'timeline.acCheck',     params: { room: '105' },                                            type: 'maint',   icon: '🔧', done: false },
  { time: '20:00', event: 'timeline.nightAudit',  params: {},                                                         type: 'audit',   icon: '🌙', done: false },
]

const TIMELINE_COLORS = {
  checkin: { bg: '#dbeafe', text: '#1d4ed8' },
  billing: { bg: 'rgba(201,168,76,0.12)', text: '#92400e' },
  urgent:  { bg: '#fee2e2', text: '#b91c1c' },
  hk:      { bg: '#f0fdf4', text: '#15803d' },
  maint:   { bg: '#fef9c3', text: '#854d0e' },
  audit:   { bg: '#f3f4f6', text: '#374151' },
}

const mockRoomTypes = [
  { label: 'Standard',  occupied: 8,  total: 12 },
  { label: 'Deluxe',    occupied: 3,  total: 8  },
  { label: 'Suite',     occupied: 1,  total: 6  },
  { label: 'Executive', occupied: 0,  total: 6  },
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-[12px] text-white">
      <div className="text-[#888] mb-0.5">{label}</div>
      <div className="font-semibold text-gold">
        {formatter ? formatter(val) : val}
      </div>
    </div>
  )
}

// ─── Tag component ────────────────────────────────────────────────────────────
function GuestTag({ tag }) {
  const cls =
    tag === 'VIP'        ? 'gtag gtag-vip'  :
    tag === 'Corporate'  ? 'gtag gtag-corp' :
    tag === 'Long-term'  ? 'gtag gtag-long' : 'gtag gtag-long'
  return <span className={cls}>{tag}</span>
}

// ─── Shortcuts Modal ──────────────────────────────────────────────────────────
// labelKey: a key in dashboard.json (translated at render time).
const SHORTCUTS = [
  { key: 'D', labelKey: 'shortcuts.dashboard' },
  { key: 'R', labelKey: 'shortcuts.rooms' },
  { key: 'F', labelKey: 'shortcuts.floorPlan' },
  { key: 'T', labelKey: 'shortcuts.reports' },
  { key: 'C', labelKey: 'shortcuts.checkIn' },
  { key: 'G', labelKey: 'shortcuts.guests' },
  { key: 'B', labelKey: 'shortcuts.billing' },
  { key: 'S', labelKey: 'shortcuts.settings' },
  { key: 'M', labelKey: 'shortcuts.darkMode' },
  { key: 'Esc', labelKey: 'shortcuts.closeModal' },
  { key: '?', labelKey: 'shortcuts.openShortcuts' },
]

// Display labels for stay types / statuses (the values stay in English).
const TYPE_KEYS   = { Monthly: 'type.monthly', Daily: 'type.daily' }
const STATUS_KEYS = { Active: 'status.active', Due: 'status.due' }

const monthLabel = (m) => new Date(2026, m, 1).toLocaleDateString(appLocale(), { month: 'short' })

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const hotelName    = useAppSelector((s) => s.hotel.hotelName)
  const { setActivePanel } = useUiActions()
  const addToast     = useToast()
  const { t } = useTranslation('dashboard')

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const stats = mockStats

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleCheckout(guest) {
    addToast(t('toast.checkout', { name: guest.name, room: guest.room }), 'success')
  }

  function handleExtend(guest) {
    addToast(t('toast.extended', { name: guest.name, room: guest.room }), 'info')
  }

  function handlePrint() {
    window.print()
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const availablePct    = Math.round((stats.available   / stats.total) * 100)
  const occupiedPct     = Math.round((stats.occupied    / stats.total) * 100)
  const revenueData     = mockRevenue.map((d) => ({ ...d, month: monthLabel(d.month) }))
  const occupancyData   = mockOccupancy.map((d) => ({ ...d, month: monthLabel(d.month) }))
  const typeLabel   = (v) => (TYPE_KEYS[v] ? t(TYPE_KEYS[v]) : v)
  const statusLabel = (v) => (STATUS_KEYS[v] ? t(STATUS_KEYS[v]) : v)
  const dateLabel   = (d) =>
    d === 'today' ? t('common:today') :
    d === 'tomorrow' ? t('common:tomorrow') :
    new Date(`${d}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' })
  const since = (d) => t('since', { date: new Date(`${d}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) })

  const mono = { fontFamily: 'var(--font-mono)' }
  const dateTone = (d) => (d === 'today' ? 'text-danger-text' : d === 'tomorrow' ? 'text-warning-text' : 'text-ink2')
  const guestColumns = [
    {
      key: 'name', header: t('common:guest'),
      render: (g) => (
        <>
          <div className="t-sm text-ink whitespace-nowrap">{g.name}</div>
          <div className="text-xs text-ink3 mt-px">{since(g.checkIn)}</div>
        </>
      ),
    },
    { key: 'room', header: t('common:room'), render: (g) => <span className="text-[12.5px] font-medium text-ink" style={mono}>{g.room}</span> },
    { key: 'type', header: t('table.type'), render: (g) => <span className={`badge ${g.type === 'Monthly' ? 'badge-purple' : 'badge-blue'}`}>{typeLabel(g.type)}</span> },
    {
      key: 'tags', header: t('table.tags'),
      render: (g) => (
        <div className="flex gap-1 flex-wrap">
          {g.tags.length > 0 ? g.tags.map((tag) => <GuestTag key={tag} tag={tag} />) : <span className="text-ink3 text-xs">—</span>}
        </div>
      ),
    },
    { key: 'status', header: t('common:status'), render: (g) => <span className={`badge ${statusColor(g.status)}`}>{statusLabel(g.status)}</span> },
    {
      key: 'actions', header: '', actions: true, align: 'right',
      render: (g) => <button className="btn btn-outline btn-xs whitespace-nowrap" onClick={() => handleCheckout(g)}>{t('checkout')}</button>,
    },
  ]
  const checkoutColumns = [
    { key: 'name', header: t('common:guest'), render: (c) => <span className="t-sm text-ink">{c.name}</span> },
    { key: 'room', header: t('common:room'), render: (c) => <span className="text-[12.5px] font-medium text-ink" style={mono}>{c.room}</span> },
    { key: 'date', header: t('common:date'), render: (c) => <span className={`text-[12.5px] font-medium ${dateTone(c.date)}`}>{dateLabel(c.date)}</span> },
    {
      key: 'actions', header: '', actions: true, align: 'right',
      render: (c) => (
        <div className="flex gap-[5px] justify-end">
          <button className="btn btn-outline btn-xs" onClick={() => handleCheckout(c)}>{t('checkout')}</button>
          <button className="btn btn-outline btn-xs" onClick={() => handleExtend(c)}>{t('extend')}</button>
        </div>
      ),
    },
  ]

  usePageHeader({
    title: t('title'),
    subtitle: t('subtitle', { hotel: hotelName }),
    actions: [
      { id: 'shortcuts', label: t('shortcutsBtn'), icon: <LuKeyboard />, onClick: () => setShortcutsOpen(true) },
      { id: 'print', label: t('common:print'), icon: <LuPrinter />, variant: 'icon', onClick: handlePrint },
    ],
  })

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 sm:gap-[22px]">

      {/* ── Stats Row ── */}
      {/* 2-up on phones, 3-up on tablets, one row of six on wide screens. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-3.5">
        <StatCard icon={<LuBedDouble />} label={t('stats.totalRooms')} value={stats.total} color="gold" sub={t('stats.allInventory')} />

        <StatCard icon={<LuDoorOpen />} label={t('stats.available')} value={stats.available} color="green" sub={t('stats.pctOfTotal', { pct: availablePct })} progress={availablePct} />

        <StatCard icon={<LuUserCheck />} label={t('stats.occupied')} value={stats.occupied} color="red" sub={t('stats.pctOfTotal', { pct: occupiedPct })} progress={occupiedPct} />

        <StatCard icon={<LuWrench />} label={t('stats.maintenance')} value={stats.maintenance} color="amber" sub={t('stats.underService')} />

        <StatCard
          icon={<LuIndianRupee />}
          label={t('stats.monthlyRevenue')}
          value={formatCurrencyCompact(stats.revenue)}
          color="blue"
          sub={formatCurrency(stats.revenue)}
        />

        <StatCard
          icon={<LuChartPie />}
          label={t('stats.occupancyRate')}
          value={`${stats.occupancyRate}%`}
          color="purple"
          sub={t('stats.thisMonth')}
        />
      </div>

      {/* ── Mid Row: Charts + Notifications ── */}
      <div className="dash-mid-grid">
        {/* Left: Charts */}
        <div className="flex flex-col gap-4">

          {/* Revenue Bar Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('charts.monthlyRevenue')}</span>
              <span className="text-xs text-ink3">{t('charts.last6Months')}</span>
            </div>
            <div className="card-body pt-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={revenueData}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrencyCompact(v)}
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={
                      <DarkTooltip formatter={(v) => formatCurrency(v)} />
                    }
                    cursor={{ fill: 'rgba(201,168,76,0.06)' }}
                  />
                  <Bar dataKey="amount" fill="#c9a84c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Occupancy Trend Line Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('charts.occupancyTrend')}</span>
              <span className="text-xs text-ink3">{t('charts.last6Months')}</span>
            </div>
            <div className="card-body pt-2">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart
                  data={occupancyData}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    content={
                      <DarkTooltip formatter={(v) => `${v}%`} />
                    }
                    cursor={{ stroke: 'rgba(201,168,76,0.2)', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#c9a84c"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#c9a84c', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#c9a84c', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Notifications + Room Type Occupancy */}
        <div className="flex flex-col gap-4">

          {/* Notifications */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('common:notifications')}</span>
              <span className="text-xs font-semibold text-gold bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-[20px] px-2 py-0.5">
                {t('newCount', { count: mockNotifs.length })}
              </span>
            </div>
            <div className="card-body flex flex-col gap-2 pt-3.5">
              {mockNotifs.map((n) => (
                <div key={n.id} className={`notif notif-${n.type}`}>
                  <span
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      n.type === 'warn'    ? 'bg-warning-bg text-warning-text' :
                      n.type === 'info'    ? 'bg-info-bg text-info-text'       :
                      n.type === 'success' ? 'bg-success-bg text-success-text' :
                                             'bg-danger-bg text-danger-text'
                    }`}
                  >
                    {n.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink leading-[1.4]">
                      {t(n.msg, n.params)}
                    </div>
                    <div className="text-xs text-ink3 mt-0.5">
                      {n.hoursAgo == null ? t('common:yesterday') : t('hoursAgo', { count: n.hoursAgo })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Occupancy by Room Type */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('occupancyByType')}</span>
            </div>
            <div className="card-body flex flex-col gap-3.5">
              {mockRoomTypes.map((rt) => {
                const pct = Math.round((rt.occupied / rt.total) * 100)
                const barColor =
                  pct >= 80 ? 'var(--red)'   :
                  pct >= 50 ? 'var(--amber)'  :
                               'var(--green)'
                return (
                  <div key={rt.label}>
                    <div className="flex justify-between items-center mb-[5px]">
                      <span className="text-[12.5px] text-ink font-medium">
                        {rt.label}
                      </span>
                      <span className="text-xs text-ink3">
                        {rt.occupied}/{rt.total} &nbsp;
                        <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
                      </span>
                    </div>
                    <div className="prog-bar">
                      <div
                        className="prog-fill"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Tables ── */}
      <div className="dash-bottom-grid">
        {/* Recent Check-Ins */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('recentCheckIns')}</span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => setActivePanel('guests')}
            >
              {t('common:viewAll')}
            </button>
          </div>
          {/* Phones get stacked cards (DataTable); the checkout button sits in the card footer. */}
          <DataTable tableFrom="sm" columns={guestColumns} rows={mockGuests} />
        </div>

        {/* Upcoming Checkouts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t('upcomingCheckouts')}</span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => setActivePanel('rooms')}
            >
              {t('common:viewAll')}
            </button>
          </div>
          <DataTable tableFrom="sm" columns={checkoutColumns} rows={mockCheckouts} rowKey={(c) => `${c.room}-${c.name}`} />
        </div>
      </div>

      {/* ── Today's Timeline ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('timeline.title')}</span>
          <span className="text-xs text-ink3">
            {t('timeline.doneCount', { done: todayTimeline.filter((e) => e.done).length, total: todayTimeline.length })}
          </span>
        </div>
        <div className="pt-2 px-4 pb-4 relative">
          {/* Vertical line */}
          <div className="absolute left-[74px] top-2 bottom-2 w-px bg-line" />
          {todayTimeline.map((item, i) => {
            const colors = TIMELINE_COLORS[item.type] || TIMELINE_COLORS.audit
            return (
              <div key={i} className="flex gap-3.5 mb-3 items-start relative">
                {/* Time */}
                <div className="w-[38px] shrink-0 text-right text-xs font-semibold text-ink3 pt-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {item.time}
                </div>
                {/* Dot */}
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 mt-[5px] z-[1] flex items-center justify-center"
                  style={{
                    background: item.done ? colors.bg : 'var(--surface)',
                    border: `2px solid ${item.done ? colors.text : 'var(--border)'}`,
                  }}
                />
                {/* Event */}
                <div
                  className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-[7px] transition-all duration-[150ms] ${item.done ? 'opacity-[0.65]' : 'opacity-100'}`}
                  style={{
                    background: item.done ? 'var(--surface2)' : colors.bg,
                    border: `1px solid ${item.done ? 'var(--border)' : colors.text + '33'}`,
                  }}
                >
                  <div className="flex items-start gap-[7px]">
                    <span className="t-sm shrink-0">{item.icon}</span>
                    <span
                      className={`text-[13px] min-w-0 ${item.done ? 'font-normal line-through' : 'font-semibold no-underline'}`}
                      style={{ color: item.done ? 'var(--text3)' : colors.text }}
                    >{t(item.event, item.params)}</span>
                    {item.done && <span className="ml-auto text-xs text-success-text font-semibold shrink-0">✓</span>}
                    {!item.done && item.type === 'urgent' && <span className="ml-auto shrink-0 text-xs bg-danger-bg text-danger-text px-1.5 py-0.5 rounded-md font-bold">{t('timeline.urgent')}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Shortcuts Modal ── */}
      <Modal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title={t('shortcuts.title')}
        maxWidth="440px"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-2.5 py-2 rounded-md bg-surface2 border border-line"
            >
              <span className="text-[13px] text-ink2">{t(s.labelKey)}</span>
              <kbd className="kbd">{s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink3 text-center">
          {t('shortcuts.hint')}
        </p>
      </Modal>
    </div>
  )
}
