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
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#fff', minWidth: 120 }}>
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

function MiniStat({ label, value, accent = '#c9a84c' }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: "'Playfair Display', sans-serif" }}>{value}</div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ dashboard, revenue }) {
  const byDay = (revenue?.byDay || []).map((d) => ({ date: d.date, revenue: d.revenue }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <MiniStat label="Revenue (paid invoices)" value={formatCurrencyCompact(dashboard?.revenue || 0)} accent="#c9a84c" />
        <MiniStat label="Occupancy Rate" value={`${dashboard?.occupancyRate ?? 0}%`} accent="#3b82f6" />
        <MiniStat label="Active Guests" value={(dashboard?.recentGuests?.length ?? 0)} accent="#22c55e" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Revenue by Day (paid invoices)</span></div>
        <div className="card-body">
          {byDay.length === 0 ? (
            <div className="empty-state" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text3)', fontSize: 13 }}>No paid invoices yet</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <MiniStat label="Total Revenue" value={formatCurrencyCompact(revenue?.totalRevenue || 0)} accent="#c9a84c" />
        <MiniStat label="Paid Invoices" value={(revenue?.invoices?.length ?? 0)} accent="#3b82f6" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Revenue by Day</span></div>
        <div className="card-body">
          {byDay.length === 0 ? (
            <div className="empty-state" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text3)', fontSize: 13 }}>No revenue recorded yet</p>
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
      <div className="card-body" style={{ overflowX: 'auto' }}>
        {byType.length === 0 ? (
          <div className="empty-state">No rooms found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Room Type', 'Total Rooms', 'Occupied', 'Rate', 'Occupancy'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Room Type' ? 'left' : 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byType.map(row => {
                const rate = row.total ? Math.round((row.occupied / row.total) * 100) : 0
                const color = rateColor(rate)
                return (
                  <tr key={row.type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.type}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.total}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.occupied}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color }}>{rate}%</td>
                    <td style={{ padding: '10px 12px', minWidth: 120 }}>
                      <div className="prog-bar" style={{ height: 8, borderRadius: 4, background: 'var(--surface2)' }}>
                        <div className="prog-fill" style={{ height: '100%', borderRadius: 4, width: `${rate}%`, background: color, transition: 'width 0.4s ease' }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <MiniStat label="Total Taxable" value={formatCurrencyCompact(gst?.totalTaxable || 0)} accent="#6366f1" />
        <MiniStat label="Total GST" value={formatCurrencyCompact(gst?.totalGst || 0)} accent="#c9a84c" />
        <MiniStat label="Total Amount" value={formatCurrencyCompact(gst?.totalAmount || 0)} accent="#22c55e" />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">GST Invoices</span></div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          {invoices.length === 0 ? (
            <div className="empty-state">No invoices in this period</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Invoice #', 'Guest', 'Period', 'Taxable ₹', 'CGST ₹', 'SGST ₹', 'Total ₹'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Invoice #' || h === 'Guest' || h === 'Period' ? 'left' : 'right', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const taxable = inv.rent + inv.food + inv.amenities
                  const half = +(inv.gstAmount / 2).toFixed(2)
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--gold)' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '9px 12px' }}>{inv.guest?.name || '—'}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{inv.period}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(taxable)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(half)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(half)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inv.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>GST split as CGST + SGST (half each).</p>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {exports.map(exp => (
        <div key={exp.type} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{exp.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{exp.desc}</div>
            </div>
            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 16px' }}
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
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Playfair Display', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Reports &amp; Analytics
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Financial insights, occupancy data, and GST summaries
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 13 }}>
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
