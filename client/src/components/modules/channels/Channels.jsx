import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_CHANNELS = [
  { id: '1', name: 'Booking.com',    color: '#003580', bookings: 12, revenue: 48000,  avgRate: 1200, status: 'Manual'       },
  { id: '2', name: 'MakeMyTrip',     color: '#d5001c', bookings: 8,  revenue: 32000,  avgRate: 1000, status: 'Manual'       },
  { id: '3', name: 'Goibibo',        color: '#e8175d', bookings: 5,  revenue: 18500,  avgRate: 925,  status: 'Manual'       },
  { id: '4', name: 'Airbnb',         color: '#ff5a5f', bookings: 3,  revenue: 15000,  avgRate: 1500, status: 'Disconnected' },
  { id: '5', name: 'Direct Website', color: '#c9a84c', bookings: 20, revenue: 85000,  avgRate: 1275, status: 'Connected'    },
  { id: '6', name: 'Walk-in',        color: '#16a34a', bookings: 35, revenue: 140000, avgRate: 875,  status: 'Connected'    },
]

const RATE_PARITY = [
  { type: 'Single', yourRate: 500,  bookingCom: 580,  mmtRate: 540,  goibibo: 520  },
  { type: 'Double', yourRate: 800,  bookingCom: 900,  mmtRate: 850,  goibibo: 820  },
  { type: 'Suite',  yourRate: 1500, bookingCom: 1600, mmtRate: 1550, goibibo: 1480 },
  { type: 'Deluxe', yourRate: 1200, bookingCom: 1350, mmtRate: 1280, goibibo: 1200 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (status === 'Connected')    return 'green'
  if (status === 'Manual')       return 'amber'
  if (status === 'Disconnected') return 'grey'
  return 'grey'
}

function getParityStatus(row) {
  const competitors = [row.bookingCom, row.mmtRate, row.goibibo]
  const allHigher = competitors.every(c => row.yourRate < c)
  const anyHigher = competitors.some(c => row.yourRate > c)
  if (allHigher) return { label: '✓ You\'re cheapest', type: 'green' }
  if (anyHigher) return { label: '⚠ Parity Issue',    type: 'amber' }
  return { label: '✓ Parity', type: 'green' }
}

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────
function RateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="t-xs bg-surface border border-line rounded-lg px-[14px] py-2.5">
      <p className="mb-1.5 font-bold text-ink">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="my-0.5" style={{ color: p.color }}>
          {p.name}: ₹{p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ channels }) {
  const addToast = useToast()
  const totalBookings = channels.reduce((a, c) => a + c.bookings, 0)
  const totalRevenue  = channels.reduce((a, c) => a + c.revenue,  0)
  const connectedCount = channels.filter(c => c.status === 'Connected').length

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[14px] mb-6">
        {[
          { label: 'Total Bookings',     value: totalBookings,               sub: 'This month' },
          { label: 'Total Revenue',      value: formatCurrency(totalRevenue), sub: 'This month' },
          { label: 'Channels Connected', value: connectedCount,              sub: `of ${channels.length} channels` },
        ].map(card => (
          <div key={card.label} className="stat-card py-4 px-[18px]">
            <div className="t-label text-ink3 tracking-[0.06em] mb-1">
              {card.label}
            </div>
            <div className="t-h1 text-ink tracking-[-0.02em]">
              {card.value}
            </div>
            <div className="text-[11px] text-ink3 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]">
        {channels.map(ch => (
          <div key={ch.id} className="card p-0 overflow-hidden" style={{
            borderLeft: `4px solid ${ch.color}`,
          }}>
            <div className="py-[14px] px-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="t-title text-ink">
                  {ch.name}
                </span>
                <Badge type={statusBadge(ch.status)}>{ch.status}</Badge>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-1.5 mb-3">
                {[
                  { label: 'Bookings', value: ch.bookings },
                  { label: 'Revenue',  value: formatCurrency(ch.revenue) },
                  { label: 'Avg Rate', value: `₹${ch.avgRate.toLocaleString('en-IN')}` },
                ].map(stat => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-[11px] text-ink3">{stat.label}</span>
                    <span className="text-[12px] font-semibold text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-line pt-2.5">
                {ch.status === 'Connected' ? (
                  <button
                    className="btn btn-outline btn-xs w-full"
                    onClick={() => addToast({ type: 'info', message: `API configuration for ${ch.name} coming soon.` })}
                  >
                    Configure API
                  </button>
                ) : (
                  <label className="t-xs flex items-center gap-[7px] cursor-pointer text-ink2">
                    <input
                      type="checkbox"
                      defaultChecked={ch.status === 'Manual'}
                      onChange={() => addToast({ type: 'success', message: `${ch.name} marked as Manual.` })}
                    />
                    Mark as Manual
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Rate Parity Tab ──────────────────────────────────────────────────────────
function RateParityTab() {
  const [rows, setRows] = useState(RATE_PARITY)
  const [editingCell, setEditingCell] = useState(null) // { rowIndex, field }
  const addToast = useToast()

  function handleCellClick(rowIndex, field) {
    setEditingCell({ rowIndex, field })
  }

  function handleCellBlur(rowIndex, field, val) {
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 0) {
      setRows(r => r.map((row, i) => i === rowIndex ? { ...row, [field]: num } : row))
    }
    setEditingCell(null)
  }

  const barData = rows.map(r => ({
    name:        r.type,
    'Your Rate': r.yourRate,
    'Booking.com': r.bookingCom,
    'MakeMyTrip':  r.mmtRate,
  }))

  return (
    <div>
      <p className="t-sm mb-4 text-ink2">
        Compare your rates vs OTA platforms. Click competitor cells to edit inline.
      </p>

      {/* Table */}
      <div className="overflow-x-auto mb-[28px]">
        <table>
          <thead>
            <tr>
              <th>Room Type</th>
              <th>Your Rate ₹</th>
              <th>Booking.com ₹</th>
              <th>MakeMyTrip ₹</th>
              <th>Goibibo ₹</th>
              <th>Parity Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const parity = getParityStatus(row)
              return (
                <tr key={row.type}>
                  <td className="font-semibold">{row.type}</td>
                  <td className="font-bold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{row.yourRate.toLocaleString('en-IN')}
                  </td>
                  {[
                    { field: 'bookingCom', val: row.bookingCom },
                    { field: 'mmtRate',    val: row.mmtRate    },
                    { field: 'goibibo',    val: row.goibibo    },
                  ].map(({ field, val }) => {
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === field
                    return (
                      <td key={field} onClick={() => handleCellClick(rowIndex, field)}
                        className="cursor-pointer" style={{ fontFamily: 'var(--font-mono)' }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            defaultValue={val}
                            className="form-input w-[90px] py-[3px] px-[7px] text-[12px]"
                            style={{ fontFamily: 'var(--font-mono)' }}
                            onBlur={e => handleCellBlur(rowIndex, field, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.target.blur()
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                          />
                        ) : (
                          <span className="py-0.5 px-1 rounded" style={{
                            color: val > row.yourRate ? 'var(--text2)' : 'var(--red-text)',
                          }}>
                            ₹{val.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td>
                    <Badge type={parity.type}>{parity.label}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bar Chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Rate Comparison Chart</span>
        </div>
        <div className="card-body pt-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <Tooltip content={<RateTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Your Rate"   fill="#c9a84c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Booking.com" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="MakeMyTrip"  fill="#d5001c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────
const CSV_SYSTEM_FIELDS = ['Guest Name', 'Room Number', 'Check-in Date', 'Check-out Date', 'Amount', 'Channel']
const CSV_MOCK_COLUMNS  = ['guest_name', 'room_no', 'checkin', 'checkout', 'total_amount', 'source']
const CSV_PREVIEW_ROWS  = [
  ['Rahul Sharma',  '102', '2026-04-01', '2026-04-05', '4800', 'Booking.com'],
  ['Priya Patel',   '205', '2026-04-03', '2026-04-07', '3200', 'MakeMyTrip'],
  ['Ankit Verma',   '301', '2026-04-04', '2026-04-06', '1850', 'Goibibo'],
  ['Sneha Rao',     '104', '2026-04-05', '2026-04-08', '3600', 'Direct Website'],
  ['Vijay Kumar',   '212', '2026-04-06', '2026-04-09', '2625', 'Walk-in'],
]

function ImportTab() {
  const addToast = useToast()
  const [mapping, setMapping] = useState(
    Object.fromEntries(CSV_SYSTEM_FIELDS.map((f, i) => [f, CSV_MOCK_COLUMNS[i]]))
  )
  const [isDragging, setIsDragging] = useState(false)
  const [fileUploaded, setFileUploaded] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      setFileUploaded(true)
      addToast({ type: 'success', message: `File "${file.name}" loaded.` })
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) {
      setFileUploaded(true)
      addToast({ type: 'success', message: `File "${file.name}" loaded.` })
    }
  }

  function handleImport() {
    addToast({ type: 'success', message: '6 bookings imported successfully.' })
  }

  function handleDownloadTemplate() {
    addToast({ type: 'info', message: 'Template CSV download started.' })
    const header = CSV_MOCK_COLUMNS.join(',')
    const sample = CSV_PREVIEW_ROWS.map(r => r.join(',')).join('\n')
    const blob = new Blob([header + '\n' + sample], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'channel-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-[700px]">
      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-[10px] py-10 px-5 text-center transition-all duration-[180ms] mb-5 cursor-pointer relative ${isDragging ? 'border-gold bg-[var(--gold-bg)]' : 'border-line bg-surface2'}`}
        onClick={() => document.getElementById('csv-file-input').click()}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="text-[36px] mb-2">☁</div>
        <p className="t-title mb-1 text-ink">
          {fileUploaded ? '✓ File loaded — ready to map columns' : 'Drop your CSV file here, or click to browse'}
        </p>
        <p className="t-xs m-0 text-ink3">
          Supports .csv files · Max 5 MB
        </p>
      </div>

      {/* Download template */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-outline btn-sm" onClick={handleDownloadTemplate}>
          Download Template CSV
        </button>
        <span className="t-xs text-ink3">
          Use this template to format your booking data correctly before importing.
        </span>
      </div>

      {/* Column Mapping */}
      <div className="card mb-5">
        <div className="card-header">
          <span className="card-title">Column Mapping</span>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>System Field</th>
                <th>Your CSV Column</th>
              </tr>
            </thead>
            <tbody>
              {CSV_SYSTEM_FIELDS.map(field => (
                <tr key={field}>
                  <td className="t-title">{field}</td>
                  <td>
                    <select
                      className="form-select t-xs"
                      value={mapping[field]}
                      onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                    >
                      {CSV_MOCK_COLUMNS.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Preview */}
      <div className="card mb-5">
        <div className="card-header">
          <span className="card-title">CSV Preview (5 rows)</span>
        </div>
        <div className="card-body overflow-x-auto">
          <table>
            <thead>
              <tr>
                {CSV_MOCK_COLUMNS.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {CSV_PREVIEW_ROWS.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="t-xs" style={{ fontFamily: j === 4 ? 'monospace' : 'inherit' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleImport}>
        Import Bookings
      </button>
    </div>
  )
}

// ─── Revenue by Source Tab ────────────────────────────────────────────────────
function RevenueBySourceTab({ channels }) {
  const totalRevenue  = channels.reduce((a, c) => a + c.revenue,  0)
  const totalBookings = channels.reduce((a, c) => a + c.bookings, 0)

  const pieData = channels.map(ch => ({
    name:    ch.name,
    value:   ch.revenue,
    color:   ch.color,
  }))

  // Custom Pie tooltip
  function PieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div className="t-xs bg-surface border border-line rounded-lg py-[9px] px-[13px]">
        <p className="m-0 font-bold text-ink">{d.name}</p>
        <p className="mt-[3px] text-ink2">
          {formatCurrency(d.value)} ({((d.value / totalRevenue) * 100).toFixed(1)}%)
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Pie Chart */}
      <div className="card mb-5">
        <div className="card-header">
          <span className="card-title">Revenue by Channel</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={3}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-[18px] gap-y-2 justify-center mt-3">
            {channels.map(ch => (
              <div key={ch.id} className="t-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: ch.color }} />
                <span className="text-ink2">{ch.name}</span>
                <span className="font-semibold text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(ch.revenue)}
                </span>
                <span className="text-ink3">
                  ({((ch.revenue / totalRevenue) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Bookings</th>
              <th>Revenue ₹</th>
              <th>Avg Stay ₹</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {channels
              .slice()
              .sort((a, b) => b.revenue - a.revenue)
              .map(ch => (
                <tr key={ch.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: ch.color }} />
                      <span className="t-title">{ch.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{ch.bookings}</td>
                  <td className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(ch.revenue)}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(ch.avgRate)}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-[60px] h-1.5 rounded-[3px] bg-line overflow-hidden">
                        <div
                          className="h-full rounded-[3px]"
                          style={{
                            width: `${(ch.revenue / totalRevenue) * 100}%`,
                            background: ch.color,
                          }}
                        />
                      </div>
                      <span className="text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {((ch.revenue / totalRevenue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

            {/* Totals row */}
            <tr className="border-t-2 border-line font-bold">
              <td>Total</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{totalBookings}</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(totalRevenue)}</td>
              <td className="text-ink3" style={{ fontFamily: 'var(--font-mono)' }}>—</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Channels() {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview',  label: 'Overview'          },
    { id: 'parity',    label: 'Rate Parity'        },
    { id: 'import',    label: 'Import'             },
    { id: 'revenue',   label: 'Revenue by Source'  },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="t-h1 m-0 text-ink tracking-[-0.02em]">
          🔗 Booking Channels
        </h1>
        <p className="t-sm mt-[3px] text-ink3">
          Manage OTA and direct bookings
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="overview">
          <OverviewTab channels={MOCK_CHANNELS} />
        </div>
        <div data-tab-id="parity">
          <RateParityTab />
        </div>
        <div data-tab-id="import">
          <ImportTab />
        </div>
        <div data-tab-id="revenue">
          <RevenueBySourceTab channels={MOCK_CHANNELS} />
        </div>
      </Tabs>
    </div>
  )
}
