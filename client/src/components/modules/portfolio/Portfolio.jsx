import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  LuRefreshCw, LuPlus, LuSearch, LuChevronRight, LuArrowUp, LuArrowDown, LuChevronsUpDown,
  LuTriangleAlert, LuWrench, LuCalendarCheck, LuCircleCheck, LuCalendarPlus, LuDoorOpen, LuLayers, LuWallet,
} from 'react-icons/lu'
import { useAppSelector, useAuthActions, useUiActions } from '../../../store/hooks'
import { selectActiveProperty } from '../../../store/slices/authSlice'
import { propertiesApi } from '../../../api/client'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'
import TopbarSlot from '../../layout/TopbarSlot'

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
const nightLabel = (iso, i) =>
  i === 0 ? 'Tonight' : new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

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
  const nights = forecast.slice(0, 7)
  const W = 8, GAP = 3, H = 26
  return (
    <svg
      width={nights.length * (W + GAP) - GAP}
      height={H}
      role="img"
      aria-label={`Next 7 nights: ${nights.map((n, i) => `${nightLabel(n.date, i)} ${pct(n.booked, sellable)}%`).join(', ')}`}
    >
      {nights.map((n, i) => {
        const h = Math.max(2, Math.round((pct(n.booked, sellable) / 100) * H))
        return (
          <g key={n.date}>
            <rect x={i * (W + GAP)} y={0} width={W} height={H} rx={2} fill="var(--chart-track)" />
            <rect x={i * (W + GAP)} y={H - h} width={W} height={h} rx={2} fill={accent} opacity={i === 0 ? 1 : 0.6} />
            <title>{`${nightLabel(n.date, i)} · ${n.booked} of ${sellable} rooms · ${pct(n.booked, sellable)}%`}</title>
          </g>
        )
      })}
    </svg>
  )
}

// ─── KPI header ───────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] px-4 py-3.5 min-w-0">
      <div className="flex items-center gap-1.5 t-label">
        {Icon && <Icon size={13} className="text-ink3" aria-hidden />}
        {label}
      </div>
      <div className="text-[22px] font-bold text-ink mt-1.5 leading-none truncate" style={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div className="t-xs text-ink3 mt-1.5 truncate">{sub}</div>}
    </div>
  )
}

function HeroOccupancy({ totals, accent }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="t-label">Occupancy tonight</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-[52px] font-bold text-ink leading-none" style={{ letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {totals.occupancyRate}
          </span>
          <span className="text-[22px] font-semibold text-ink2">%</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Meter value={totals.occupancyRate} accent={accent} height={8} />
        <div className="t-xs text-ink3">
          <strong className="text-ink2">{totals.occupied}</strong> of {totals.sellable} sellable rooms
          {totals.outOfOrder ? ` · ${totals.outOfOrder} out of order` : ''}
          {totals.properties > 1 ? ` · ${totals.properties} properties` : ''}
        </div>
      </div>
    </div>
  )
}

// ─── Forecast chart ───────────────────────────────────────────────────────────

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface border border-line rounded-lg shadow-[var(--shadow-md)] px-3 py-2">
      <div className="text-[11.5px] text-ink3">{d.longLabel}</div>
      <div className="text-[14px] font-bold text-ink mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.pct}% occupied</div>
      <div className="text-[11.5px] text-ink2">{d.booked} of {d.sellable} rooms on the books</div>
    </div>
  )
}

// Shown in place of the chart when nothing is booked across the next 14 nights.
function ForecastEmpty({ noRooms, propertyName, onNewBooking, onAddRooms }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-5 min-w-0 flex flex-col">
      <div className="t-title">On the books · next 14 nights</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
        <span className="w-11 h-11 rounded-xl bg-surface2 text-ink3 flex items-center justify-center mb-1">
          {noRooms ? <LuDoorOpen size={20} aria-hidden /> : <LuCalendarPlus size={20} aria-hidden />}
        </span>
        <div className="t-sm text-ink font-semibold">{noRooms ? 'No rooms set up yet' : 'No bookings yet'}</div>
        <div className="t-xs text-ink3 max-w-[340px]">
          {noRooms
            ? 'Add rooms to a property to start tracking occupancy and revenue here.'
            : 'Occupancy, revenue and the 14-night forecast will appear here as soon as bookings come in.'}
        </div>
        {noRooms
          ? <button className="btn btn-outline btn-sm mt-2" onClick={onAddRooms}>Set up rooms</button>
          : <button className="btn btn-primary btn-sm mt-2" onClick={onNewBooking}><LuPlus size={14} aria-hidden /> New booking{propertyName ? ` at ${propertyName}` : ''}</button>}
      </div>
    </div>
  )
}

function ForecastChart({ totals, accent, scopeLabel }) {
  const data = totals.forecast.map((n, i) => ({
    label: nightLabel(n.date, i),
    longLabel: i === 0 ? `Tonight · ${longDate(n.date)}` : longDate(n.date),
    booked: n.booked,
    sellable: totals.sellable,
    pct: pct(n.booked, totals.sellable),
  }))
  const peak = data.reduce((m, d) => (d.pct > m.pct ? d : m), data[0] || { pct: 0 })
  return (
    <div className="bg-surface border border-line rounded-[10px] p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="t-title">On the books · next 14 nights</div>
          <div className="t-xs text-ink3 mt-0.5">Share of sellable rooms booked, {scopeLabel}</div>
        </div>
        {peak && (
          <div className="sm:text-right">
            <div className="t-label">Peak</div>
            <div className="text-[13px] font-semibold text-ink">{peak.pct}% <span className="text-ink3 font-normal">· {peak.label}</span></div>
          </div>
        )}
      </div>
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd"
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
    <div className={`bg-surface border border-line rounded-[10px] p-5 min-w-0 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
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
const ROOM_STATES = [
  { key: 'occupied',   label: 'Occupied',     color: 'var(--red)'   },
  { key: 'reserved',   label: 'Reserved',     color: 'var(--blue)'  },
  { key: 'available',  label: 'Available',    color: 'var(--green)' },
  { key: 'outOfOrder', label: 'Out of order', color: 'var(--amber)' },
]

function RoomStatusCard({ view }) {
  const total = view.rooms
  const counts = { occupied: view.occupied, reserved: view.reserved || 0, available: view.available || 0, outOfOrder: view.outOfOrder || 0 }
  const stays = view.stayMix || { daily: 0, monthly: 0 }
  return (
    <Card title="Room status" sub={`${total} rooms right now`}>
      {total === 0 ? (
        <CardEmpty icon={LuDoorOpen} title="No rooms yet" text="Add rooms to see how they are being used." />
      ) : (
        <>
          <div className="flex h-3 gap-[2px] rounded-full overflow-hidden bg-[var(--chart-track)]" role="img"
            aria-label={ROOM_STATES.map((st) => `${counts[st.key]} ${st.label.toLowerCase()}`).join(', ')}>
            {ROOM_STATES.filter((st) => counts[st.key] > 0).map((st) => (
              <span key={st.key} title={`${st.label}: ${counts[st.key]} of ${total}`}
                style={{ width: `${(counts[st.key] / total) * 100}%`, background: st.color }} />
            ))}
          </div>
          <ul className="list-none m-0 p-0 mt-4 flex flex-col gap-2.5">
            {ROOM_STATES.map((st) => (
              <li key={st.key} className="flex items-center gap-2.5 text-[12.5px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: st.color }} aria-hidden />
                <span className="text-ink2 flex-1">{st.label}</span>
                <span className="font-semibold text-ink" style={tabular}>{counts[st.key]}</span>
                <span className="text-ink3 w-11 text-right" style={tabular}>{pct(counts[st.key], total)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-line t-xs text-ink3 flex justify-between gap-2">
            <span>In-house stays</span>
            <span><strong className="text-ink2" style={tabular}>{stays.daily}</strong> daily · <strong className="text-ink2" style={tabular}>{stays.monthly}</strong> monthly</span>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Collections trend ────────────────────────────────────────────────────────

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function CollectionsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface border border-line rounded-lg shadow-[var(--shadow-md)] px-3 py-2">
      <div className="text-[11.5px] text-ink3">{longDate(d.date)}</div>
      <div className="text-[14px] font-bold text-ink mt-0.5" style={tabular}>{formatCurrency(d.amount)}</div>
      <div className="text-[11.5px] text-ink2">collected</div>
    </div>
  )
}

function CollectionsChart({ series, accent }) {
  const total = series.reduce((n, d) => n + d.amount, 0)
  const days = series.filter((d) => d.amount > 0).length
  const best = series.reduce((m, d) => (d.amount > m.amount ? d : m), series[0] || { amount: 0 })
  return (
    <Card
      title={`Collections · last ${series.length} days`}
      sub="Payments received per day"
      aside={total > 0 && (
        <div className="sm:text-right shrink-0">
          <div className="t-label">Total</div>
          <div className="text-[13px] font-semibold text-ink" style={tabular}>{formatCurrency(total)}</div>
        </div>
      )}
    >
      {total === 0 ? (
        <CardEmpty icon={LuWallet} title="No payments yet" text={`Nothing collected in the last ${series.length} days. Payments recorded on bookings show up here.`} />
      ) : (
        <>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} interval={6}
                  tick={{ fontSize: 10.5, fill: 'var(--text3)' }} />
                <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tickLine={false} axisLine={false} width={52}
                  tick={{ fontSize: 10.5, fill: 'var(--text3)' }} />
                <Tooltip content={<CollectionsTooltip />} cursor={{ fill: 'var(--chart-track)' }} />
                <Bar dataKey="amount" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 flex-wrap mt-3 t-xs text-ink3">
            <span>Avg / day <strong className="text-ink2" style={tabular}>{formatCurrency(Math.round(total / series.length))}</strong></span>
            <span>Days with payments <strong className="text-ink2" style={tabular}>{days}</strong></span>
            {best.amount > 0 && <span>Best day <strong className="text-ink2">{shortDate(best.date)}</strong></span>}
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Payment methods ──────────────────────────────────────────────────────────

const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer', bank_transfer: 'Bank transfer', cheque: 'Cheque', online: 'Online', other: 'Other' }
const methodLabel = (m) => METHOD_LABEL[m?.toLowerCase()] || (m ? m[0].toUpperCase() + m.slice(1) : 'Other')

function PaymentMethodsCard({ methods, accent }) {
  const rows = [...methods].sort((a, b) => b.amount - a.amount)
  const total = rows.reduce((n, m) => n + m.amount, 0)
  const max = rows[0]?.amount || 1
  return (
    <Card title="Payment methods" sub="Collected this month">
      {total === 0 ? (
        <CardEmpty icon={LuWallet} title="No payments this month" text="The split between cash, UPI, card and others appears here." />
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
          {rows.map((m) => (
            <li key={m.method}>
              <div className="flex items-baseline justify-between gap-2 text-[12.5px] mb-1.5">
                <span className="text-ink2">{methodLabel(m.method)}</span>
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
  const rows = [...types].sort((a, b) => b.total - a.total)
  return (
    <Card title="Occupancy by room type" sub="Occupied rooms of each type tonight">
      {rows.length === 0 ? (
        <CardEmpty icon={LuDoorOpen} title="No room types yet" text="Once rooms are added, see which types fill up first." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {rows.map((t) => (
            <div key={t.type} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px] mb-1.5">
                <span className="text-ink font-medium truncate">{t.type}</span>
                <span style={tabular}>
                  <strong className="text-ink">{pct(t.occupied, t.total)}%</strong>
                  <span className="text-ink3 ml-1.5">{t.occupied} / {t.total}</span>
                </span>
              </div>
              <Meter value={pct(t.occupied, t.total)} accent={accent} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Needs attention ──────────────────────────────────────────────────────────

const SEVERITY = {
  critical: { Icon: LuTriangleAlert, color: 'var(--red-text)',   bg: 'var(--red-bg)',   label: 'Critical' },
  warning:  { Icon: LuTriangleAlert, color: 'var(--amber-text)', bg: 'var(--amber-bg)', label: 'Warning' },
  info:     { Icon: LuCalendarCheck, color: 'var(--blue-text)',  bg: 'var(--blue-bg)',  label: 'Info' },
}

// Derive actionable items from the stats — highest severity first.
function attentionItems(properties) {
  const items = []
  for (const p of properties) {
    if (p.status !== 'active') continue
    const s = p.stats
    if (s.arrivalsToday > s.rooms.available) {
      items.push({ severity: 'critical', property: p, panel: 'bookings', Icon: LuTriangleAlert,
        text: `${s.arrivalsToday} arrivals today but only ${s.rooms.available} rooms available` })
    }
    if (s.rooms.outOfOrder > 0) {
      items.push({ severity: 'warning', property: p, panel: 'maintenance', Icon: LuWrench,
        text: `${s.rooms.outOfOrder} ${s.rooms.outOfOrder === 1 ? 'room' : 'rooms'} out of order` })
    }
    if (s.outstanding > 0) {
      items.push({ severity: 'warning', property: p, panel: 'billing', Icon: LuTriangleAlert,
        text: `${formatCurrency(s.outstanding)} outstanding` })
    }
    const soldOut = s.forecast.slice(1).find((n) => s.rooms.sellable && n.booked >= s.rooms.sellable)
    if (soldOut) {
      items.push({ severity: 'info', property: p, panel: 'bookings', Icon: LuCalendarCheck,
        text: `Fully booked on ${longDate(soldOut.date)}` })
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity])
}

function AttentionList({ items, onOpen }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-5 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="t-title">Needs attention</div>
        {items.length > 0 && <span className="t-xs text-ink3">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
          <LuCircleCheck size={22} className="text-success" aria-hidden />
          <div className="t-sm text-ink2 font-medium">All clear</div>
          <div className="t-xs text-ink3">No dues, out-of-order rooms or overbooking risks.</div>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-1 overflow-y-auto max-h-[230px] -mx-2">
          {items.map((it, i) => {
            const sev = SEVERITY[it.severity]
            return (
              <li key={i}>
                <button
                  onClick={() => onOpen(it.property.id, it.panel)}
                  className="w-full flex items-start gap-2.5 text-left bg-transparent border-none rounded-lg px-2 py-2 cursor-pointer hover:bg-surface2"
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-px" style={{ background: sev.bg, color: sev.color }}>
                    <it.Icon size={13} aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] text-ink leading-[1.35]">{it.text}</span>
                    <span className="flex items-center gap-1.5 mt-0.5 text-[11px] text-ink3">
                      <span className="sr-only">{sev.label}: </span>
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

const COLUMNS = [
  { key: 'name',        label: 'Property',     get: (p) => p.name.toLowerCase(), align: 'left' },
  { key: 'occupancy',   label: 'Occupancy',    get: (p) => p.stats.occupancyRate, align: 'left' },
  { key: 'adr',         label: 'ADR',          get: (p) => p.stats.adr, title: 'Average daily rate — room revenue ÷ rooms sold tonight' },
  { key: 'revpar',      label: 'RevPAR',       get: (p) => p.stats.revpar, title: 'Revenue per available room — room revenue ÷ sellable rooms' },
  { key: 'movements',   label: 'Arr / Dep',    get: (p) => p.stats.arrivalsToday + p.stats.departuresToday, title: 'Arrivals and departures today' },
  { key: 'collected',   label: 'Collected MTD', get: (p) => p.stats.collectedThisMonth },
  { key: 'outstanding', label: 'Outstanding',  get: (p) => p.stats.outstanding },
  { key: 'forecast',    label: 'Next 7 nights', sortable: false, align: 'left' },
]

function SortHeader({ col, sort, onSort }) {
  const active = sort.key === col.key
  const Icon = !active ? LuChevronsUpDown : sort.dir === 'asc' ? LuArrowUp : LuArrowDown
  const alignRight = col.align !== 'left'
  if (col.sortable === false) return <th className={alignRight ? 'text-right' : ''}>{col.label}</th>
  return (
    <th className={alignRight ? 'text-right' : ''} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={col.title}>
      <button
        onClick={() => onSort(col.key)}
        className={`inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer uppercase tracking-[inherit] text-[length:inherit] font-[inherit] ${active ? 'text-ink' : 'text-[inherit]'} ${alignRight ? 'flex-row-reverse' : ''}`}
      >
        {col.label}
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
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      tabIndex={0}
      aria-label={`Open ${p.name}`}
      className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${archived ? 'opacity-60' : ''}`}
    >
      <td>
        <div className="flex items-center gap-2.5 min-w-[190px]">
          <CodeChip code={p.code} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="t-title truncate">{p.name}</span>
              {archived && <Pill tone="grey">Archived</Pill>}
            </div>
            <div className="t-xs text-ink3 mt-px">
              {noRooms ? 'No rooms yet' : `${s.rooms.total} rooms`}{s.rooms.outOfOrder ? ` · ${s.rooms.outOfOrder} out of order` : ''} · {p.roleName}
            </div>
          </div>
        </div>
      </td>
      <td>
        {noRooms ? (
          <span className="t-xs text-ink3">Add rooms to start</span>
        ) : (
          <div className="flex items-center gap-2.5 min-w-[120px]" title={`${s.rooms.occupied} of ${s.rooms.sellable} sellable rooms occupied`}>
            <div className="w-[56px] shrink-0"><Meter value={s.occupancyRate} accent={accent} /></div>
            <span className="text-[13px] font-semibold text-ink" style={tabular}>{s.occupancyRate}%</span>
          </div>
        )}
      </td>
      <td className={num} style={tabular}>{s.adr ? formatCurrency(s.adr) : <span className="text-ink3">—</span>}</td>
      <td className={num} style={tabular}>{s.revpar ? formatCurrency(s.revpar) : <span className="text-ink3">—</span>}</td>
      <td className={num} style={tabular}>
        <span title="Arrivals today">{s.arrivalsToday}</span>
        <span className="text-ink3 mx-1">/</span>
        <span title="Departures today">{s.departuresToday}</span>
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
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-surface border border-line rounded-[10px] p-4 cursor-pointer ${p.status === 'archived' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <CodeChip code={p.code} />
        <span className="t-title truncate flex-1">{p.name}</span>
        <LuChevronRight size={16} className="text-ink3 shrink-0" aria-hidden />
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1"><Meter value={s.occupancyRate} accent={accent} /></div>
        <span className="text-[13px] font-semibold text-ink" style={tabular}>{s.occupancyRate}%</span>
        <span className="t-xs text-ink3" style={tabular}>{s.rooms.occupied}/{s.rooms.sellable}</span>
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 m-0">
        {[
          ['ADR', s.adr ? formatCurrencyCompact(s.adr) : '—'],
          ['RevPAR', s.revpar ? formatCurrencyCompact(s.revpar) : '—'],
          ['Arr / Dep', `${s.arrivalsToday} / ${s.departuresToday}`],
          ['In-house', s.inHouse],
          ['Collected', formatCurrencyCompact(s.collectedThisMonth)],
          ['Outstanding', s.outstanding > 0 ? formatCurrencyCompact(s.outstanding) : '—'],
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

function Skeleton() {
  const block = 'rounded-[10px] bg-line animate-pulse'
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading portfolio">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className={`${block} h-[180px]`} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className={`${block} h-[84px]`} />)}
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
  const activePropertyId = useAppSelector((s) => s.auth.activePropertyId)
  const isOwner = useAppSelector((s) => !!s.auth.currentUser?.isOwner)
  const { setActiveProperty } = useAuthActions()
  const { setActivePanel, navigateTo, requestPrimaryAction, setDashboardScope } = useUiActions()
  const activeProperty = useAppSelector(selectActiveProperty)
  const scope = useAppSelector((s) => s.ui.dashboardScope)
  const accent = useCssVar('--chart-accent')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [sort, setSort] = useState({ key: 'occupancy', dir: 'desc' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await propertiesApi.summary()
      setData(data)
    } catch {
      setError('We couldn\'t load your properties. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const open = (id, panel = 'today') => {
    if (id !== activePropertyId) setActiveProperty(id)
    setActivePanel(panel)
  }

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))

  const all = useMemo(() => data?.properties || [], [data])
  const archivedCount = all.filter((p) => p.status === 'archived').length
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const col = COLUMNS.find((c) => c.key === sort.key)
    return all
      .filter((p) => showArchived || p.status === 'active')
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = col.get(a), bv = col.get(b)
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sort.dir === 'asc' ? cmp : -cmp
      })
  }, [all, query, showArchived, sort])

  // One property in scope: present its stats in the same shape as the portfolio
  // totals so every card renders either view unchanged.
  const scoped = scope === 'property'
  const scopedProperty = scoped ? all.find((p) => p.id === activePropertyId) : null
  const t = !data ? null : scoped
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
  const scopeLabel = scoped ? (scopedProperty?.name || 'this property') : 'all active properties'
  const attention = useMemo(
    () => attentionItems(scoped ? all.filter((p) => p.id === activePropertyId) : all),
    [all, scoped, activePropertyId],
  )
  // Nothing on the books, in house, collected or due anywhere: show guidance
  // instead of a flat chart.
  const hasActivity = !!t && (
    t.forecast.some((n) => n.booked > 0) || t.inHouse > 0 || t.arrivalsToday > 0 ||
    t.departuresToday > 0 || t.collectedThisMonth > 0 || t.outstanding > 0
  )
  const heading = scoped ? (scopedProperty?.name || activeProperty?.name || 'Dashboard') : 'Portfolio'
  const subtitle = t
    ? scoped
      ? `Dashboard · ${t.rooms} rooms · updated ${timeLabel(data.generatedAt)}`
      : `${t.properties} active ${t.properties === 1 ? 'property' : 'properties'} · ${t.rooms} rooms · updated ${timeLabel(data.generatedAt)}`
    : 'How every property is doing tonight'
  const refreshButton = (
    // Same shape as the topbar's search / notification icon buttons beside it.
    <button
      onClick={load} disabled={loading} aria-label="Refresh" title="Refresh"
      className="bg-transparent border border-line2 rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer text-ink2 shrink-0 transition-all duration-[140ms] hover:border-gold hover:text-gold disabled:opacity-60"
    >
      <LuRefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
    </button>
  )
  const allButton = scoped && (
    <button className="btn btn-outline btn-sm gap-[5px]" onClick={() => setDashboardScope('all')}>
      <LuLayers size={14} aria-hidden /> All properties
    </button>
  )
  const addButton = !scoped && isOwner && (
    <button className="btn btn-primary btn-sm gap-[5px]" onClick={() => navigateTo({ panel: 'settings', params: { tab: 'properties' } })}>
      <LuPlus size={15} aria-hidden /> Add property
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header — shares the topbar row on desktop (TopbarSlot); in-page on phones,
          where the topbar is too narrow. */}
      <TopbarSlot name="title">
        <div className="flex items-baseline gap-3 min-w-0 pl-4 border-l border-line">
          <h1 className="text-[15px] font-bold text-ink m-0 tracking-[-0.01em] whitespace-nowrap">{heading}</h1>
          <span className="t-xs text-ink3 truncate">{subtitle}</span>
        </div>
      </TopbarSlot>
      <TopbarSlot name="actions">{allButton}{refreshButton}</TopbarSlot>
      {addButton && <TopbarSlot name="primary">{addButton}</TopbarSlot>}

      <div className="md:hidden flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-h1 m-0 tracking-[-0.02em]">{heading}</h1>
          <p className="t-sm mt-[3px] mb-0 text-ink3">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">{allButton}{refreshButton}{addButton}</div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-[10px] bg-danger-bg text-danger-text t-sm" role="alert">
          {error}
          <button className="btn btn-sm btn-outline" onClick={load}>Try again</button>
        </div>
      )}

      {!data && loading && <Skeleton />}

      {data && scoped && !scopedProperty && (
        <div className="bg-surface border border-line rounded-[10px] py-12 px-6 text-center">
          <div className="t-sm text-ink font-semibold">No dashboard for this property</div>
          <div className="t-xs text-ink3 mt-1 mb-4">You need report access at {activeProperty?.name || 'this property'} to see its figures.</div>
          <button className="btn btn-outline btn-sm" onClick={() => setDashboardScope('all')}>View all properties</button>
        </div>
      )}

      {t && (
        <>
          {/* Hero + KPIs */}
          <section className="grid gap-4 lg:grid-cols-[300px_1fr]" aria-label="Key figures">
            <HeroOccupancy totals={t} accent={accent} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiTile label="ADR" value={t.adr ? formatCurrency(t.adr) : '—'} sub="Avg. rate per room sold" />
              <KpiTile label="RevPAR" value={t.revpar ? formatCurrency(t.revpar) : '—'} sub="Revenue per available room" />
              <KpiTile label="In-house" value={t.inHouse} sub={`${t.occupied} rooms occupied`} />
              <KpiTile label="Arrivals" value={t.arrivalsToday} sub={`${t.departuresToday} departures today`} />
              <KpiTile label="Collected" value={formatCurrency(t.collectedThisMonth)} sub={`This month · ${formatCurrency(t.collectedToday)} today`} />
              <KpiTile label="Outstanding" value={formatCurrency(t.outstanding)} sub={t.outstanding > 0 ? 'Unpaid invoices' : 'Nothing due'} />
            </div>
          </section>

          {/* Forecast + room status */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            {hasActivity
              ? <ForecastChart totals={t} accent={accent} scopeLabel={scopeLabel} />
              : (
                <ForecastEmpty
                  noRooms={t.rooms === 0}
                  propertyName={activeProperty?.name}
                  onNewBooking={() => requestPrimaryAction('bookings')}
                  onAddRooms={() => setActivePanel('rooms')}
                />
              )}
            <RoomStatusCard view={t} />
          </section>

          {/* Money */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <CollectionsChart series={t.collections || []} accent={accent} />
            <PaymentMethodsCard methods={t.paymentMethods || []} accent={accent} />
          </section>

          {/* Room types + attention */}
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <RoomTypesCard types={t.roomTypes || []} accent={accent} />
            <AttentionList items={attention} onOpen={open} />
          </section>

          {/* Comparison — combined view only */}
          {!scoped && <section className="bg-surface border border-line rounded-[10px] min-w-0" aria-label="Property comparison">
            <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4 pb-3">
              <div>
                <div className="t-title">Properties</div>
                <div className="t-xs text-ink3 mt-0.5">Tonight's figures · select a property to open it</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {archivedCount > 0 && (
                  <label className="flex items-center gap-1.5 t-xs text-ink2 cursor-pointer select-none">
                    <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--gold)]" />
                    Show archived ({archivedCount})
                  </label>
                )}
                {all.length > 4 && (
                  <div className="relative">
                    <LuSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3" aria-hidden />
                    <input
                      className="form-input pl-8 py-1.5 text-[12.5px] w-[200px]"
                      placeholder="Search properties"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search properties"
                    />
                  </div>
                )}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state py-10">No properties match “{query}”.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto border-t border-line">
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
                <div className="md:hidden flex flex-col gap-2.5 px-4 pb-4">
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
