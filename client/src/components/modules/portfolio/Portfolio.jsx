import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  LuRefreshCw, LuPlus, LuChevronRight, LuArrowUp, LuArrowDown, LuChevronsUpDown,
  LuTriangleAlert, LuWrench, LuCalendarCheck, LuCircleCheck, LuCalendarPlus, LuDoorOpen, LuLayers, LuWallet,
  LuBedDouble, LuTrendingUp, LuUsers, LuLogIn, LuCircleAlert, LuFilter, LuX, LuCheck,
} from 'react-icons/lu'
import StatCard from '../../ui-tw/StatCard'
import { StatStrip } from '../../ui-tw'
import { useAppSelector, useAuthActions, useUiActions, usePageHeader } from '../../../store/hooks'
import { selectActiveProperty, selectProperties } from '../../../store/slices/authSlice'
import { propertiesApi } from '../../../api/client'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'
import { useTranslation, Trans } from 'react-i18next'
import { appLocale } from '../../../i18n'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Chart colours come from CSS tokens (validated for 3:1 against each surface);
// SVG attributes can't resolve var(), so read the computed value per theme.
function useCssVar(name) {
  const darkMode = useAppSelector((s) => s.ui.darkMode)
  return useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#a8862e',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, darkMode],
  )
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)
const nightLabel = (iso, i, tonight) =>
  i === 0 ? tonight : new Date(`${iso}T00:00:00`).toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric' })
const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'short' })
const PERIOD_KEY = 'portfolio:period'
const FILTER_KEY = 'portfolio:filters'
// properties: ids to include ([] = all); the rest only narrow the comparison list.
const NO_FILTERS = { properties: [], occupancy: 'all', attentionOnly: false, showArchived: false }
// Labels: t(`band.${id}`).
const OCCUPANCY_BANDS = [
  { id: 'all', test: () => true },
  { id: 'low', test: (r) => r < 50 },
  { id: 'mid', test: (r) => r >= 50 && r <= 80 },
  { id: 'high', test: (r) => r > 80 },
]
const REFRESH_MS = 60 * 1000
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' })

function CodeChip({ code }) {
  return (
    <span className="text-[10px] font-bold tracking-[0.06em] px-1.5 py-[3px] rounded-[4px] bg-surface2 border border-line text-ink2 shrink-0 leading-none" style={{ fontFamily: 'var(--font-mono)' }}>
      {code}
    </span>
  )
}

function Pill({ tone = 'gold', children }) {
  const tones = {
    gold: 'bg-[var(--gold-bg)] text-[var(--gold2)] border-[var(--gold-border)]',
    grey: 'bg-surface2 text-ink3 border-line',
  }
  return <span className={`text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-[2px] rounded-full border ${tones[tone]}`}>{children}</span>
}

// Occupancy meter: one hue — fill on a lighter track of the same ramp.
function Meter({ value, accent, height = 6 }) {
  return (
    <div className="rounded-full bg-[var(--chart-track)] overflow-hidden" style={{ height }} role="presentation">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(value, 100)}%`, background: accent }} />
    </div>
  )
}

// 7-night "on the books" strip for a table row. Each bar is the share of sellable
// rooms booked that night; values are in the tooltip and on the Today panel.
function MiniForecast({ forecast, sellable, accent }) {
  const { t } = useTranslation('portfolio')
  const tonight = t('tonight')
  const nights = forecast.slice(0, 7)
  const W = 8, GAP = 3, H = 26
  return (
    <svg
      width={nights.length * (W + GAP) - GAP}
      height={H}
      role="img"
      aria-label={t('mini.aria', { list: nights.map((n, i) => `${nightLabel(n.date, i, tonight)} ${pct(n.booked, sellable)}%`).join(', ') })}
    >
      {nights.map((n, i) => {
        const h = Math.max(2, Math.round((pct(n.booked, sellable) / 100) * H))
        return (
          <g key={n.date}>
            <rect x={i * (W + GAP)} y={0} width={W} height={H} rx={2} fill="var(--chart-track)" />
            <rect x={i * (W + GAP)} y={H - h} width={W} height={h} rx={2} fill={accent} opacity={i === 0 ? 1 : 0.6} />
            <title>{`${nightLabel(n.date, i, tonight)} · ${t('mini.booked', { booked: n.booked, sellable })} · ${pct(n.booked, sellable)}%`}</title>
          </g>
        )
      })}
    </svg>
  )
}

// ─── KPI header ───────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, icon: Icon, tone, onClick }) {
  return <StatCard label={label} value={value} hint={sub} icon={Icon && <Icon />} tone={tone} onClick={onClick} />
}

function HeroOccupancy({ totals, accent }) {
  const { t } = useTranslation('portfolio')
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4 sm:p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="t-label">{t('hero.title')}</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-[44px] sm:text-[52px] font-bold text-ink leading-none" style={{ letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {totals.occupancyRate}
          </span>
          <span className="text-[22px] font-semibold text-ink2">%</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Meter value={totals.occupancyRate} accent={accent} height={8} />
        <div className="t-xs text-ink3">
          <Trans t={t} i18nKey="hero.occupied" values={{ occupied: totals.occupied, sellable: totals.sellable }}
            components={{ b: <strong className="text-ink2" /> }} />
          {totals.outOfOrder ? ` · ${t('outOfOrder', { count: totals.outOfOrder })}` : ''}
          {totals.properties > 1 ? ` · ${t('propertiesCount', { count: totals.properties })}` : ''}
        </div>
      </div>
    </div>
  )
}

// ─── Forecast chart ───────────────────────────────────────────────────────────

function ForecastTooltip({ active, payload }) {
  const { t } = useTranslation('portfolio')
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface border border-line rounded-lg shadow-[var(--shadow-md)] px-3 py-2">
      <div className="text-xs text-ink3">{d.longLabel}</div>
      <div className="text-[14px] font-bold text-ink mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('forecast.tipOccupied', { pct: d.pct })}</div>
      <div className="text-xs text-ink2">{t('forecast.tipBooked', { booked: d.booked, sellable: d.sellable })}</div>
    </div>
  )
}

// Periods the dashboard can show (GET /properties/summary?forecast=&trend=).
// Labels are built at render time (forecastPeriods / trendPeriods) so they follow the language.
const FORECAST_PERIODS = [7, 14, 30]
const TREND_PERIODS = ['7', '30', '90', 'month']
const forecastPeriods = (t) => FORECAST_PERIODS.map((id) => ({ id, label: t('period.nights', { n: id }) }))
const trendPeriods = (t) => TREND_PERIODS.map((id) => ({ id, label: id === 'month' ? t('period.month') : t('period.days', { n: id }) }))

// Small segmented control for a card's period.
function PeriodToggle({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-surface2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 h-7 pointer-coarse:h-9 rounded-md text-xs font-semibold transition-colors ${
            value === o.id ? 'bg-surface text-ink shadow-soft' : 'text-ink3 hover:text-ink2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Shown in place of the chart when nothing is booked across the forecast nights.
function ForecastEmpty({ noRooms, propertyName, onNewBooking, onAddRooms, nights, onNights }) {
  const { t } = useTranslation('portfolio')
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4 sm:p-5 min-w-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="t-title">{t('forecast.title', { count: nights })}</div>
        <PeriodToggle options={forecastPeriods(t)} value={nights} onChange={onNights} label={t('forecast.periodLabel')} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
        <span className="w-11 h-11 rounded-xl bg-surface2 text-ink3 flex items-center justify-center mb-1">
          {noRooms ? <LuDoorOpen size={20} aria-hidden /> : <LuCalendarPlus size={20} aria-hidden />}
        </span>
        <div className="t-sm text-ink font-semibold">{noRooms ? t('forecast.noRoomsTitle') : t('forecast.noBookingsTitle')}</div>
        <div className="t-xs text-ink3 max-w-[340px]">
          {noRooms
            ? t('forecast.noRoomsText')
            : t('forecast.noBookingsText', { count: nights })}
        </div>
        {noRooms
          ? <button className="btn btn-outline btn-sm mt-2" onClick={onAddRooms}>{t('forecast.setUpRooms')}</button>
          : <button className="btn btn-primary btn-sm mt-2" onClick={onNewBooking}><LuPlus size={14} aria-hidden /> {propertyName ? t('forecast.newBookingAt', { name: propertyName }) : t('forecast.newBooking')}</button>}
      </div>
    </div>
  )
}

// `period` is the length picked; the chart shows the nights the server returned.
function ForecastChart({ totals, accent, scopeLabel, period, onNights }) {
  const { t } = useTranslation('portfolio')
  const tonight = t('tonight')
  const nights = totals.forecast.length
  const data = totals.forecast.map((n, i) => ({
    label: nightLabel(n.date, i, tonight),
    longLabel: i === 0 ? `${tonight} · ${longDate(n.date)}` : longDate(n.date),
    booked: n.booked,
    sellable: totals.sellable,
    pct: pct(n.booked, totals.sellable),
  }))
  const peak = data.reduce((m, d) => (d.pct > m.pct ? d : m), data[0] || { pct: 0 })
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="t-title">{t('forecast.title', { count: nights })}</div>
          <div className="t-xs text-ink3 mt-0.5">
            {t('forecast.sub', { scope: scopeLabel })}
            {peak && <> · {t('forecast.peak')} <span className="text-ink font-semibold">{peak.pct}%</span> {peak.label}</>}
          </div>
        </div>
        <PeriodToggle options={forecastPeriods(t)} value={period} onChange={onNights} label={t('forecast.periodLabel')} />
      </div>
      <div className="h-[180px] sm:h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label" tickLine={false} axisLine={false} interval={nights > 14 ? 4 : 'preserveStartEnd'}
              tick={{ fontSize: 10.5, fill: 'var(--text3)' }}
            />
            <YAxis
              domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`}
              tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: 'var(--text3)' }}
            />
            <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'var(--chart-track)' }} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {/* Tonight in the accent, future nights a lighter step of the same hue. */}
              {data.map((d, i) => <Cell key={d.label} fill={accent} fillOpacity={i === 0 ? 1 : 0.5} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Shared card shell + empty state ──────────────────────────────────────────

function Card({ title, sub, aside, children, className = '' }) {
  return (
    <div className={`bg-surface border border-line rounded-[10px] p-4 sm:p-5 min-w-0 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap mb-4">
        <div className="min-w-0">
          <div className="t-title">{title}</div>
          {sub && <div className="t-xs text-ink3 mt-0.5">{sub}</div>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}

function CardEmpty({ icon, title, text }) {
  const Icon = icon
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-1.5">
      <span className="w-10 h-10 rounded-xl bg-surface2 text-ink3 flex items-center justify-center mb-1">
        <Icon size={18} aria-hidden />
      </span>
      <div className="t-sm text-ink font-semibold">{title}</div>
      <div className="t-xs text-ink3 max-w-[280px]">{text}</div>
    </div>
  )
}

// ─── Room status ──────────────────────────────────────────────────────────────

// Order is deliberate: validated so each adjacent pair stays distinguishable
// for colour-blind readers (with the 2px gaps and labelled legend as backup).
// Labels: t(`roomState.${key}`).
const ROOM_STATES = [
  { key: 'occupied',   color: 'var(--red)'   },
  { key: 'reserved',   color: 'var(--blue)'  },
  { key: 'available',  color: 'var(--green)' },
  { key: 'outOfOrder', color: 'var(--amber)' },
]

function RoomStatusCard({ view }) {
  const { t } = useTranslation('portfolio')
  const stateLabel = (key) => t(`roomState.${key}`)
  const total = view.rooms
  const counts = { occupied: view.occupied, reserved: view.reserved || 0, available: view.available || 0, outOfOrder: view.outOfOrder || 0 }
  const stays = view.stayMix || { daily: 0, monthly: 0 }
  return (
    <Card title={t('roomStatus.title')} sub={t('roomStatus.sub', { count: total })}>
      {total === 0 ? (
        <CardEmpty icon={LuDoorOpen} title={t('noRoomsYet')} text={t('roomStatus.emptyText')} />
      ) : (
        <>
          <div className="flex h-3 gap-[2px] rounded-full overflow-hidden bg-[var(--chart-track)]" role="img"
            aria-label={ROOM_STATES.map((st) => `${counts[st.key]} ${stateLabel(st.key).toLowerCase()}`).join(', ')}>
            {ROOM_STATES.filter((st) => counts[st.key] > 0).map((st) => (
              <span key={st.key} title={t('roomStatus.segment', { label: stateLabel(st.key), count: counts[st.key], total })}
                style={{ width: `${(counts[st.key] / total) * 100}%`, background: st.color }} />
            ))}
          </div>
          <ul className="list-none m-0 p-0 mt-4 flex flex-col gap-2.5">
            {ROOM_STATES.map((st) => (
              <li key={st.key} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: st.color }} aria-hidden />
                <span className="text-ink2 flex-1">{stateLabel(st.key)}</span>
                <span className="font-semibold text-ink" style={tabular}>{counts[st.key]}</span>
                <span className="text-ink3 w-11 text-right" style={tabular}>{pct(counts[st.key], total)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-line t-xs text-ink3 flex justify-between gap-2">
            <span>{t('roomStatus.stays')}</span>
            <span><Trans t={t} i18nKey="roomStatus.stayMix" values={{ daily: stays.daily, monthly: stays.monthly }}
              components={{ b: <strong className="text-ink2" style={tabular} /> }} /></span>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Collections trend ────────────────────────────────────────────────────────

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' })

function CollectionsTooltip({ active, payload }) {
  const { t } = useTranslation('portfolio')
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface border border-line rounded-lg shadow-[var(--shadow-md)] px-3 py-2">
      <div className="text-xs text-ink3">{longDate(d.date)}</div>
      <div className="text-[14px] font-bold text-ink mt-0.5" style={tabular}>{formatCurrency(d.amount)}</div>
      <div className="text-xs text-ink2">{t('collections.collected')}</div>
    </div>
  )
}

function CollectionsChart({ series, accent, trend, onTrend }) {
  const { t } = useTranslation('portfolio')
  const total = series.reduce((n, d) => n + d.amount, 0)
  const days = series.filter((d) => d.amount > 0).length
  const best = series.reduce((m, d) => (d.amount > m.amount ? d : m), series[0] || { amount: 0 })
  return (
    <Card
      title={trend === 'month' ? t('collections.titleMonth') : t('collections.titleDays', { count: series.length })}
      sub={total > 0 ? <>{t('collections.subTotal')} <span className="text-ink font-semibold" style={tabular}>{formatCurrency(total)}</span></> : t('collections.sub')}
      aside={<PeriodToggle options={trendPeriods(t)} value={trend} onChange={onTrend} label={t('collections.periodLabel')} />}
    >
      {total === 0 ? (
        <CardEmpty icon={LuWallet} title={t('collections.emptyTitle')} text={trend === 'month' ? t('collections.emptyMonth') : t('collections.emptyDays', { count: series.length })} />
      ) : (
        <>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} interval={series.length > 31 ? 14 : series.length > 10 ? 6 : 0}
                  tick={{ fontSize: 10.5, fill: 'var(--text3)' }} />
                <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={52}
                  tick={{ fontSize: 10.5, fill: 'var(--text3)' }} />
                <Tooltip content={<CollectionsTooltip />} cursor={{ fill: 'var(--chart-track)' }} />
                <Bar dataKey="amount" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 flex-wrap mt-3 t-xs text-ink3">
            <span>{t('collections.avgDay')} <strong className="text-ink2" style={tabular}>{formatCurrency(Math.round(total / series.length))}</strong></span>
            <span>{t('collections.daysWithPayments')} <strong className="text-ink2" style={tabular}>{days}</strong></span>
            {best.amount > 0 && <span>{t('collections.bestDay')} <strong className="text-ink2">{shortDate(best.date)}</strong></span>}
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Payment methods ──────────────────────────────────────────────────────────

const METHODS = ['cash', 'upi', 'card', 'bank', 'bank_transfer', 'cheque', 'online', 'other']
const methodLabel = (t, m) => {
  const k = m?.toLowerCase()
  if (METHODS.includes(k)) return t(`method.${k}`)
  return m ? m[0].toUpperCase() + m.slice(1) : t('method.other')
}

function PaymentMethodsCard({ methods, accent }) {
  const { t } = useTranslation('portfolio')
  const rows = [...methods].sort((a, b) => b.amount - a.amount)
  const total = rows.reduce((n, m) => n + m.amount, 0)
  const max = rows[0]?.amount || 1
  return (
    <Card title={t('methods.title')} sub={t('methods.sub')}>
      {total === 0 ? (
        <CardEmpty icon={LuWallet} title={t('methods.emptyTitle')} text={t('methods.emptyText')} />
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
          {rows.map((m) => (
            <li key={m.method}>
              <div className="flex items-baseline justify-between gap-2 text-[12.5px] mb-1.5">
                <span className="text-ink2">{methodLabel(t, m.method)}</span>
                <span style={tabular}>
                  <strong className="text-ink">{formatCurrency(m.amount)}</strong>
                  <span className="text-ink3 ml-1.5">{pct(m.amount, total)}%</span>
                </span>
              </div>
              <Meter value={(m.amount / max) * 100} accent={accent} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── Occupancy by room type ───────────────────────────────────────────────────

function RoomTypesCard({ types, accent }) {
  const { t } = useTranslation('portfolio')
  const rows = [...types].sort((a, b) => b.total - a.total)
  return (
    <Card title={t('roomTypes.title')} sub={t('roomTypes.sub')}>
      {rows.length === 0 ? (
        <CardEmpty icon={LuDoorOpen} title={t('roomTypes.emptyTitle')} text={t('roomTypes.emptyText')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {rows.map((rt) => (
            <div key={rt.type} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px] mb-1.5">
                <span className="text-ink font-medium truncate">{rt.type}</span>
                <span style={tabular}>
                  <strong className="text-ink">{pct(rt.occupied, rt.total)}%</strong>
                  <span className="text-ink3 ml-1.5">{rt.occupied} / {rt.total}</span>
                </span>
              </div>
              <Meter value={pct(rt.occupied, rt.total)} accent={accent} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Needs attention ──────────────────────────────────────────────────────────

const SEVERITY = {
  critical: { Icon: LuTriangleAlert, color: 'var(--red-text)',   bg: 'var(--red-bg)'   },
  warning:  { Icon: LuTriangleAlert, color: 'var(--amber-text)', bg: 'var(--amber-bg)' },
  info:     { Icon: LuCalendarCheck, color: 'var(--blue-text)',  bg: 'var(--blue-bg)'  },
}

// Derive actionable items from the stats — highest severity first. Each carries
// a message `kind` and its values; the text is built in the user's language at render.
function attentionItems(properties) {
  const items = []
  for (const p of properties) {
    if (p.status !== 'active') continue
    const s = p.stats
    if (s.arrivalsToday > s.rooms.available) {
      items.push({ severity: 'critical', property: p, panel: 'bookings', Icon: LuTriangleAlert,
        kind: 'overbooked', values: { arrivals: s.arrivalsToday, available: s.rooms.available } })
    }
    if (s.rooms.outOfOrder > 0) {
      items.push({ severity: 'warning', property: p, panel: 'maintenance', Icon: LuWrench,
        kind: 'outOfOrder', values: { count: s.rooms.outOfOrder } })
    }
    if (s.outstanding > 0) {
      items.push({ severity: 'warning', property: p, panel: 'billing', Icon: LuTriangleAlert,
        kind: 'outstanding', amount: s.outstanding })
    }
    const soldOut = s.forecast.slice(1).find((n) => s.rooms.sellable && n.booked >= s.rooms.sellable)
    if (soldOut) {
      items.push({ severity: 'info', property: p, panel: 'bookings', Icon: LuCalendarCheck,
        kind: 'soldOut', date: soldOut.date })
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity])
}

const attentionText = (t, it) => t(`attention.${it.kind}`, {
  ...it.values,
  ...(it.amount != null && { amount: formatCurrency(it.amount) }),
  ...(it.date && { date: longDate(it.date) }),
})

function AttentionList({ items, onOpen }) {
  const { t } = useTranslation('portfolio')
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4 sm:p-5 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="t-title">{t('attention.title')}</div>
        {items.length > 0 && <span className="t-xs text-ink3">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
          <LuCircleCheck size={22} className="text-success" aria-hidden />
          <div className="t-sm text-ink2 font-medium">{t('attention.allClear')}</div>
          <div className="t-xs text-ink3">{t('attention.allClearText')}</div>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-1 overflow-y-auto max-h-[230px] -mx-2">
          {items.map((it, i) => {
            const sev = SEVERITY[it.severity]
            return (
              <li key={i}>
                <button
                  onClick={() => onOpen(it.property.id, it.panel)}
                  className="w-full flex items-start gap-2.5 text-left bg-transparent border-none rounded-lg px-2 py-2 pointer-coarse:py-2.5 cursor-pointer hover:bg-surface2"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-px" style={{ background: sev.bg, color: sev.color }}>
                    <it.Icon size={13} aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] text-ink leading-[1.35]">{attentionText(t, it)}</span>
                    <span className="flex items-center gap-1.5 mt-0.5 text-xs text-ink3">
                      <span className="sr-only">{t(`severity.${it.severity}`)}: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{it.property.code}</strong> {it.property.name}
                    </span>
                  </span>
                  <LuChevronRight size={14} className="text-ink3 shrink-0 mt-1" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────

// Labels: t(`col.${key}`); columns with `hint` also have a t(`col.${key}Hint`) tooltip.
const COLUMNS = [
  { key: 'name',        get: (p) => p.name.toLowerCase(), align: 'left' },
  { key: 'occupancy',   get: (p) => p.stats.occupancyRate, align: 'left' },
  { key: 'adr',         get: (p) => p.stats.adr, hint: true },
  { key: 'revpar',      get: (p) => p.stats.revpar, hint: true },
  { key: 'movements',   get: (p) => p.stats.arrivalsToday + p.stats.departuresToday, hint: true },
  { key: 'collected',   get: (p) => p.stats.collectedThisMonth },
  { key: 'outstanding', get: (p) => p.stats.outstanding },
  { key: 'forecast',    sortable: false, align: 'left' },
]

function SortHeader({ col, sort, onSort }) {
  const { t } = useTranslation('portfolio')
  const label = t(`col.${col.key}`)
  const active = sort.key === col.key
  const Icon = !active ? LuChevronsUpDown : sort.dir === 'asc' ? LuArrowUp : LuArrowDown
  const alignRight = col.align !== 'left'
  if (col.sortable === false) return <th className={alignRight ? 'text-right' : ''}>{label}</th>
  return (
    <th className={alignRight ? 'text-right' : ''} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={col.hint ? t(`col.${col.key}Hint`) : undefined}>
      <button
        onClick={() => onSort(col.key)}
        className={`inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer uppercase tracking-[inherit] text-[length:inherit] font-[inherit] ${active ? 'text-ink' : 'text-[inherit]'} ${alignRight ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon size={12} className={active ? 'text-ink' : 'opacity-50'} aria-hidden />
      </button>
    </th>
  )
}

const num = 'text-right whitespace-nowrap'
const tabular = { fontVariantNumeric: 'tabular-nums' }

function PropertyRow({ p, accent, onOpen }) {
  const s = p.stats
  const archived = p.status === 'archived'
  const noRooms = s.rooms.total === 0
  const { t } = useTranslation('portfolio')
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      tabIndex={0}
      aria-label={t('openProperty', { name: p.name })}
      className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${archived ? 'opacity-60' : ''}`}
    >
      <td>
        <div className="flex items-center gap-2.5 min-w-[190px]">
          <CodeChip code={p.code} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="t-title truncate">{p.name}</span>
              {archived && <Pill tone="grey">{t('common:archived')}</Pill>}
            </div>
            <div className="t-xs text-ink3 mt-px">
              {noRooms ? t('noRoomsYet') : t('roomsCount', { count: s.rooms.total })}{s.rooms.outOfOrder ? ` · ${t('outOfOrder', { count: s.rooms.outOfOrder })}` : ''} · {p.roleName}
            </div>
          </div>
        </div>
      </td>
      <td>
        {noRooms ? (
          <span className="t-xs text-ink3">{t('addRoomsToStart')}</span>
        ) : (
          <div className="flex items-center gap-2.5 min-w-[120px]" title={t('occupiedOfSellable', { occupied: s.rooms.occupied, sellable: s.rooms.sellable })}>
            <div className="w-[56px] shrink-0"><Meter value={s.occupancyRate} accent={accent} /></div>
            <span className="text-[13px] font-semibold text-ink" style={tabular}>{s.occupancyRate}%</span>
          </div>
        )}
      </td>
      <td className={num} style={tabular}>{s.adr ? formatCurrency(s.adr) : <span className="text-ink3">—</span>}</td>
      <td className={num} style={tabular}>{s.revpar ? formatCurrency(s.revpar) : <span className="text-ink3">—</span>}</td>
      <td className={num} style={tabular}>
        <span title={t('arrivalsToday')}>{s.arrivalsToday}</span>
        <span className="text-ink3 mx-1">/</span>
        <span title={t('departuresToday')}>{s.departuresToday}</span>
      </td>
      <td className={num} style={tabular}>{formatCurrency(s.collectedThisMonth)}</td>
      <td className={num} style={tabular}>
        {s.outstanding > 0
          ? <span className="font-semibold text-[var(--amber-text)]">{formatCurrency(s.outstanding)}</span>
          : <span className="text-ink3">—</span>}
      </td>
      <td>
        <div className="flex items-center justify-between gap-3">
          {noRooms ? <span className="text-ink3">—</span> : <MiniForecast forecast={s.forecast} sellable={s.rooms.sellable} accent={accent} />}
          <LuChevronRight size={16} className="text-ink3 shrink-0" aria-hidden />
        </div>
      </td>
    </tr>
  )
}

// Phone layout: the same row as a stacked card.
function PropertyCard({ p, accent, onOpen }) {
  const s = p.stats
  const { t } = useTranslation('portfolio')
  return (
    <button
      onClick={onOpen}
      className={`w-full min-w-0 text-left bg-surface border border-line rounded-[10px] p-4 cursor-pointer hover:border-line2 ${p.status === 'archived' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <CodeChip code={p.code} />
        <span className="t-title truncate flex-1 min-w-0">{p.name}</span>
        {p.status === 'archived' && <Pill tone="grey">{t('common:archived')}</Pill>}
        <LuChevronRight size={16} className="text-ink3 shrink-0" aria-hidden />
      </div>
      <div className="t-xs text-ink3 mt-1 mb-3 truncate">
        {s.rooms.total === 0 ? t('noRoomsYet') : t('roomsCount', { count: s.rooms.total })}{s.rooms.outOfOrder ? ` · ${t('outOfOrder', { count: s.rooms.outOfOrder })}` : ''} · {p.roleName}
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1"><Meter value={s.occupancyRate} accent={accent} /></div>
        <span className="text-[13px] font-semibold text-ink" style={tabular}>{s.occupancyRate}%</span>
        <span className="t-xs text-ink3" style={tabular}>{s.rooms.occupied}/{s.rooms.sellable}</span>
        {s.rooms.total > 0 && <span className="shrink-0" title={t('col.forecast')}><MiniForecast forecast={s.forecast} sellable={s.rooms.sellable} accent={accent} /></span>}
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 m-0">
        {[
          [t('col.adr'), s.adr ? formatCurrencyCompact(s.adr) : '—'],
          [t('col.revpar'), s.revpar ? formatCurrencyCompact(s.revpar) : '—'],
          [t('col.movements'), `${s.arrivalsToday} / ${s.departuresToday}`],
          [t('kpi.inHouse'), s.inHouse],
          [t('kpi.collected'), formatCurrencyCompact(s.collectedThisMonth)],
          [t('col.outstanding'), s.outstanding > 0 ? formatCurrencyCompact(s.outstanding) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-[0.05em] text-ink3 font-semibold">{k}</dt>
            <dd className="m-0 text-[13px] font-semibold text-ink truncate" style={tabular}>{v}</dd>
          </div>
        ))}
      </dl>
    </button>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

// ─── Filters ──────────────────────────────────────────────────────────────────

const initials = (name = '') =>
  name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

function Check({ checked, onChange, children, sub }) {
  return (
    <label className="flex items-center gap-2.5 px-2.5 min-h-10 pointer-coarse:min-h-11 rounded-lg cursor-pointer hover:bg-surface2 select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span className="w-[18px] h-[18px] shrink-0 rounded-[5px] border border-line2 bg-surface flex items-center justify-center text-[#1a1712]
                       peer-checked:bg-gold peer-checked:border-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold/40" aria-hidden>
        {checked && <LuCheck size={12} strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-ink truncate">{children}</span>
        {sub && <span className="block text-xs text-ink3 truncate">{sub}</span>}
      </span>
    </label>
  )
}

/**
 * Dashboard filters: which properties every figure covers (sent to the server,
 * which recomputes the totals), and how the comparison list is narrowed.
 */
function FilterPanel({ options, filters, onChange, onClear, onClose }) {
  const { t } = useTranslation('portfolio')
  const chosen = filters.properties.length ? filters.properties : options.map((p) => p.id)
  const toggle = (id, on) => {
    const next = on ? [...new Set([...chosen, id])] : chosen.filter((x) => x !== id)
    // Every property (or none) selected means no property filter.
    onChange({ properties: next.length === options.length || next.length === 0 ? [] : next })
  }
  return (
    <section className="min-w-0 flex flex-col max-h-full" aria-label={t('filters.aria')}>
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line">
        <div className="flex items-center gap-2 t-title"><LuFilter size={15} className="text-gold" aria-hidden /> {t('common:filters')}</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onClear} className="px-2.5 h-8 pointer-coarse:h-11 rounded-lg text-xs font-semibold text-ink3 hover:text-ink hover:bg-surface2">{t('common:clearAll')}</button>
          <button type="button" onClick={onClose} className="px-3 h-8 pointer-coarse:h-11 rounded-lg text-xs font-semibold bg-gold text-[#1a1712] hover:bg-[var(--gold2)]">{t('common:done')}</button>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_1fr] p-3 sm:p-4 overflow-y-auto overscroll-contain">
        <div className="min-w-0">
          <div className="flex items-center justify-between px-2.5 mb-1.5">
            <span className="t-label">{t('common:properties')}</span>
            <span className="text-xs text-ink3">{filters.properties.length ? t('filters.nOfM', { n: filters.properties.length, m: options.length }) : t('common:all')}</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto overscroll-contain">
            <Check checked={!filters.properties.length} onChange={(on) => on && onChange({ properties: [] })}>{t('common:allProperties')}</Check>
            {options.map((p) => (
              <Check key={p.id} checked={chosen.includes(p.id)} onChange={(on) => toggle(p.id, on)}>
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-surface2 text-ink2 text-xs font-bold flex items-center justify-center shrink-0" aria-hidden>{initials(p.name)}</span>
                  <span className="truncate">{p.name}</span>
                </span>
              </Check>
            ))}
          </div>
          <p className="t-xs text-ink3 px-2.5 mt-2 mb-0">{t('filters.propertiesNote')}</p>

        </div>
        <div className="min-w-0">
          <div className="t-label px-2.5 mb-2">{t('filters.propertyList')}</div>
          <div className="px-2.5 mb-1.5 text-xs text-ink2 font-medium">{t('hero.title')}</div>
          <div role="group" aria-label={t('hero.title')} className="flex flex-wrap gap-1.5 px-2.5 mb-3">
            {OCCUPANCY_BANDS.map((b) => (
              <button key={b.id} type="button" aria-pressed={filters.occupancy === b.id} onClick={() => onChange({ occupancy: b.id })}
                className={`px-3 h-8 pointer-coarse:h-10 rounded-full text-xs font-semibold border transition-colors ${
                  filters.occupancy === b.id ? 'bg-gold-bg border-gold text-gold' : 'bg-surface border-line2 text-ink2 hover:border-gold'}`}>
                {t(`band.${b.id}`)}
              </button>
            ))}
          </div>
          <Check checked={filters.attentionOnly} onChange={(on) => onChange({ attentionOnly: on })} sub={t('filters.attentionSub')}>
            {t('filters.attentionOnly')}
          </Check>
          <Check checked={filters.showArchived} onChange={(on) => onChange({ showArchived: on })} sub={t('filters.archivedSub')}>
            {t('filters.showArchived')}
          </Check>
        </div>
      </div>
    </section>
  )
}

// The filter panel as a popover under the header's Filters button (the ⋮ menu
// on phones, where it is a sheet from the bottom over a dimmed page). Closes on
// a click outside or Esc; the Filters button itself toggles it.
function FilterPopover({ onClose, children }) {
  const { t } = useTranslation('portfolio')
  const anchorSel = `.page-header button[aria-label="${t('common:filters')}"]`
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      const anchor = [...document.querySelectorAll(anchorSel)].find((el) => el.offsetParent)
      if (!anchor || window.innerWidth < 768) { setPos({ sheet: true }); return }
      const r = anchor.getBoundingClientRect()
      const width = Math.min(620, window.innerWidth - 32)
      setPos({ top: r.bottom + 10, left: Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16)), width, arrow: r.left + r.width / 2 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchorSel])

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return
      if (e.target.closest?.(anchorSel)) return // toggles itself
      onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchorSel])

  if (!pos) return null
  return createPortal(
    pos.sheet ? (
      <>
        <div className="fixed inset-0 z-[1590] bg-black/35 animate-[qvFade_.15s_ease-out]" aria-hidden />
        <div ref={ref} role="dialog" aria-label="Filters"
          className="fixed inset-x-0 bottom-0 z-[1600] max-h-[85dvh] flex flex-col bg-surface rounded-t-2xl shadow-[var(--shadow-md)]
                     pb-[env(safe-area-inset-bottom)] animate-[qvSheetIn_.2s_ease-out]">
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-line2 shrink-0" aria-hidden />
          {children}
        </div>
      </>
    ) : (
      <div ref={ref} role="dialog" aria-label="Filters"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        className="fixed z-[1600] max-h-[calc(100dvh-120px)] flex flex-col bg-surface border border-line rounded-2xl shadow-[var(--shadow-md)] animate-[qvPop_.14s_ease-out]">
        <span className="absolute -top-[7px] w-3 h-3 rotate-45 bg-surface border-l border-t border-line" style={{ left: pos.arrow - pos.left - 6 }} aria-hidden />
        {children}
      </div>
    ),
    document.body,
  )
}

// Active filters as removable chips (shown while the panel is closed).
function FilterChips({ chips, onClear }) {
  const { t } = useTranslation('portfolio')
  if (!chips.length) return null
  return (
    <div className="flex items-center gap-2 flex-wrap" aria-label={t('filters.active')}>
      {chips.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-gold-bg border border-gold-border text-xs font-semibold text-ink">
          {c.label}
          <button type="button" onClick={c.onRemove} aria-label={t('filters.remove', { label: c.label })}
            className="w-6 h-6 pointer-coarse:w-8 pointer-coarse:h-8 rounded-full flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface">
            <LuX size={13} />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="h-8 px-2 text-xs font-semibold text-ink3 hover:text-ink">{t('common:clearAll')}</button>
    </div>
  )
}

function Skeleton() {
  const { t } = useTranslation('portfolio')
  const block = 'rounded-[10px] bg-line animate-pulse'
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <div className={`${block} h-[180px]`} />
        <div className="hidden xl:flex flex-col gap-3 min-w-0">
          {[0, 1].map((i) => <div key={i} className={`${block} flex-1`} />)}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className={`${block} h-[290px]`} />
        <div className={`${block} h-[290px]`} />
      </div>
      <div className={`${block} h-[220px]`} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Portfolio — cross-property view in the shape hotel groups expect: tonight's
 * occupancy as the hero figure, the KPIs owners compare (ADR, RevPAR, movements,
 * collections, dues), a 14-night on-the-books forecast, what needs attention, and
 * a sortable property comparison. Selecting a property switches to it.
 */
export default function Portfolio() {
  const { t } = useTranslation('portfolio')
  const activePropertyId = useAppSelector((s) => s.auth.activePropertyId)
  const isOwner = useAppSelector((s) => !!s.auth.currentUser?.isOwner)
  const { setActiveProperty } = useAuthActions()
  const { setActivePanel, navigateTo, requestPrimaryAction, setDashboardScope } = useUiActions()
  const activeProperty = useAppSelector(selectActiveProperty)
  const scope = useAppSelector((s) => s.ui.dashboardScope)
  const accent = useCssVar('--chart-accent')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'occupancy', dir: 'desc' })
  // Chart periods, remembered per browser.
  const [period, setPeriod] = useState(() => {
    try { return { forecast: 14, trend: '30', ...JSON.parse(localStorage.getItem(PERIOD_KEY) || '{}') } } catch { return { forecast: 14, trend: '30' } }
  })
  const changePeriod = (next) => setPeriod((p) => {
    const v = { ...p, ...next }
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify(v)) } catch { /* private mode */ }
    return v
  })

  // `silent` refreshes (timer, tab focus) keep the figures on screen and stay
  // quiet on errors; a manual or first load shows the skeleton and the error.
  // Active properties this user can put on the dashboard (as the server allows:
  // owners everything, others where they can view reports), for the filter list.
  // Archived ones are never in the totals; "Show archived" lists them.
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const myProperties = useAppSelector(selectProperties)
  const filterOptions = useMemo(() => myProperties.filter((p) => p.status === 'active' &&
    (currentUser?.isOwner || p.isOwner || ['VIEW', 'MANAGE'].includes(p.permissions?.reports))), [myProperties, currentUser])

  // Filters, remembered per browser. Property ids no longer available are dropped.
  const [filterState, setFilterState] = useState(() => {
    try { return { ...NO_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') } } catch { return NO_FILTERS }
  })
  const filters = useMemo(() => {
    const ids = filterState.properties.filter((id) => filterOptions.some((p) => p.id === id))
    return { ...filterState, properties: ids.length === filterOptions.length ? [] : ids }
  }, [filterState, filterOptions])
  const changeFilters = (next) => setFilterState((f) => {
    const v = { ...f, ...next }
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(v)) } catch { /* private mode */ }
    return v
  })
  const clearFilters = () => changeFilters(NO_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const closeFilters = useCallback(() => setShowFilters(false), [])
  const propertyParam = filters.properties.join(',')

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(false) }
    try {
      const { data } = await propertiesApi.summary({ ...period, ...(propertyParam && { properties: propertyParam }) })
      setData(data)
      if (silent) setError(false)
    } catch {
      if (!silent) setError(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [period, propertyParam])

  useEffect(() => { load() }, [load])

  // Live: refresh every minute while the tab is visible, and straight away when
  // the user comes back to it.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') load({ silent: true }) }
    const timer = setInterval(tick, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  // KPI deep-links. They open the active property's pages: in single-property
  // scope that is the property shown; in the combined view it is whichever
  // property is active. Billing takes no filter param, so Collected just opens it.
  const goBookings = (tab) => navigateTo({ panel: 'bookings', params: { tab } })
  const goReports = () => navigateTo({ panel: 'reports', params: { tab: 'revenue' } })

  const open = (id, panel = 'today') => {
    if (id !== activePropertyId) setActiveProperty(id)
    setActivePanel(panel)
  }

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))

  const all = useMemo(() => data?.properties || [], [data])
  const needsAttention = useMemo(() => new Set(attentionItems(all).map((i) => i.property.id)), [all])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const col = COLUMNS.find((c) => c.key === sort.key)
    const band = OCCUPANCY_BANDS.find((b) => b.id === filters.occupancy) || OCCUPANCY_BANDS[0]
    return all
      .filter((p) => filters.showArchived || p.status === 'active')
      .filter((p) => band.test(p.stats.occupancyRate))
      .filter((p) => !filters.attentionOnly || needsAttention.has(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = col.get(a), bv = col.get(b)
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sort.dir === 'asc' ? cmp : -cmp
      })
  }, [all, query, filters, needsAttention, sort])

  // Removable chips for the filters in force.
  const filterChips = [
    filters.properties.length && { id: 'p', label: t('chips.properties', { n: filters.properties.length, m: filterOptions.length }), onRemove: () => changeFilters({ properties: [] }) },
    filters.occupancy !== 'all' && { id: 'o', label: t('chips.occupancy', { band: t(`band.${filters.occupancy}`, { defaultValue: '' }) }), onRemove: () => changeFilters({ occupancy: 'all' }) },
    filters.attentionOnly && { id: 'a', label: t('chips.attention'), onRemove: () => changeFilters({ attentionOnly: false }) },
    filters.showArchived && { id: 'r', label: t('chips.archived'), onRemove: () => changeFilters({ showArchived: false }) },
  ].filter(Boolean)

  // One property in scope: present its stats in the same shape as the portfolio
  // totals so every card renders either view unchanged.
  const scoped = scope === 'property'
  const scopedProperty = scoped ? all.find((p) => p.id === activePropertyId) : null
  const tot = !data ? null : scoped
    ? scopedProperty && {
      ...scopedProperty.stats,
      occupied: scopedProperty.stats.rooms.occupied,
      sellable: scopedProperty.stats.rooms.sellable,
      outOfOrder: scopedProperty.stats.rooms.outOfOrder,
      available: scopedProperty.stats.rooms.available,
      reserved: scopedProperty.stats.rooms.reserved,
      rooms: scopedProperty.stats.rooms.total,
      properties: 1,
    }
    : data.totals
  const scopeLabel = scoped ? (scopedProperty?.name || t('thisProperty'))
    : filters.properties.length ? t('scope.selected', { count: filters.properties.length }) : t('scope.allActive')
  const attention = useMemo(
    () => attentionItems(scoped ? all.filter((p) => p.id === activePropertyId) : all),
    [all, scoped, activePropertyId],
  )
  // Nothing on the books, in house, collected or due anywhere: show guidance
  // instead of a flat chart.
  const hasActivity = !!tot && (
    tot.forecast.some((n) => n.booked > 0) || tot.inHouse > 0 || tot.arrivalsToday > 0 ||
    tot.departuresToday > 0 || tot.collectedThisMonth > 0 || tot.outstanding > 0
  )
  const heading = scoped ? (scopedProperty?.name || activeProperty?.name || t('dashboard')) : t('title')
  const subtitle = tot
    ? scoped
      ? `${t('dashboard')} · ${t('roomsCount', { count: tot.rooms })} · ${t('liveUpdated', { time: timeLabel(data.generatedAt) })}`
      : `${filters.properties.length
        ? t('activePropertiesOf', { count: tot.properties, total: filterOptions.length })
        : t('activeProperties', { count: tot.properties })} · ${t('roomsCount', { count: tot.rooms })} · ${t('liveUpdated', { time: timeLabel(data.generatedAt) })}`
    : t('subtitle')
  // Title, search and buttons live in the page header bar (layout/PageHeader).
  usePageHeader({
    title: heading,
    subtitle,
    // The search filters the property comparison, which only the combined view shows.
    search: !scoped && all.length > 4 ? { value: query, onChange: setQuery, placeholder: t('searchProperties') } : null,
    actions: [
      scoped && { id: 'scope', label: t('common:allProperties'), icon: <LuLayers />, onClick: () => setDashboardScope('all') },
      // Filters apply to the combined view (a single property needs none).
      !scoped && filterOptions.length > 1 && {
        id: 'filters', label: t('common:filters'), icon: <LuFilter />, active: showFilters, badge: filterChips.length,
        onClick: () => setShowFilters((v) => !v),
      },
      { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: () => load() },
      !scoped && isOwner && {
        id: 'add', label: t('addProperty'), icon: <LuPlus />, variant: 'primary',
        onClick: () => navigateTo({ panel: 'settings', params: { tab: 'properties' } }),
      },
    ],
  })

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-[10px] bg-danger-bg text-danger-text t-sm" role="alert">
          {t('loadError')}
          <button className="btn btn-sm btn-outline" onClick={() => load()}>{t('common:retry')}</button>
        </div>
      )}

      {!scoped && showFilters && (
        <FilterPopover onClose={closeFilters}>
          <FilterPanel options={filterOptions} filters={filters} onChange={changeFilters} onClear={clearFilters} onClose={closeFilters} />
        </FilterPopover>
      )}
      {!scoped && <FilterChips chips={filterChips} onClear={clearFilters} />}

      {!data && loading && <Skeleton />}

      {data && scoped && !scopedProperty && (
        <div className="bg-surface border border-line rounded-[10px] py-12 px-6 text-center">
          <div className="t-sm text-ink font-semibold">{t('noAccess.title')}</div>
          <div className="t-xs text-ink3 mt-1 mb-4">{t('noAccess.text', { name: activeProperty?.name || t('thisProperty') })}</div>
          <button className="btn btn-outline btn-sm" onClick={() => setDashboardScope('all')}>{t('noAccess.viewAll')}</button>
        </div>
      )}

      {tot && (
        <>
          {/* Hero + KPIs */}
          {/* Hero + KPIs. The KPI strips (two rows of three) show from xl and
              deep-link to the active property's pages; below xl only the hero
              stays, full width. */}
          <section className="grid gap-4 xl:grid-cols-[300px_1fr]" aria-label={t('keyFigures')}>
            <HeroOccupancy totals={tot} accent={accent} />
            <div className="hidden xl:flex flex-col gap-3 min-w-0">
              <StatStrip className="flex-1">
                <KpiTile icon={LuBedDouble} tone="gold" label={t('col.adr')} value={tot.adr ? formatCurrency(tot.adr) : '—'} sub={t('kpi.adrSub')} onClick={goReports} />
                <KpiTile icon={LuTrendingUp} tone="blue" label={t('col.revpar')} value={tot.revpar ? formatCurrency(tot.revpar) : '—'} sub={t('kpi.revparSub')} onClick={goReports} />
                <KpiTile icon={LuUsers} tone="green" label={t('kpi.inHouse')} value={tot.inHouse} sub={t('kpi.inHouseSub', { count: tot.occupied })} onClick={() => goBookings('CheckedIn')} />
              </StatStrip>
              <StatStrip className="flex-1">
                <KpiTile icon={LuLogIn} tone="purple" label={t('kpi.arrivals')} value={tot.arrivalsToday} sub={t('kpi.arrivalsSub', { count: tot.departuresToday })} onClick={() => goBookings('Upcoming')} />
                <KpiTile icon={LuWallet} tone="green" label={t('kpi.collected')} value={formatCurrency(tot.collectedThisMonth)} sub={t('kpi.collectedSub', { amount: formatCurrency(tot.collectedToday) })} onClick={() => navigateTo({ panel: 'billing', params: { status: 'Paid' } })} />
                <KpiTile icon={LuCircleAlert} tone="amber" label={t('col.outstanding')} value={formatCurrency(tot.outstanding)} sub={tot.outstanding > 0 ? t('kpi.outstandingSub') : t('kpi.nothingDue')} onClick={() => goBookings('Dues')} />
              </StatStrip>
            </div>
          </section>

          {/* Forecast + room status */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            {hasActivity
              ? <ForecastChart totals={tot} accent={accent} scopeLabel={scopeLabel} period={period.forecast} onNights={(n) => changePeriod({ forecast: n })} />
              : (
                <ForecastEmpty
                  noRooms={tot.rooms === 0}
                  propertyName={activeProperty?.name}
                  onNewBooking={() => requestPrimaryAction('bookings')}
                  onAddRooms={() => setActivePanel('rooms')}
                  nights={period.forecast}
                  onNights={(n) => changePeriod({ forecast: n })}
                />
              )}
            <RoomStatusCard view={tot} />
          </section>

          {/* Money */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <CollectionsChart series={tot.collections || []} accent={accent} trend={period.trend} onTrend={(v) => changePeriod({ trend: v })} />
            <PaymentMethodsCard methods={tot.paymentMethods || []} accent={accent} />
          </section>

          {/* Room types + attention */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <RoomTypesCard types={tot.roomTypes || []} accent={accent} />
            <AttentionList items={attention} onOpen={open} />
          </section>

          {/* Comparison — combined view only */}
          {!scoped && <section className="bg-surface border border-line rounded-[10px] min-w-0" aria-label={t('comparison.aria')}>
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 pt-4 pb-3">
              <div className="min-w-0">
                <div className="t-title">{t('common:properties')}</div>
                <div className="t-xs text-ink3 mt-0.5">{t('comparison.sub')}</div>
              </div>
              <div className="flex items-center gap-x-3 gap-y-2 flex-wrap w-full sm:w-auto">
                {/* Below 2xl the rows are cards, so sorting moves into a select */}
                <div className="2xl:hidden flex items-center gap-1.5">
                  <label htmlFor="pf-sort" className="sr-only">{t('comparison.sortLabel')}</label>
                  <select
                    id="pf-sort"
                    className="form-select py-1.5 pr-8 text-[12.5px] focus:ring-gold/20 focus:border-gold"
                    value={sort.key}
                    onChange={(e) => onSort(e.target.value)}
                  >
                    {COLUMNS.filter((c) => c.sortable !== false).map((c) => <option key={c.key} value={c.key}>{t('comparison.sortBy', { label: t(`col.${c.key}`) })}</option>)}
                  </select>
                  <button
                    onClick={() => onSort(sort.key)}
                    className="bg-transparent border border-line2 rounded-lg w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center cursor-pointer text-ink2 shrink-0"
                    aria-label={sort.dir === 'asc' ? t('comparison.ascSwitch') : t('comparison.descSwitch')}
                    title={sort.dir === 'asc' ? t('comparison.asc') : t('comparison.desc')}
                  >
                    {sort.dir === 'asc' ? <LuArrowUp size={14} aria-hidden /> : <LuArrowDown size={14} aria-hidden />}
                  </button>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state py-10">
                {query ? t('comparison.noMatchQuery', { query }) : t('comparison.noMatchFilters')}
                {filterChips.length > 0 && <button type="button" onClick={clearFilters} className="block mx-auto mt-2 text-gold text-xs font-semibold">{t('comparison.clearFilters')}</button>}
              </div>
            ) : (
              <>
                <div className="hidden 2xl:block overflow-x-auto border-t border-line">
                  <table className="pf-table">
                    <thead>
                      <tr>{COLUMNS.map((c) => <SortHeader key={c.key} col={c} sort={sort} onSort={onSort} />)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <PropertyRow key={p.id} p={p} accent={accent} onOpen={() => open(p.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="2xl:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 px-4 pb-4">
                  {rows.map((p) => (
                    <PropertyCard key={p.id} p={p} accent={accent} onOpen={() => open(p.id)} />
                  ))}
                </div>
              </>
            )}
          </section>}
        </>
      )}
    </div>
  )
}
