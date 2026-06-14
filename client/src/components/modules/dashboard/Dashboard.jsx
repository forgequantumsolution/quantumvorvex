import { useState } from 'react'
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
import { useAppSelector, useUiActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatCurrencyCompact, statusColor } from '../../../utils/format'
import StatCard from '../../ui/StatCard'
import Modal from '../../ui/Modal'

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

const mockCheckouts = [
  { name: 'Sneha Rao',    room: '118', date: 'Today' },
  { name: 'Arjun Patel',  room: '312', date: 'Tomorrow' },
  { name: 'Vijay Kumar',  room: '221', date: 'Apr 8' },
]

const mockRevenue = [
  { month: 'Nov', amount: 120000 },
  { month: 'Dec', amount: 145000 },
  { month: 'Jan', amount: 98000 },
  { month: 'Feb', amount: 165000 },
  { month: 'Mar', amount: 152000 },
  { month: 'Apr', amount: 180000 },
]

const mockOccupancy = [
  { month: 'Nov', rate: 62 },
  { month: 'Dec', rate: 71 },
  { month: 'Jan', rate: 54 },
  { month: 'Feb', rate: 80 },
  { month: 'Mar', rate: 73 },
  { month: 'Apr', rate: 75 },
]

const mockNotifs = [
  { id: 1, type: 'warn',    icon: '⚠', msg: 'Room 312 payment due in 3 days',              time: '2 hrs ago' },
  { id: 2, type: 'info',    icon: 'ℹ', msg: 'Room 207 maintenance scheduled tomorrow',      time: '4 hrs ago' },
  { id: 3, type: 'success', icon: '✓', msg: 'New check-in: Room 405 — Kavita Joshi',        time: '6 hrs ago' },
  { id: 4, type: 'danger',  icon: '!', msg: 'ID verification pending for Room 110',          time: 'Yesterday' },
]

const todayTimeline = [
  { time: '07:30', event: 'Housekeeping shift started',        type: 'hk',      icon: '🧹', done: true  },
  { time: '09:15', event: 'Anjali Singh checked in — Room 103', type: 'checkin', icon: '↗',  done: true  },
  { time: '11:00', event: 'INV-002 — Priya Patel paid ₹9,016', type: 'billing', icon: '◑',  done: true  },
  { time: '12:00', event: 'Sneha Rao checkout due — Room 118',  type: 'urgent',  icon: '⚠',  done: false },
  { time: '14:00', event: 'Farhan Ahmed arriving — Room 201',   type: 'checkin', icon: '↗',  done: false },
  { time: '16:00', event: 'Maintenance: Room 105 AC check',    type: 'maint',   icon: '🔧', done: false },
  { time: '20:00', event: 'Night Audit due',                   type: 'audit',   icon: '🌙', done: false },
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
const SHORTCUTS = [
  { key: 'D', label: 'Dashboard' },
  { key: 'R', label: 'Rooms' },
  { key: 'F', label: 'Floor Plan' },
  { key: 'T', label: 'Reports' },
  { key: 'C', label: 'Check-In' },
  { key: 'G', label: 'Guests' },
  { key: 'B', label: 'Billing' },
  { key: 'S', label: 'Settings' },
  { key: 'M', label: 'Toggle Dark Mode' },
  { key: 'Esc', label: 'Close modal' },
  { key: '?', label: 'Open shortcuts' },
]

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const hotelName    = useAppSelector((s) => s.hotel.hotelName)
  const { setActivePanel } = useUiActions()
  const addToast     = useToast()

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const stats = mockStats

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleCheckout(guest) {
    addToast(`Checkout initiated for ${guest.name} — Room ${guest.room}`, 'success')
  }

  function handleExtend(guest) {
    addToast(`Stay extended for ${guest.name} — Room ${guest.room}`, 'info')
  }

  function handlePrint() {
    window.print()
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const availablePct    = Math.round((stats.available   / stats.total) * 100)
  const occupiedPct     = Math.round((stats.occupied    / stats.total) * 100)

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-[22px]">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="t-h1 tracking-[-0.03em] m-0 leading-[1.2]"
          >
            Dashboard
          </h1>
          <p
            className="t-sm text-ink3 mt-[3px] mx-0 mb-0"
          >
            {hotelName} — Overview
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShortcutsOpen(true)}
          >
            ⌨ Shortcuts
          </button>
          <button
            className="btn btn-outline btn-sm no-print"
            onClick={handlePrint}
          >
            ⎙ Print
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-3.5">
        <StatCard label="Total Rooms" value={stats.total} color="gold" sub="All room inventory" />

        <StatCard label="Available" value={stats.available} color="green" sub={`${availablePct}% of total`}>
          <div className="prog-bar">
            <div
              className="prog-fill bg-success"
              style={{ width: `${availablePct}%` }}
            />
          </div>
        </StatCard>

        <StatCard label="Occupied" value={stats.occupied} color="red" sub={`${occupiedPct}% of total`}>
          <div className="prog-bar">
            <div
              className="prog-fill bg-danger"
              style={{ width: `${occupiedPct}%` }}
            />
          </div>
        </StatCard>

        <StatCard label="Maintenance" value={stats.maintenance} color="amber" sub="Under service" />

        <StatCard
          label="Monthly Revenue ₹"
          value={formatCurrencyCompact(stats.revenue)}
          color="blue"
          sub={formatCurrency(stats.revenue)}
        />

        <StatCard
          label="Occupancy Rate %"
          value={`${stats.occupancyRate}%`}
          color="purple"
          sub="This month"
        />
      </div>

      {/* ── Mid Row: Charts + Notifications ── */}
      <div className="dash-mid-grid">
        {/* Left: Charts */}
        <div className="flex flex-col gap-4">

          {/* Revenue Bar Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Monthly Revenue</span>
              <span className="text-[11.5px] text-ink3">Last 6 months</span>
            </div>
            <div className="card-body pt-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={mockRevenue}
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
              <span className="card-title">Occupancy Trend</span>
              <span className="text-[11.5px] text-ink3">Last 6 months</span>
            </div>
            <div className="card-body pt-2">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart
                  data={mockOccupancy}
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
              <span className="card-title">Notifications</span>
              <span className="text-[11px] font-semibold text-gold bg-[var(--gold-bg)] border border-[var(--gold-border)] rounded-[20px] px-2 py-0.5">
                {mockNotifs.length} new
              </span>
            </div>
            <div className="card-body flex flex-col gap-2 pt-3.5">
              {mockNotifs.map((n) => (
                <div key={n.id} className={`notif notif-${n.type}`}>
                  <span
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      n.type === 'warn'    ? 'bg-warning-bg text-warning-text' :
                      n.type === 'info'    ? 'bg-info-bg text-info-text'       :
                      n.type === 'success' ? 'bg-success-bg text-success-text' :
                                             'bg-danger-bg text-danger-text'
                    }`}
                  >
                    {n.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink leading-[1.4]">
                      {n.msg}
                    </div>
                    <div className="text-[11px] text-ink3 mt-0.5">
                      {n.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Occupancy by Room Type */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Occupancy by Room Type</span>
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
                      <span className="text-[11.5px] text-ink3">
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
            <span className="card-title">Recent Check-Ins</span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => setActivePanel('guests')}
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mockGuests.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="t-sm text-ink whitespace-nowrap">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-ink3 mt-px">
                        Since {g.checkIn}
                      </div>
                    </td>
                    <td>
                      <span
                        className="text-[12.5px] font-medium text-ink"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {g.room}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${g.type === 'Monthly' ? 'badge-purple' : 'badge-blue'}`}
                      >
                        {g.type}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {g.tags.length > 0
                          ? g.tags.map((t) => <GuestTag key={t} tag={t} />)
                          : <span className="text-ink3 text-[11px]">—</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusColor(g.status)}`}>{g.status}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-xs whitespace-nowrap"
                        onClick={() => handleCheckout(g)}
                      >
                        Checkout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Checkouts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming Checkouts</span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => setActivePanel('rooms')}
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mockCheckouts.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <span className="t-sm text-ink">
                        {c.name}
                      </span>
                    </td>
                    <td>
                      <span
                        className="text-[12.5px] font-medium text-ink"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {c.room}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`text-[12.5px] font-medium ${
                          c.date === 'Today'    ? 'text-danger-text'  :
                          c.date === 'Tomorrow' ? 'text-warning-text' :
                                                  'text-ink2'
                        }`}
                      >
                        {c.date}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-[5px]">
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleCheckout(c)}
                        >
                          Checkout
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleExtend(c)}
                        >
                          Extend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Today's Timeline ── */}
      <div className="card mt-5">
        <div className="card-header">
          <span className="card-title">Today's Timeline</span>
          <span className="text-[11.5px] text-ink3">
            {todayTimeline.filter(t => t.done).length}/{todayTimeline.length} events done
          </span>
        </div>
        <div className="pt-2 px-4 pb-4 relative">
          {/* Vertical line */}
          <div className="absolute left-10 top-2 bottom-2 w-px bg-line" />
          {todayTimeline.map((item, i) => {
            const colors = TIMELINE_COLORS[item.type] || TIMELINE_COLORS.audit
            return (
              <div key={i} className="flex gap-3.5 mb-3 items-start relative">
                {/* Time */}
                <div className="w-[34px] shrink-0 text-right text-[10.5px] font-semibold text-ink3 pt-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
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
                  className={`flex-1 px-2.5 py-1.5 rounded-[7px] transition-all duration-[150ms] ${item.done ? 'opacity-[0.65]' : 'opacity-100'}`}
                  style={{
                    background: item.done ? 'var(--surface2)' : colors.bg,
                    border: `1px solid ${item.done ? 'var(--border)' : colors.text + '33'}`,
                  }}
                >
                  <div className="flex items-center gap-[7px]">
                    <span className="t-sm">{item.icon}</span>
                    <span
                      className={`text-[12.5px] ${item.done ? 'font-normal line-through' : 'font-semibold no-underline'}`}
                      style={{ color: item.done ? 'var(--text3)' : colors.text }}
                    >{item.event}</span>
                    {item.done && <span className="ml-auto text-[11px] text-success-text font-semibold">✓</span>}
                    {!item.done && item.type === 'urgent' && <span className="ml-auto text-[10px] bg-danger-bg text-danger-text px-1.5 py-0.5 rounded-md font-bold">URGENT</span>}
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
        title="Keyboard Shortcuts"
        maxWidth="440px"
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-2.5 py-2 rounded-md bg-surface2 border border-line"
            >
              <span className="text-[12.5px] text-ink2">{s.label}</span>
              <kbd className="kbd">{s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] text-ink3 text-center">
          Shortcuts only fire when not focused on an input field.
        </p>
      </Modal>
    </div>
  )
}
