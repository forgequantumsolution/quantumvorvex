import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { LuCalendarCheck, LuIndianRupee, LuLink } from 'react-icons/lu'
import { PageWrapper, DataTable, TableCard, StatCard } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'
import { appLocale } from '../../../i18n'

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

// Display labels for channel statuses (the values stay in English).
const STATUS_KEYS = { Connected: 'status.connected', Manual: 'status.manual', Disconnected: 'status.disconnected' }

function getParityStatus(row) {
  const competitors = [row.bookingCom, row.mmtRate, row.goibibo]
  const allHigher = competitors.every(c => row.yourRate < c)
  const anyHigher = competitors.some(c => row.yourRate > c)
  if (allHigher) return { labelKey: 'parity.cheapest', type: 'green' }
  if (anyHigher) return { labelKey: 'parity.issue',    type: 'amber' }
  return { labelKey: 'parity.ok', type: 'green' }
}

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────
function RateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="t-xs bg-surface border border-line rounded-lg px-[14px] py-2.5">
      <p className="mb-1.5 font-bold text-ink">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="my-0.5" style={{ color: p.color }}>
          {p.name}: ₹{p.value.toLocaleString(appLocale())}
        </p>
      ))}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ channels }) {
  const addToast = useToast()
  const { t } = useTranslation('channels')
  const totalBookings = channels.reduce((a, c) => a + c.bookings, 0)
  const totalRevenue  = channels.reduce((a, c) => a + c.revenue,  0)
  const connectedCount = channels.filter(c => c.status === 'Connected').length

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-[14px] mb-5 sm:mb-6">
        {[
          { id: 'bookings', label: t('stats.totalBookings'), value: totalBookings, hint: t('stats.thisMonth'), icon: <LuCalendarCheck />, tone: 'blue' },
          { id: 'revenue', label: t('stats.totalRevenue'), value: formatCurrency(totalRevenue), hint: t('stats.thisMonth'), icon: <LuIndianRupee />, tone: 'green' },
          { id: 'connected', label: t('stats.connected'), value: connectedCount, hint: t('stats.ofChannels', { count: channels.length }), icon: <LuLink />, tone: 'gold',
            progress: channels.length ? (connectedCount / channels.length) * 100 : 0, className: 'col-span-2 sm:col-span-1' },
        ].map(({ id, ...card }) => <StatCard key={id} {...card} />)}
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-[14px]">
        {channels.map(ch => (
          <div key={ch.id} className="card p-0 overflow-hidden" style={{
            borderLeft: `4px solid ${ch.color}`,
          }}>
            <div className="py-[14px] px-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2.5 min-w-0">
                <span className="t-title text-ink truncate">
                  {ch.name}
                </span>
                <Badge type={statusBadge(ch.status)}>{STATUS_KEYS[ch.status] ? t(STATUS_KEYS[ch.status]) : ch.status}</Badge>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-1.5 mb-3">
                {[
                  { label: t('card.bookings'), value: ch.bookings },
                  { label: t('card.revenue'),  value: formatCurrency(ch.revenue) },
                  { label: t('card.avgRate'), value: `₹${ch.avgRate.toLocaleString(appLocale())}` },
                ].map(stat => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-xs text-ink3">{stat.label}</span>
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
                    onClick={() => addToast(t('toast.apiSoon', { name: ch.name }), 'info')}
                  >
                    {t('card.configureApi')}
                  </button>
                ) : (
                  <label className="t-xs flex items-center gap-[7px] cursor-pointer text-ink2 pointer-coarse:min-h-11">
                    <input
                      type="checkbox"
                      className="rounded text-gold focus:ring-gold/30 pointer-coarse:w-5 pointer-coarse:h-5"
                      defaultChecked={ch.status === 'Manual'}
                      onChange={() => addToast(t('toast.markedManual', { name: ch.name }), 'success')}
                    />
                    {t('card.markManual')}
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
  const { t } = useTranslation('channels')
  const [rows, setRows] = useState(RATE_PARITY)
  const [editingCell, setEditingCell] = useState(null) // { rowIndex, field }

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

  // One competitor rate: click to edit inline (table cell on md+, card tile on phones).
  function rateCell(row, rowIndex, field, val) {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === field
    return isEditing ? (
      <input
        autoFocus
        type="number"
        defaultValue={val}
        className="form-input w-full md:w-[90px] py-[3px] px-[7px] text-[12px] focus:ring-gold/20 focus:border-gold"
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
        ₹{val.toLocaleString(appLocale())}
      </span>
    )
  }

  const COMPETITORS = [
    { field: 'bookingCom', label: 'Booking.com' },
    { field: 'mmtRate',    label: 'MakeMyTrip'  },
    { field: 'goibibo',    label: 'Goibibo'     },
  ]

  const parityColumns = [
    { key: 'type', header: t('parity.roomType'), primary: true, render: (row) => <span className="font-semibold">{row.type}</span> },
    {
      key: 'yourRate', header: `${t('parity.yourRate')} ₹`, mobileLabel: t('parity.yourRate'), align: 'right',
      render: (row) => (
        <span className="font-bold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>
          ₹{row.yourRate.toLocaleString(appLocale())}
        </span>
      ),
    },
    ...COMPETITORS.map(({ field, label }) => ({
      key: field, header: `${label} ₹`, mobileLabel: label, align: 'right',
      render: (row) => {
        const rowIndex = rows.indexOf(row)
        return (
          // Phones: a tap-sized tile; table: the plain (clickable) figure
          <div
            className="cursor-pointer max-md:min-h-11 max-md:flex max-md:items-center max-md:rounded-md max-md:bg-surface2 max-md:border max-md:border-line max-md:px-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
            onClick={() => handleCellClick(rowIndex, field)}
          >
            {rateCell(row, rowIndex, field, row[field])}
          </div>
        )
      },
    })),
    {
      key: 'status', header: t('parity.status'), primary: true,
      render: (row) => {
        const parity = getParityStatus(row)
        return <Badge type={parity.type}>{t(parity.labelKey)}</Badge>
      },
    },
  ]

  const barData = rows.map(r => ({
    name:       r.type,
    yourRate:   r.yourRate,
    bookingCom: r.bookingCom,
    mmtRate:    r.mmtRate,
  }))

  return (
    <div>
      <p className="t-sm mb-4 text-ink2">
        {t('parity.intro')}
      </p>

      {/* Table on md+, one card per room type on phones; tap a competitor rate to edit it */}
      <TableCard className="mb-5 md:mb-[28px]">
        <DataTable columns={parityColumns} rows={rows} rowKey={(row) => row.type} />
      </TableCard>

      {/* Bar Chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('parity.chartTitle')}</span>
        </div>
        <div className="card-body pt-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <Tooltip content={<RateTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="yourRate"   name={t('parity.yourRate')} fill="#c9a84c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bookingCom" name="Booking.com"        fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="mmtRate"    name="MakeMyTrip"         fill="#d5001c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────
// System field ids; their labels live in channels.json under importTab.fields.
const CSV_SYSTEM_FIELDS = ['guestName', 'roomNumber', 'checkIn', 'checkOut', 'amount', 'channel']
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
  const { t } = useTranslation('channels')
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
      addToast(t('toast.fileLoaded', { name: file.name }), 'success')
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) {
      setFileUploaded(true)
      addToast(t('toast.fileLoaded', { name: file.name }), 'success')
    }
  }

  function handleImport() {
    addToast(t('toast.imported', { count: 6 }), 'success')
  }

  const mappingColumns = [
    { key: 'field', header: t('importTab.systemField'), primary: true, render: (field) => <span className="t-title">{t(`importTab.fields.${field}`)}</span> },
    {
      key: 'csv', header: t('importTab.csvColumn'), mobileFull: true,
      render: (field) => (
        <select
          aria-label={t(`importTab.fields.${field}`)}
          className="form-select t-xs w-full sm:w-auto"
          value={mapping[field]}
          onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
        >
          {CSV_MOCK_COLUMNS.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      ),
    },
  ]

  // Raw CSV rows (arrays): one column per CSV header; the amount column is numeric
  const previewColumns = CSV_MOCK_COLUMNS.map((col, j) => ({
    key: col, header: col, align: j === 4 ? 'right' : undefined,
    render: (row) => <span className="t-xs" style={{ fontFamily: j === 4 ? 'monospace' : 'inherit' }}>{row[j]}</span>,
  }))

  function handleDownloadTemplate() {
    addToast(t('toast.templateStarted'), 'info')
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
    <div className="w-full max-w-[700px]">
      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-[10px] py-8 sm:py-10 px-4 sm:px-5 text-center transition-all duration-[180ms] mb-5 cursor-pointer relative ${isDragging ? 'border-gold bg-[var(--gold-bg)]' : 'border-line bg-surface2'}`}
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
          {fileUploaded ? t('importTab.fileReady') : t('importTab.drop')}
        </p>
        <p className="t-xs m-0 text-ink3">
          {t('importTab.supports')}
        </p>
      </div>

      {/* Download template */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
        <button className="btn btn-outline btn-sm self-start shrink-0" onClick={handleDownloadTemplate}>
          {t('importTab.downloadTemplate')}
        </button>
        <span className="t-xs text-ink3">
          {t('importTab.templateHint')}
        </span>
      </div>

      {/* Column Mapping (field name over its select on phones) */}
      <TableCard title={t('importTab.columnMapping')} className="mb-5">
        <DataTable
          columns={mappingColumns}
          rows={CSV_SYSTEM_FIELDS}
          rowKey={(field) => field}
          tableFrom="sm"
        />
      </TableCard>

      {/* CSV Preview */}
      <TableCard title={t('importTab.preview', { count: CSV_PREVIEW_ROWS.length })} className="mb-5">
        <DataTable
          columns={previewColumns}
          rows={CSV_PREVIEW_ROWS}
          rowKey={(row) => CSV_PREVIEW_ROWS.indexOf(row)}
          mobile="scroll"
        />
      </TableCard>

      <button className="btn btn-primary w-full sm:w-auto justify-center" onClick={handleImport}>
        {t('importTab.importBtn')}
      </button>
    </div>
  )
}

// ─── Revenue by Source Tab ────────────────────────────────────────────────────
function PieTooltip({ active, payload, totalRevenue }) {
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

const mono = { fontFamily: 'var(--font-mono)' }

function RevenueBySourceTab({ channels }) {
  const { t } = useTranslation('channels')
  const totalRevenue  = channels.reduce((a, c) => a + c.revenue,  0)
  const totalBookings = channels.reduce((a, c) => a + c.bookings, 0)

  const pieData = channels.map(ch => ({
    name:    ch.name,
    value:   ch.revenue,
    color:   ch.color,
  }))

  const share = (ch) => ((ch.revenue / totalRevenue) * 100).toFixed(1)
  const columns = [
    {
      key: 'source', header: t('revenue.source'), primary: true,
      render: (ch) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: ch.color }} />
          <span className="t-title truncate">{ch.name}</span>
        </div>
      ),
    },
    { key: 'bookings', header: t('card.bookings'), align: 'right', render: (ch) => <span style={mono}>{ch.bookings}</span> },
    { key: 'revenue', header: `${t('card.revenue')} ₹`, align: 'right', render: (ch) => <span className="font-semibold" style={mono}>{formatCurrency(ch.revenue)}</span> },
    { key: 'avg', header: `${t('revenue.avgStay')} ₹`, align: 'right', render: (ch) => <span style={mono}>{formatCurrency(ch.avgRate)}</span> },
    {
      key: 'share', header: t('revenue.share'),
      render: (ch) => (
        <div className="flex items-center gap-2">
          <div className="w-[60px] h-1.5 rounded-[3px] bg-line overflow-hidden shrink-0">
            <div className="h-full rounded-[3px]" style={{ width: `${share(ch)}%`, background: ch.color }} />
          </div>
          <span className="text-[12px]" style={mono}>{share(ch)}%</span>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Pie Chart */}
      <div className="card mb-5">
        <div className="card-header">
          <span className="card-title">{t('revenue.byChannel')}</span>
        </div>
        <div className="card-body">
          <div className="h-[240px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="90%"
                  innerRadius="45%"
                  paddingAngle={3}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip totalRevenue={totalRevenue} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-x-[18px] gap-y-2 sm:justify-center mt-3">
            {channels.map(ch => (
              <div key={ch.id} className="t-xs flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: ch.color }} />
                <span className="text-ink2 truncate">{ch.name}</span>
                <span className="font-semibold text-ink ml-auto sm:ml-0" style={mono}>
                  {formatCurrency(ch.revenue)}
                </span>
                <span className="text-ink3">
                  ({share(ch)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table (cards on phones) + totals */}
      <TableCard>
        <DataTable
          columns={columns}
          rows={channels.slice().sort((a, b) => b.revenue - a.revenue)}
          rowKey={(ch) => ch.id}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 lg:px-5 py-3 border-t-2 border-line font-bold text-ink text-[13px]">
          <span>{t('common:total')}</span>
          <span style={mono}>{t('revenue.bookingsCount', { count: totalBookings })}</span>
          <span style={mono}>{formatCurrency(totalRevenue)}</span>
          <span className="sm:ml-auto" style={mono}>100%</span>
        </div>
      </TableCard>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Channels() {
  const { t } = useTranslation('channels')
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview',  label: t('tabs.overview') },
    { id: 'parity',    label: t('tabs.parity')   },
    { id: 'import',    label: t('tabs.import')   },
    { id: 'revenue',   label: t('tabs.revenue')  },
  ]

  return (
    <PageWrapper title={t('title')} subtitle={t('subtitle')} search={null} headerActions={[]}>

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
    </PageWrapper>
  )
}
