import { useState, useEffect, useCallback, useMemo } from 'react'
import { LuIndianRupee, LuChartPie, LuUsers, LuReceipt, LuBedDouble, LuSigma, LuPercent, LuWallet, LuRefreshCw } from 'react-icons/lu'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import Tabs from '../../ui/Tabs'
import { PageWrapper, StatCard, Card, DataTable, Button, EmptyState } from '../../ui-tw'
import { useBreakpoint } from '../../../hooks/useMediaQuery'
import { useToast } from '../../../hooks/useToast'
import { reportsApi, roomsApi } from '../../../api/client'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'
import { useTranslation } from 'react-i18next'
import { appLocale } from '../../../i18n'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="t-xs bg-surface border border-line rounded-md px-3 py-2 text-ink shadow-lift min-w-[120px]">
      <div className="text-ink3 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span className="font-semibold">
            {prefix}{typeof p.value === 'number' ? p.value.toLocaleString(appLocale()) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * KPI tiles: 2-up on phones and tablets, 3-up from lg. An odd last tile spans
 * the full row below lg so a 3-tile set doesn't leave a hole.
 */
function StatGrid({ children }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">
      {children}
    </div>
  )
}

// Shared axis styling. The Y axis gets a fixed, narrow width so the plot keeps
// most of a phone's width; X ticks thin out instead of overlapping.
const AXIS_TICK = { fontSize: 11, fill: 'var(--text3)' }
// ISO dates ("2026-10-21") read as "21 Oct" on the axis; the tooltip keeps the full date.
const shortDate = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }) : v
}
const X_AXIS = { tick: AXIS_TICK, tickLine: false, minTickGap: 16, interval: 'preserveStartEnd', tickFormatter: shortDate }
const Y_AXIS = { tick: AXIS_TICK, tickLine: false, axisLine: false, width: 44 }
const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 }
const rupeesK = (v) => `₹${(v / 1000).toFixed(0)}K`

/** A titled chart card; the chart fills its width and is a little shorter on phones. */
function ChartCard({ title, emptyText, isEmpty, children }) {
  const { isPhone } = useBreakpoint()
  return (
    <Card title={title}>
      {isEmpty ? (
        <div className="h-[180px] sm:h-[220px] flex items-center justify-center px-4">
          <p className="t-sm m-0 text-ink3 text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="px-1 sm:px-3 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={isPhone ? 200 : 240}>
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ dashboard, revenue }) {
  const { t } = useTranslation('reports')
  const byDay = (revenue?.byDay || []).map((d) => ({ date: d.date, revenue: d.revenue }))
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <StatGrid>
        <StatCard icon={<LuIndianRupee />} tone="gold" label={t('overview.revenuePaid')} value={formatCurrencyCompact(dashboard?.revenue || 0)} />
        <StatCard icon={<LuChartPie />} tone="blue" label={t('overview.occupancyRate')} value={`${dashboard?.occupancyRate ?? 0}%`} />
        <StatCard icon={<LuUsers />} tone="green" label={t('overview.activeGuests')} value={dashboard?.recentGuests?.length ?? 0} />
      </StatGrid>

      <ChartCard title={t('overview.revenueByDayPaid')} isEmpty={byDay.length === 0} emptyText={t('overview.noPaidInvoices')}>
        <LineChart data={byDay} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" {...X_AXIS} />
          <YAxis {...Y_AXIS} tickFormatter={rupeesK} />
          <Tooltip content={<ChartTooltip prefix="₹" />} />
          <Line type="monotone" dataKey="revenue" name={t('revenue.series')} stroke="#c9a84c" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#c9a84c' }} />
        </LineChart>
      </ChartCard>
    </div>
  )
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab({ revenue }) {
  const { t } = useTranslation('reports')
  const byDay = revenue?.byDay || []
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        <StatCard icon={<LuIndianRupee />} tone="gold" label={t('revenue.total')} value={formatCurrencyCompact(revenue?.totalRevenue || 0)} />
        <StatCard icon={<LuReceipt />} tone="blue" label={t('revenue.paidInvoices')} value={revenue?.invoices?.length ?? 0} />
      </div>

      <ChartCard title={t('revenue.byDay')} isEmpty={byDay.length === 0} emptyText={t('revenue.empty')}>
        <BarChart data={byDay} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" {...X_AXIS} />
          <YAxis {...Y_AXIS} tickFormatter={rupeesK} />
          <Tooltip content={<ChartTooltip prefix="₹" />} cursor={{ fill: 'var(--gold-bg)' }} />
          <Bar dataKey="revenue" name={t('revenue.series')} fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ChartCard>
    </div>
  )
}

// ─── Occupancy Tab (daily trend + by-type, from /reports/occupancy) ─────────────
const rateTone = (rate) => (rate >= 80
  ? { text: 'text-success-text', bar: 'bg-success' }
  : rate >= 50
    ? { text: 'text-warning-text', bar: 'bg-warning' }
    : { text: 'text-danger-text', bar: 'bg-danger' })

function OccupancyTab({ rooms, occupancy }) {
  const { t } = useTranslation('reports')
  // Prefer the API's room-type breakdown; fall back to deriving from the live
  // rooms list if the occupancy endpoint hasn't loaded.
  const byType = useMemo(() => {
    if (occupancy?.byRoomType?.length) {
      return occupancy.byRoomType.map(rt => ({ type: rt.roomType, total: rt.total, occupied: rt.occupied }))
    }
    const map = {}
    for (const r of rooms) {
      const type = r.type?.name || t('occupancy.other')
      if (!map[type]) map[type] = { type, total: 0, occupied: 0 }
      map[type].total += 1
      if (r.status === 'occupied') map[type].occupied += 1
    }
    return Object.values(map)
  }, [rooms, occupancy, t])

  const rows = byType.map((row) => ({ ...row, rate: row.total ? Math.round((row.occupied / row.total) * 100) : 0 }))
  const byDay = occupancy?.byDay || []

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        <StatCard icon={<LuChartPie />} tone="blue" label={t('occupancy.avg')} value={`${occupancy?.avgRate ?? 0}%`} />
        <StatCard icon={<LuBedDouble />} tone="gold" label={t('occupancy.totalRooms')} value={occupancy?.totalRooms ?? rooms.length} />
      </div>

      {/* Daily occupancy trend */}
      <ChartCard title={t('occupancy.trend')} isEmpty={byDay.length === 0} emptyText={t('occupancy.trendEmpty')}>
        <LineChart data={byDay} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" {...X_AXIS} />
          <YAxis domain={[0, 100]} {...Y_AXIS} tickFormatter={v => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="rate" name={t('occupancy.series')} stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
        </LineChart>
      </ChartCard>

      {/* Current occupancy by room type — cards on phones, a table from md */}
      <Card title={t('occupancy.byType')}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.type}
          empty={<EmptyState icon="🛏" title={t('occupancy.noRooms')} />}
          columns={[
            { key: 'type', header: t('occupancy.col.type'), primary: true, render: (r) => <span className="font-semibold">{r.type}</span> },
            { key: 'total', header: t('occupancy.col.total'), mobileLabel: t('common:total'), align: 'center' },
            { key: 'occupied', header: t('occupancy.col.occupied'), align: 'center' },
            {
              key: 'rate', header: t('occupancy.col.rate'), align: 'center', primary: true,
              render: (r) => <span className={`font-bold ${rateTone(r.rate).text}`}>{r.rate}%</span>,
            },
            {
              key: 'bar', header: t('occupancy.col.occupancy'), className: 'min-w-[140px]', mobileFull: true,
              render: (r) => (
                <div className="prog-bar h-2 rounded bg-surface2">
                  <div className={`prog-fill h-full rounded transition-[width] duration-[400ms] ease-[ease] ${rateTone(r.rate).bar}`} style={{ width: `${r.rate}%` }} />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ─── GST Tab ──────────────────────────────────────────────────────────────────
function GSTTab({ gst }) {
  const { t } = useTranslation('reports')
  const invoices = (gst?.invoices || []).map((inv) => ({
    ...inv,
    taxable: inv.rent + inv.food + inv.amenities,
    half: +(inv.gstAmount / 2).toFixed(2),
  }))
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <StatGrid>
        <StatCard icon={<LuSigma />} tone="blue" label={t('gst.totalTaxable')} value={formatCurrencyCompact(gst?.totalTaxable || 0)} />
        <StatCard icon={<LuPercent />} tone="gold" label={t('gst.totalGst')} value={formatCurrencyCompact(gst?.totalGst || 0)} />
        <StatCard icon={<LuWallet />} tone="green" label={t('gst.totalAmount')} value={formatCurrencyCompact(gst?.totalAmount || 0)} />
      </StatGrid>

      <Card title={t('gst.invoices')} subtitle={t('gst.split')}>
        <DataTable
          rows={invoices}
          rowKey={(inv) => inv.id}
          empty={<EmptyState icon="🧾" title={t('gst.empty')} />}
          columns={[
            { key: 'invoiceNo', header: t('gst.col.invoice'), primary: true, render: (inv) => <span className="font-semibold text-gold">{inv.invoiceNo}</span> },
            { key: 'guest', header: t('common:guest'), render: (inv) => inv.guest?.name || '—' },
            { key: 'period', header: t('gst.col.period'), render: (inv) => <span className="text-ink3">{inv.period}</span> },
            { key: 'taxable', header: `${t('gst.col.taxable')} ₹`, mobileLabel: t('gst.col.taxable'), align: 'right', render: (inv) => formatCurrency(inv.taxable) },
            { key: 'cgst', header: 'CGST ₹', mobileLabel: 'CGST', align: 'right', render: (inv) => formatCurrency(inv.half) },
            { key: 'sgst', header: 'SGST ₹', mobileLabel: 'SGST', align: 'right', render: (inv) => formatCurrency(inv.half) },
            { key: 'total', header: `${t('common:total')} ₹`, align: 'right', primary: true, render: (inv) => <span className="font-bold">{formatCurrency(inv.total)}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

// ─── Export Tab (real CSV + PDF downloads) ──────────────────────────────────────
function ExportTab({ addToast }) {
  const { t } = useTranslation('reports')
  const [busy, setBusy] = useState('')   // `${type}:${format}` while downloading

  const download = async (type, format) => {
    const key = `${type}:${format}`
    setBusy(key)
    try {
      const res = format === 'pdf' ? await reportsApi.exportPdf(type) : await reportsApi.exportCsv(type)
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv'
      const blob = new Blob([res.data], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report.${format}`
      a.click()
      URL.revokeObjectURL(url)
      addToast(t('export.done', { report: t(`export.${type}.label`), format: format.toUpperCase() }), 'success')
    } catch (err) {
      addToast(err.response?.data?.message || t('export.failed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const exports = [
    { type: 'guests',  label: t('export.guests.label'),  desc: t('export.guests.desc') },
    { type: 'billing', label: t('export.billing.label'), desc: t('export.billing.desc') },
    { type: 'gst',     label: t('export.gst.label'),     desc: t('export.gst.desc') },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {exports.map(exp => (
        <Card key={exp.type} className="flex flex-col" bodyClassName="flex-1 px-4 sm:px-5 py-4 flex flex-col gap-3.5">
          <div className="min-w-0">
            <div className="t-title mb-1">{exp.label}</div>
            <div className="t-xs text-ink3">{exp.desc}</div>
          </div>
          {/* Equal halves on phones so both formats are easy to hit */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-auto">
            <Button
              variant="ghost"
              disabled={busy === `${exp.type}:csv`}
              onClick={() => download(exp.type, 'csv')}
            >
              {busy === `${exp.type}:csv` ? t('export.exporting') : t('common:exportCsv')}
            </Button>
            <Button
              disabled={busy === `${exp.type}:pdf`}
              onClick={() => download(exp.type, 'pdf')}
            >
              {busy === `${exp.type}:pdf` ? t('export.exporting') : t('export.pdf')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Reports (Root) ───────────────────────────────────────────────────────────
const TAB_IDS = ['overview', 'revenue', 'occupancy', 'gst', 'export']

export default function Reports() {
  const { t } = useTranslation('reports')
  const addToast = useToast()
  const tabs = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }))
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [gst, setGst] = useState(null)
  const [rooms, setRooms] = useState([])
  const [occupancy, setOccupancy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const [d, rev, g, rm, occ] = await Promise.all([
        reportsApi.getDashboard(),
        reportsApi.getRevenue(),
        reportsApi.getGst(),
        roomsApi.getAll(),
        reportsApi.getOccupancy(),
      ])
      setDashboard(d.data)
      setRevenue(rev.data)
      setGst(g.data)
      setRooms(rm.data.rooms || [])
      setOccupancy(occ.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={null}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
      ]}
    >
      {error && (
        <div className="t-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {t('loadError')}
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="overview"><OverviewTab dashboard={dashboard} revenue={revenue} /></div>
        <div data-tab-id="revenue"><RevenueTab revenue={revenue} /></div>
        <div data-tab-id="occupancy"><OccupancyTab rooms={rooms} occupancy={occupancy} /></div>
        <div data-tab-id="gst"><GSTTab gst={gst} /></div>
        <div data-tab-id="export"><ExportTab addToast={addToast} /></div>
      </Tabs>
    </PageWrapper>
  )
}
