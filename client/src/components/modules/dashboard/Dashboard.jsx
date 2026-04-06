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
import { useStore } from '../../../store/useStore'
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
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#fff',
      }}
    >
      <div style={{ color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: 'var(--gold)' }}>
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
  const hotelName    = useStore((s) => s.hotelName)
  const setActivePanel = useStore((s) => s.setActivePanel)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 21,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text3)',
              margin: '3px 0 0',
            }}
          >
            {hotelName} — Overview
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard label="Total Rooms" value={stats.total} color="gold" sub="All room inventory" />

        <StatCard label="Available" value={stats.available} color="green" sub={`${availablePct}% of total`}>
          <div className="prog-bar">
            <div
              className="prog-fill"
              style={{ width: `${availablePct}%`, background: 'var(--green)' }}
            />
          </div>
        </StatCard>

        <StatCard label="Occupied" value={stats.occupied} color="red" sub={`${occupiedPct}% of total`}>
          <div className="prog-bar">
            <div
              className="prog-fill"
              style={{ width: `${occupiedPct}%`, background: 'var(--red)' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Revenue Bar Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Monthly Revenue</span>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Last 6 months</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={mockRevenue}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'Inter' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrencyCompact(v)}
                    tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Inter' }}
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
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Last 6 months</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart
                  data={mockOccupancy}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'Inter' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Inter' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Notifications */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Notifications</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--gold)',
                  background: 'var(--gold-bg)',
                  border: '1px solid var(--gold-border)',
                  borderRadius: 20,
                  padding: '2px 8px',
                }}
              >
                {mockNotifs.length} new
              </span>
            </div>
            <div
              className="card-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14 }}
            >
              {mockNotifs.map((n) => (
                <div key={n.id} className={`notif notif-${n.type}`}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      background:
                        n.type === 'warn'    ? 'var(--amber-bg)'  :
                        n.type === 'info'    ? 'var(--blue-bg)'   :
                        n.type === 'success' ? 'var(--green-bg)'  :
                                               'var(--red-bg)',
                      color:
                        n.type === 'warn'    ? 'var(--amber-text)' :
                        n.type === 'info'    ? 'var(--blue-text)'  :
                        n.type === 'success' ? 'var(--green-text)' :
                                               'var(--red-text)',
                    }}
                  >
                    {n.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>
                      {n.msg}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
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
            <div
              className="card-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {mockRoomTypes.map((rt) => {
                const pct = Math.round((rt.occupied / rt.total) * 100)
                const barColor =
                  pct >= 80 ? 'var(--red)'   :
                  pct >= 50 ? 'var(--amber)'  :
                               'var(--green)'
                return (
                  <div key={rt.label}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
                        {rt.label}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                        {rt.occupied}/{rt.total} &nbsp;
                        <span style={{ color: barColor, fontWeight: 600 }}>{pct}%</span>
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
          <div style={{ overflowX: 'auto' }}>
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
                      <div
                        style={{
                          fontWeight: 500,
                          color: 'var(--text)',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {g.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                        Since {g.checkIn}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: 'var(--text)',
                        }}
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
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {g.tags.length > 0
                          ? g.tags.map((t) => <GuestTag key={t} tag={t} />)
                          : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusColor(g.status)}`}>{g.status}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => handleCheckout(g)}
                        style={{ whiteSpace: 'nowrap' }}
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
          <div style={{ overflowX: 'auto' }}>
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
                      <span
                        style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}
                      >
                        {c.name}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: 'var(--text)',
                        }}
                      >
                        {c.room}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color:
                            c.date === 'Today'    ? 'var(--red-text)'   :
                            c.date === 'Tomorrow' ? 'var(--amber-text)' :
                                                    'var(--text2)',
                        }}
                      >
                        {c.date}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
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
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Today's Timeline</span>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            {todayTimeline.filter(t => t.done).length}/{todayTimeline.length} events done
          </span>
        </div>
        <div style={{ padding: '8px 16px 16px', position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: 40, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
          {todayTimeline.map((item, i) => {
            const colors = TIMELINE_COLORS[item.type] || TIMELINE_COLORS.audit
            return (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'flex-start', position: 'relative' }}>
                {/* Time */}
                <div style={{ width: 34, flexShrink: 0, textAlign: 'right', fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", paddingTop: 6 }}>
                  {item.time}
                </div>
                {/* Dot */}
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  background: item.done ? colors.bg : 'var(--surface)',
                  border: `2px solid ${item.done ? colors.text : 'var(--border)'}`,
                  marginTop: 5, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} />
                {/* Event */}
                <div style={{
                  flex: 1, padding: '6px 10px', borderRadius: 7,
                  background: item.done ? 'var(--surface2)' : colors.bg,
                  border: `1px solid ${item.done ? 'var(--border)' : colors.text + '33'}`,
                  opacity: item.done ? 0.65 : 1,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    <span style={{
                      fontSize: 12.5, fontWeight: item.done ? 400 : 600,
                      color: item.done ? 'var(--text3)' : colors.text,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>{item.event}</span>
                    {item.done && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--green-text)', fontWeight: 600 }}>✓</span>}
                    {!item.done && item.type === 'urgent' && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--red-bg)', color: 'var(--red-text)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>URGENT</span>}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 20px',
          }}
        >
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{s.label}</span>
              <kbd className="kbd">{s.key}</kbd>
            </div>
          ))}
        </div>
        <p
          style={{
            marginTop: 16,
            fontSize: 11.5,
            color: 'var(--text3)',
            textAlign: 'center',
          }}
        >
          Shortcuts only fire when not focused on an input field.
        </p>
      </Modal>
    </div>
  )
}
