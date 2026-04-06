import { useState } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const revenueData30 = Array.from({ length: 30 }, (_, i) => ({
  date: `Apr ${i + 1}`,
  rent: 2000 + Math.floor(Math.random() * 2000),
  food: 600 + Math.floor(Math.random() * 600),
  amenities: [0, 400, 800][Math.floor(Math.random() * 3)],
}))

const occupancyData = Array.from({ length: 30 }, (_, i) => ({
  date: `Apr ${i + 1}`,
  rate: 55 + Math.floor(Math.random() * 40),
}))

const monthlyRevenue = [
  { month: 'Nov', rent: 85000,  food: 28000, amenities: 12000, total: 125000 },
  { month: 'Dec', rent: 102000, food: 33000, amenities: 13000, total: 148000 },
  { month: 'Jan', rent: 68000,  food: 22000, amenities: 12000, total: 102000 },
  { month: 'Feb', rent: 118000, food: 36000, amenities: 14000, total: 168000 },
  { month: 'Mar', rent: 108000, food: 34000, amenities: 16000, total: 158000 },
  { month: 'Apr', rent: 124000, food: 38000, amenities: 18000, total: 180000 },
]

const gstData = [
  { invoiceNo: 'INV-001', guest: 'Rahul Sharma',  period: 'Mar 2026',      taxable: 12300, cgst: 738,  sgst: 738,  igst: 0, total: 13776 },
  { invoiceNo: 'INV-003', guest: 'Ankit Singh',   period: 'Mar 2026',      taxable: 15200, cgst: 912,  sgst: 912,  igst: 0, total: 17024 },
  { invoiceNo: 'INV-005', guest: 'Vijay Kumar',   period: 'Feb–Mar 2026',  taxable: 27400, cgst: 1644, sgst: 1644, igst: 0, total: 30688 },
]

const roomTypeOccupancy = [
  { type: 'Single',  total: 12, occupied: 9  },
  { type: 'Double',  total: 10, occupied: 7  },
  { type: 'Suite',   total: 6,  occupied: 3  },
  { type: 'Deluxe',  total: 4,  occupied: 4  },
]

// Simplified heatmap: 7 days × 4 room types
const heatmapDays = ['Apr 1', 'Apr 2', 'Apr 3', 'Apr 4', 'Apr 5', 'Apr 6', 'Apr 7']
const heatmapTypes = ['Single', 'Double', 'Suite', 'Deluxe']
const heatmapData = heatmapDays.map(day => ({
  day,
  values: heatmapTypes.map(() => 50 + Math.floor(Math.random() * 50)),
}))

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#fff',
        minWidth: 120,
      }}
    >
      <div style={{ color: '#888', marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span style={{ fontWeight: 600 }}>
            {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function MiniStat({ label, value, accent = '#c9a84c' }) {
  return (
    <div
      className="stat-card"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
        {value}
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const totalRev = revenueData30.reduce((s, d) => s + d.rent + d.food + d.amenities, 0)
  const avgOcc = Math.round(occupancyData.reduce((s, d) => s + d.rate, 0) / occupancyData.length)

  const lineData = revenueData30.map(d => ({
    date: d.date,
    revenue: d.rent + d.food + d.amenities,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <MiniStat label="Total Revenue MTD" value={formatCurrencyCompact(totalRev)} accent="#c9a84c" />
        <MiniStat label="Avg Daily Occupancy" value={`${avgOcc}%`} accent="#3b82f6" />
        <MiniStat label="New Guests MTD" value="28" accent="#22c55e" />
      </div>

      {/* Revenue Trend */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Revenue Trend — April 2026</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<DarkTooltip prefix="₹" />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#c9a84c"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#c9a84c' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Occupancy Area Chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Occupancy Rate % — April 2026</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={occupancyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#c9a84c"
                strokeWidth={2}
                fill="#c9a84c"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab() {
  const last7 = revenueData30.slice(0, 7)
  const totalRent      = monthlyRevenue.reduce((s, m) => s + m.rent, 0)
  const totalFood      = monthlyRevenue.reduce((s, m) => s + m.food, 0)
  const totalAmenities = monthlyRevenue.reduce((s, m) => s + m.amenities, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <MiniStat label="Rent Revenue (6 Mo)" value={formatCurrencyCompact(totalRent)} accent="#c9a84c" />
        <MiniStat label="Food Revenue (6 Mo)" value={formatCurrencyCompact(totalFood)} accent="#3b82f6" />
        <MiniStat label="Amenities Revenue (6 Mo)" value={formatCurrencyCompact(totalAmenities)} accent="#a855f7" />
      </div>

      {/* Stacked Bar — last 7 days */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Revenue Breakdown — Last 7 Days</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<DarkTooltip prefix="₹" />} />
              <Bar dataKey="rent"      name="Rent"       stackId="a" fill="#c9a84c" />
              <Bar dataKey="food"      name="Food"       stackId="a" fill="#3b82f6" />
              <Bar dataKey="amenities" name="Amenities"  stackId="a" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Revenue Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Monthly Revenue Summary</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Month', 'Rent ₹', 'Food ₹', 'Amenities ₹', 'Total ₹', 'Change'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '8px 12px',
                    borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyRevenue.map((row, i) => {
                const prev = monthlyRevenue[i - 1]
                const pct = prev ? (((row.total - prev.total) / prev.total) * 100).toFixed(1) : null
                const up = pct !== null && Number(pct) >= 0
                return (
                  <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.month}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(row.rent)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(row.food)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(row.amenities)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>
                      {formatCurrency(row.total)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {pct === null ? (
                        <span style={{ color: 'var(--text3)' }}>—</span>
                      ) : (
                        <span style={{ color: up ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                          {up ? '▲' : '▼'} {Math.abs(pct)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Occupancy Tab ────────────────────────────────────────────────────────────
function OccupancyTab() {
  const last7Occ = occupancyData.slice(0, 7)

  function rateColor(rate) {
    if (rate >= 80) return '#22c55e'
    if (rate >= 50) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Bar chart — 7 days */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Occupancy Rate — Last 7 Days</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7Occ} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false}
                domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="rate" name="Occupancy %" fill="#c9a84c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Room type occupancy table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Occupancy by Room Type</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Room Type', 'Total Rooms', 'Occupied', 'Rate', 'Occupancy'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Room Type' ? 'left' : 'center', padding: '8px 12px',
                    borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypeOccupancy.map(row => {
                const rate = Math.round((row.occupied / row.total) * 100)
                const color = rateColor(rate)
                return (
                  <tr key={row.type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.type}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.total}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.occupied}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color }}>{rate}%</td>
                    <td style={{ padding: '10px 12px', minWidth: 120 }}>
                      <div className="prog-bar" style={{ height: 8, borderRadius: 4, background: 'var(--surface2)' }}>
                        <div
                          className="prog-fill"
                          style={{
                            height: '100%',
                            borderRadius: 4,
                            width: `${rate}%`,
                            background: color,
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Occupancy Heatmap — Apr 1–7</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text3)', fontSize: 11 }}>Day</th>
                {heatmapTypes.map(t => (
                  <th key={t} style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map(row => (
                <tr key={row.day}>
                  <td style={{ padding: '5px 10px', fontWeight: 600, fontSize: 12 }}>{row.day}</td>
                  {row.values.map((v, i) => {
                    const bg = v >= 80 ? '#166534' : v >= 50 ? '#78350f' : '#7f1d1d'
                    const fg = v >= 80 ? '#86efac' : v >= 50 ? '#fcd34d' : '#fca5a5'
                    return (
                      <td key={i} style={{
                        padding: '5px 10px',
                        textAlign: 'center',
                        background: bg,
                        color: fg,
                        fontWeight: 700,
                        borderRadius: 4,
                        fontSize: 12,
                        margin: 2,
                      }}>
                        {v}%
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── GST Tab ──────────────────────────────────────────────────────────────────
function GSTTab({ addToast }) {
  const totTaxable = gstData.reduce((s, r) => s + r.taxable, 0)
  const totCGST    = gstData.reduce((s, r) => s + r.cgst, 0)
  const totSGST    = gstData.reduce((s, r) => s + r.sgst, 0)
  const totGST     = totCGST + totSGST

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <MiniStat label="Total Taxable" value={formatCurrencyCompact(totTaxable)} accent="#6366f1" />
        <MiniStat label="Total CGST" value={formatCurrencyCompact(totCGST)} accent="#c9a84c" />
        <MiniStat label="Total SGST" value={formatCurrencyCompact(totSGST)} accent="#c9a84c" />
        <MiniStat label="Total GST" value={formatCurrencyCompact(totGST)} accent="#22c55e" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="card-title">GST Invoices</span>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => addToast('GST report exported', 'success')}
          >
            Export for CA
          </button>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Invoice #', 'Guest', 'Period', 'Taxable ₹', 'CGST ₹', 'SGST ₹', 'IGST ₹', 'Total ₹'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: h === 'Invoice #' || h === 'Guest' || h === 'Period' ? 'left' : 'right',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text3)',
                    fontWeight: 600,
                    fontSize: 12,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gstData.map(row => (
                <tr key={row.invoiceNo} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--gold)' }}>{row.invoiceNo}</td>
                  <td style={{ padding: '9px 12px' }}>{row.guest}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{row.period}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(row.taxable)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(row.cgst)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(row.sgst)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text3)' }}>{formatCurrency(row.igst)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
        GST Rate: 12% (CGST 6% + SGST 6%)
      </p>
    </div>
  )
}

// ─── Export Tab ───────────────────────────────────────────────────────────────
function ExportTab({ addToast }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')

  const exports = [
    { label: 'CSV — Guests',     desc: 'Guest registry with all details',    type: 'csv',  name: 'Guest Registry CSV' },
    { label: 'CSV — Billing',    desc: 'All invoices and payments',           type: 'csv',  name: 'Billing CSV' },
    { label: 'CSV — GST Report', desc: 'GST breakdown for CA filing',         type: 'csv',  name: 'GST Report CSV' },
    { label: 'PDF — Summary',    desc: 'Complete hotel summary report',       type: 'pdf',  name: 'Summary PDF' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date range */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Date Range</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <button
              className="btn btn-outline"
              onClick={() => addToast('Date range applied', 'info')}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Export cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {exports.map(exp => (
          <div key={exp.label} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{exp.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{exp.desc}</div>
              </div>
              <button
                className={`btn ${exp.type === 'pdf' ? 'btn-outline' : 'btn-primary'}`}
                style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 16px' }}
                onClick={() => addToast(`Exporting ${exp.name}...`, 'info')}
              >
                {exp.type === 'pdf' ? 'Export PDF' : 'Export CSV'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reports (Root) ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'revenue',    label: 'Revenue'    },
  { id: 'occupancy',  label: 'Occupancy'  },
  { id: 'gst',        label: 'GST'        },
  { id: 'export',     label: 'Export'     },
]

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview')
  const addToast = useToast()

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          margin: 0,
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}>
          Reports &amp; Analytics
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Financial insights, occupancy data, and GST summaries
        </p>
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="overview"><OverviewTab /></div>
        <div data-tab-id="revenue"><RevenueTab /></div>
        <div data-tab-id="occupancy"><OccupancyTab /></div>
        <div data-tab-id="gst"><GSTTab addToast={addToast} /></div>
        <div data-tab-id="export"><ExportTab addToast={addToast} /></div>
      </Tabs>
    </div>
  )
}
