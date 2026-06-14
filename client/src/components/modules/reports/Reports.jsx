import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { reportsApi, roomsApi } from '../../../api/client'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="t-xs bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-white min-w-[120px]">
      <div className="text-[#888] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span className="font-semibold">
            {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function MiniStat({ label, value, accent = '#c9a84c' }) {
  return (
    <div className="stat-card border-t-[3px]" style={{ borderTopColor: accent }}>
      <div className="t-xs text-ink3 mb-1.5">{label}</div>
      <div className="t-h1">{value}</div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ dashboard, revenue }) {
  const byDay = (revenue?.byDay || []).map((d) => ({ date: d.date, revenue: d.revenue }))
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Revenue (paid invoices)" value={formatCurrencyCompact(dashboard?.revenue || 0)} accent="#c9a84c" />
        <MiniStat label="Occupancy Rate" value={`${dashboard?.occupancyRate ?? 0}%`} accent="#3b82f6" />
        <MiniStat label="Active Guests" value={(dashboard?.recentGuests?.length ?? 0)} accent="#22c55e" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Revenue by Day (paid invoices)</span></div>
        <div className="card-body">
          {byDay.length === 0 ? (
            <div className="empty-state h-[200px] flex items-center justify-center">
              <p className="t-sm m-0 text-ink3">No paid invoices yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<DarkTooltip prefix="₹" />} />
                <Line type="monotone" dataKey="revenue" stroke="#c9a84c" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#c9a84c' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab({ revenue }) {
  const byDay = revenue?.byDay || []
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <MiniStat label="Total Revenue" value={formatCurrencyCompact(revenue?.totalRevenue || 0)} accent="#c9a84c" />
        <MiniStat label="Paid Invoices" value={(revenue?.invoices?.length ?? 0)} accent="#3b82f6" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Revenue by Day</span></div>
        <div className="card-body">
          {byDay.length === 0 ? (
            <div className="empty-state h-[200px] flex items-center justify-center">
              <p className="t-sm m-0 text-ink3">No revenue recorded yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<DarkTooltip prefix="₹" />} />
                <Bar dataKey="revenue" name="Revenue" fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Occupancy Tab (computed from live rooms) ──────────────────────────────────
function OccupancyTab({ rooms }) {
  const byType = useMemo(() => {
    const map = {}
    for (const r of rooms) {
      const type = r.type?.name || 'Other'
      if (!map[type]) map[type] = { type, total: 0, occupied: 0 }
      map[type].total += 1
      if (r.status === 'occupied') map[type].occupied += 1
    }
    return Object.values(map)
  }, [rooms])

  const rateColor = (rate) => (rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444')

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Occupancy by Room Type</span></div>
      <div className="card-body overflow-x-auto">
        {byType.length === 0 ? (
          <div className="empty-state">No rooms found</div>
        ) : (
          <table className="t-sm w-full border-collapse">
            <thead>
              <tr>
                {['Room Type', 'Total Rooms', 'Occupied', 'Rate', 'Occupancy'].map(h => (
                  <th key={h} className={`t-xs px-3 py-2 border-b border-line text-ink3 font-semibold ${h === 'Room Type' ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byType.map(row => {
                const rate = row.total ? Math.round((row.occupied / row.total) * 100) : 0
                const color = rateColor(rate)
                return (
                  <tr key={row.type} className="border-b border-line">
                    <td className="px-3 py-2.5 font-semibold">{row.type}</td>
                    <td className="px-3 py-2.5 text-center">{row.total}</td>
                    <td className="px-3 py-2.5 text-center">{row.occupied}</td>
                    <td className="px-3 py-2.5 text-center font-bold" style={{ color }}>{rate}%</td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div className="prog-bar h-2 rounded bg-surface2">
                        <div className="prog-fill h-full rounded transition-[width] duration-[400ms] ease-[ease]" style={{ width: `${rate}%`, background: color }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── GST Tab ──────────────────────────────────────────────────────────────────
function GSTTab({ gst }) {
  const invoices = gst?.invoices || []
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-[14px]">
        <MiniStat label="Total Taxable" value={formatCurrencyCompact(gst?.totalTaxable || 0)} accent="#6366f1" />
        <MiniStat label="Total GST" value={formatCurrencyCompact(gst?.totalGst || 0)} accent="#c9a84c" />
        <MiniStat label="Total Amount" value={formatCurrencyCompact(gst?.totalAmount || 0)} accent="#22c55e" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">GST Invoices</span></div>
        <div className="card-body overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="empty-state">No invoices in this period</div>
          ) : (
            <table className="t-sm w-full border-collapse">
              <thead>
                <tr>
                  {['Invoice #', 'Guest', 'Period', 'Taxable ₹', 'CGST ₹', 'SGST ₹', 'Total ₹'].map(h => (
                    <th key={h} className={`t-xs px-3 py-2 border-b border-line text-ink3 font-semibold ${h === 'Invoice #' || h === 'Guest' || h === 'Period' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const taxable = inv.rent + inv.food + inv.amenities
                  const half = +(inv.gstAmount / 2).toFixed(2)
                  return (
                    <tr key={inv.id} className="border-b border-line">
                      <td className="px-3 py-[9px] font-semibold text-gold">{inv.invoiceNo}</td>
                      <td className="px-3 py-[9px]">{inv.guest?.name || '—'}</td>
                      <td className="px-3 py-[9px] text-ink3">{inv.period}</td>
                      <td className="px-3 py-[9px] text-right">{formatCurrency(taxable)}</td>
                      <td className="px-3 py-[9px] text-right">{formatCurrency(half)}</td>
                      <td className="px-3 py-[9px] text-right">{formatCurrency(half)}</td>
                      <td className="px-3 py-[9px] text-right font-bold">{formatCurrency(inv.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="t-xs m-0 text-ink3">GST split as CGST + SGST (half each).</p>
    </div>
  )
}

// ─── Export Tab (real CSV downloads) ───────────────────────────────────────────
function ExportTab({ addToast }) {
  const [busy, setBusy] = useState('')

  const download = async (type) => {
    setBusy(type)
    try {
      const res = await reportsApi.exportCsv(type)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report.csv`
      a.click()
      URL.revokeObjectURL(url)
      addToast(`${type} report exported`, 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Export failed', 'error')
    } finally {
      setBusy('')
    }
  }

  const exports = [
    { type: 'guests',  label: 'CSV — Guests',  desc: 'Guest registry with all details' },
    { type: 'billing', label: 'CSV — Billing', desc: 'All invoices and payments' },
    { type: 'gst',     label: 'CSV — GST Report', desc: 'GST breakdown for CA filing' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {exports.map(exp => (
        <div key={exp.type} className="card flex flex-col gap-[14px]">
          <div className="card-body flex flex-col gap-2.5">
            <div>
              <div className="t-title mb-1">{exp.label}</div>
              <div className="t-xs text-ink3">{exp.desc}</div>
            </div>
            <button
              className="btn btn-primary t-xs self-start px-4 py-1.5"
              disabled={busy === exp.type}
              onClick={() => download(exp.type)}
            >
              {busy === exp.type ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
      ))}
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
  const addToast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [gst, setGst] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [d, rev, g, rm] = await Promise.all([
        reportsApi.getDashboard(),
        reportsApi.getRevenue(),
        reportsApi.getGst(),
        roomsApi.getAll(),
      ])
      setDashboard(d.data)
      setRevenue(rev.data)
      setGst(g.data)
      setRooms(rm.data.rooms || [])
    } catch {
      setError('Could not load reports. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-5 flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.02em]">
            Reports &amp; Analytics
          </h1>
          <p className="t-sm mt-1 text-ink3">
            Financial insights, occupancy data, and GST summaries
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="overview"><OverviewTab dashboard={dashboard} revenue={revenue} /></div>
        <div data-tab-id="revenue"><RevenueTab revenue={revenue} /></div>
        <div data-tab-id="occupancy"><OccupancyTab rooms={rooms} /></div>
        <div data-tab-id="gst"><GSTTab gst={gst} /></div>
        <div data-tab-id="export"><ExportTab addToast={addToast} /></div>
      </Tabs>
    </div>
  )
}
