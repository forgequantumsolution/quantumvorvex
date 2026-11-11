import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, Bar, Line, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  LuTrendingUp, LuTrendingDown, LuTriangleAlert, LuClock, LuCircleCheck, LuCalculator, LuPercent, LuScale,
  LuLightbulb, LuChevronRight, LuArrowUp, LuArrowDown, LuChevronsUpDown,
} from 'react-icons/lu'
import { Card, DataTable, EmptyState } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { appLocale } from '../../../i18n'

// ── Colours ───────────────────────────────────────────────────────────────────
// Chart colours live in CSS variables with a light and a dark step, each set run
// through the dataviz palette validator against the card surface (#ffffff light,
// #1a1a18 dark):
//  · expenses = brand gold (light #a8862e = --chart-accent, dark #b0903a: #c9a84c is
//    too light for the dark band), revenue = blue — the validated pair for P&L.
//  · 7 group slots in this fixed order + a neutral "Other" (adjacent pairs pass;
//    aqua/magenta are <3:1 on light, so the comparison table is the relief).
//  · "Who paid" uses slots 1, 2, 4 (gold, blue, aqua), validated all-pairs; the dark
//    step sits in the 6–8 CVD band, so every part is also named with its share.
// Text never wears these colours — only marks and swatches do.
const PALETTE_CSS = `
.xd{--xd-exp:#a8862e;--xd-rev:#2a78d6;--xd-g1:#a8862e;--xd-g2:#2a78d6;--xd-g3:#eb6834;--xd-g4:#1baf7a;--xd-g5:#6250d6;--xd-g6:#e87ba4;--xd-g7:#008300;--xd-other:#b9b2a3}
.dark .xd{--xd-exp:#b0903a;--xd-rev:#3987e5;--xd-g1:#b0903a;--xd-g2:#3987e5;--xd-g3:#d95926;--xd-g4:#199e70;--xd-g5:#9085e9;--xd-g6:#d55181;--xd-g7:#008300;--xd-other:#5f5a4f}
`
const EXP = 'var(--xd-exp)'
const REV = 'var(--xd-rev)'
const NET = 'var(--text)'
// Fixed slot per group (colour follows the group, never its rank); the rest fold into Other.
const GROUP_SLOTS = ['staff', 'utilities', 'repairs', 'housekeeping', 'guest_supplies', 'commission', 'refunds']
const slotColor = (g) => { const i = GROUP_SLOTS.indexOf(g); return i < 0 ? 'var(--xd-other)' : `var(--xd-g${i + 1})` }
const PAID_FROM = { reception: 'var(--xd-g1)', owner: 'var(--xd-g2)', bank: 'var(--xd-g4)' }
const FIXED_GROUPS = ['utilities', 'staff', 'taxes_fees']

const axisTick = { fontSize: 11, fill: 'var(--text3)' }
const pct1 = (v) => Math.round((v ?? 0) * 10) / 10
const marginOf = (net, income) => (income ? (net / income) * 100 : null)
const incomeOf = (m) => (m.revenue || 0) + (m.otherIncome || 0)
const hasMoney = (m) => !!(m.expenses || m.revenue || m.otherIncome)

// ₹1.2L / −₹45K for axes and labels (en-IN units; formatCurrencyCompact has no minus sign).
function compact(v) {
  const n = Number(v) || 0
  const a = Math.abs(n)
  const f = (x, u) => `₹${x.toFixed(1).replace(/\.0$/, '')}${u}`
  const s = a >= 1e7 ? f(a / 1e7, 'Cr') : a >= 1e5 ? f(a / 1e5, 'L') : a >= 1e3 ? f(a / 1e3, 'K') : `₹${Math.round(a)}`
  return n < 0 ? `−${s}` : s
}
const monthLabel = (m, opts = { month: 'short' }) => (m ? new Date(`${m}-01T00:00`).toLocaleDateString(appLocale(), opts) : '')
const dayLabel = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }) : '')
const longMonth = (m) => monthLabel(m, { month: 'long', year: 'numeric' })

// ── Building blocks ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, labelFor, names, colors }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line2 rounded-lg shadow-soft px-3 py-2 text-xs min-w-[160px]">
      <div className="text-ink3 mb-1">{labelFor ? labelFor(label) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-px">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: colors?.[p.dataKey] || p.color }} />
          <span className="text-ink2">{names?.[p.dataKey] ?? p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Legend({ items, className = 'justify-center' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2 ${className}`}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.line
            ? <span className="relative w-4 h-2 shrink-0" aria-hidden><span className="absolute inset-x-0 top-[3px] h-0.5 rounded" style={{ background: i.color }} /><span className="absolute left-1/2 top-0 -ml-1 w-2 h-2 rounded-full" style={{ background: i.color }} /></span>
            : <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.color }} aria-hidden />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

// Signed change with an arrow icon + text, coloured by whether the move is good.
function Delta({ value, upIsGood, children, className = '' }) {
  if (value == null) return null
  const flat = Math.abs(value) < 0.05
  const Icon = value > 0 ? LuArrowUp : LuArrowDown
  const tone = flat ? 'text-ink3' : (value > 0) === upIsGood ? 'text-success-text' : 'text-danger-text'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums whitespace-nowrap ${tone} ${className}`}>
      {!flat && <Icon size={12} aria-hidden />}{children}
    </span>
  )
}

const Skeleton = ({ className = 'h-48' }) => <div className={`rounded-xl bg-surface2 animate-pulse ${className}`} />
const Muted = ({ children }) => <p className="text-sm text-ink3 py-6 text-center">{children}</p>

// ── Insights ──────────────────────────────────────────────────────────────────
const TONE = {
  good: 'bg-success-bg text-success-text', bad: 'bg-danger-bg text-danger-text',
  warn: 'bg-warning-bg text-warning-text', info: 'bg-gold-bg text-gold',
}

// Last two months that have the figure, for "x in Oct, from y in Sep".
function lastTwo(months, has) {
  const rows = (months || []).filter(has)
  return rows.length >= 2 ? [rows[rows.length - 2], rows[rows.length - 1]] : null
}

// Most pressing first (money owed, budgets), then the moves; at most four.
function propertyInsights(s, t, gl) {
  const out = []
  const old = (s.aging || []).filter((b) => b.bucket === '31-60' || b.bucket === '60+')
  const oldCount = old.reduce((n, b) => n + b.count, 0)
  if (oldCount) {
    out.push({ icon: LuClock, tone: 'bad',
      text: t('dashboard.insights.oldUnpaid', { count: oldCount, amount: formatCurrency(old.reduce((n, b) => n + b.amount, 0)) }) })
  }
  const budgeted = (s.byCategory || []).filter((c) => c.budget != null)
  const over = budgeted.filter((c) => c.amount > c.budget)
  if (over.length) {
    out.push({ icon: LuTriangleAlert, tone: 'warn',
      text: t('dashboard.insights.overBudget', { count: over.length, names: over.slice(0, 2).map((c) => c.name).join(', ') }) })
  } else if (budgeted.length) {
    out.push({ icon: LuCircleCheck, tone: 'good', text: t('dashboard.insights.inBudget') })
  }
  let down = null
  if (Array.isArray(s.prevByGroup)) {
    const prev = Object.fromEntries(s.prevByGroup.map((g) => [g.group, g.amount]))
    const cur = Object.fromEntries((s.byGroup || []).map((g) => [g.group, g.amount]))
    const deltas = [...new Set([...Object.keys(prev), ...Object.keys(cur)])]
      .map((g) => ({ g, d: (cur[g] || 0) - (prev[g] || 0), prev: prev[g] || 0, cur: cur[g] || 0 }))
      .filter((x) => Math.abs(x.d) >= 1)
    const up = deltas.filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0]
    down = deltas.filter((x) => x.d < 0).sort((a, b) => a.d - b.d)[0]
    if (up) {
      out.push({ icon: LuTrendingUp, tone: 'bad', text: up.prev
        ? t('dashboard.insights.groupUp', { group: gl(up.g), amount: formatCurrency(up.d), pct: Math.round((up.d / up.prev) * 100) })
        : t('dashboard.insights.groupUpNew', { group: gl(up.g), amount: formatCurrency(up.cur) }) })
    }
  }
  const c2 = lastTwo(s.months, (m) => m.occupiedRoomNights > 0 && m.cpor > 0)
  if (c2 && Math.round(c2[1].cpor) !== Math.round(c2[0].cpor)) {
    const upC = c2[1].cpor > c2[0].cpor
    out.push({ icon: LuCalculator, tone: upC ? 'warn' : 'good',
      text: t(`dashboard.insights.${upC ? 'cporUp' : 'cporDown'}`, { amount: formatCurrency(c2[1].cpor), prev: formatCurrency(c2[0].cpor) }) })
  }
  out.push(...marginInsight(s.months, t))
  if (down) {
    out.push({ icon: LuTrendingDown, tone: 'good',
      text: t('dashboard.insights.groupDown', { group: gl(down.g), amount: formatCurrency(-down.d), pct: Math.round((-down.d / down.prev) * 100) }) })
  }
  return out.slice(0, 4)
}

function marginInsight(months, t) {
  const m2 = lastTwo(months, (m) => incomeOf(m) > 0)
  if (!m2) return []
  const a = Math.round(marginOf(m2[0].net, incomeOf(m2[0])))
  const b = Math.round(marginOf(m2[1].net, incomeOf(m2[1])))
  if (a === b) return []
  return [{ icon: LuScale, tone: b > a ? 'good' : 'bad',
    text: t(`dashboard.insights.${b > a ? 'marginUp' : 'marginDown'}`, { pct: b, prev: a, month: monthLabel(m2[1].month, { month: 'long' }) }) }]
}

function portfolioInsights(p, t) {
  const out = []
  const live = (p.properties || []).filter((x) => x.status !== 'archived')
  const loss = live.filter((x) => x.totals.net < 0)
  if (loss.length) out.push({ icon: LuTriangleAlert, tone: 'bad', text: t('dashboard.insights.loss', { count: loss.length, names: loss.map((x) => x.name).join(', ') }) })
  const worst = live.filter((x) => x.totals.revenue > 0).sort((a, b) => b.kpis.expenseRatio - a.kpis.expenseRatio)[0]
  if (worst && live.length > 1) out.push({ icon: LuPercent, tone: 'warn', text: t('dashboard.insights.highestRatio', { name: worst.name, pct: pct1(worst.kpis.expenseRatio) }) })
  out.push(...marginInsight(p.months, t))
  return out.slice(0, 4)
}

function InsightsCard({ items }) {
  const { t } = useTranslation('expenses')
  return (
    <Card title={t('dashboard.insights.title')} className="md:col-span-2 xl:col-span-12" bodyClassName="p-3">
      {items.length ? (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {items.map((i) => (
            <li key={i.text} className="flex items-start gap-2 rounded-lg bg-surface2/70 px-2.5 py-2 min-w-0">
              <span className={`w-5 h-5 mt-px rounded-full shrink-0 flex items-center justify-center ${TONE[i.tone]}`}><i.icon size={12} aria-hidden /></span>
              <span className="text-[13px] text-ink2 leading-snug">{i.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink3"><LuLightbulb size={15} aria-hidden />{t('dashboard.insights.none')}</p>
      )}
    </Card>
  )
}

// ── Row 2: P&L + unit economics ───────────────────────────────────────────────
function PnlCard({ months }) {
  const { t } = useTranslation('expenses')
  const has = months.some(hasMoney)
  const names = { revenue: t('dashboard.revenue'), expenses: t('dashboard.expenses'), net: t('dashboard.net') }
  const colors = { revenue: REV, expenses: EXP, net: NET }
  // Only the latest month with money gets a direct label on the net line.
  const lastIdx = months.reduce((n, m, i) => (hasMoney(m) ? i : n), -1)
  const NetLabel = ({ x, y, index, value }) => (index === lastIdx && value != null ? (
    <text x={x} y={y} dx={-6} dy={-10} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text)" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{compact(value)}</text>
  ) : null)
  return (
    <Card title={t('dashboard.pnl.title')} subtitle={t('dashboard.pnl.sub')} className="md:col-span-2 xl:col-span-8 flex flex-col" bodyClassName="flex-1 flex flex-col p-3 sm:p-4">
      {has ? (
        <>
          <Legend className="justify-start pb-2" items={[{ label: names.revenue, color: REV }, { label: names.expenses, color: EXP }, { label: names.net, color: NET, line: true }]} />
          <div className="flex-1 min-h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={months} margin={{ top: 20, right: 12, left: -4, bottom: 0 }} barGap={2} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={axisTick} axisLine={{ stroke: 'var(--border2)' }} tickLine={false} interval="preserveStartEnd" minTickGap={4} />
                <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<ChartTooltip names={names} colors={colors} labelFor={longMonth} />} cursor={{ fill: 'var(--surface2)' }} />
                <Bar dataKey="revenue" fill={REV} radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="expenses" fill={EXP} radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Line dataKey="net" type="linear" stroke={NET} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                      dot={{ r: 4, fill: NET, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5, fill: NET, stroke: 'var(--surface)', strokeWidth: 2 }}
                      label={NetLabel} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : <Muted>{t('dashboard.pnl.empty')}</Muted>}
    </Card>
  )
}

function UnitRow({ label, value, help, delta, children }) {
  return (
    <div className="flex-1 flex items-center gap-3 px-4 sm:px-5 py-3 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink3">{label}</div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xl font-semibold text-ink">{value}</span>
          {delta}
        </div>
        <p className="text-xs text-ink3 leading-snug mt-0.5">{help}</p>
      </div>
      {children}
    </div>
  )
}

// One card, three rows: cost per room night (+ sparkline), expense ratio, net margin.
// The value is the period's; the change compares with the month before the latest one.
function UnitCard({ cpor, expenseRatio, margin, months }) {
  const { t } = useTranslation('expenses')
  const ms = months || []
  const lastIdx = ms.reduce((n, m, i) => (hasMoney(m) ? i : n), -1)
  const prev = lastIdx > 0 ? ms[lastIdx - 1] : null
  const vs = prev && hasMoney(prev) ? monthLabel(prev.month) : null
  const prevCpor = vs && prev.occupiedRoomNights > 0 ? prev.cpor : null
  const prevRatio = vs && prev.revenue ? (prev.expenses / prev.revenue) * 100 : null
  const prevMargin = vs ? marginOf(prev.net, incomeOf(prev)) : null
  const spark = ms.filter((m) => m.occupiedRoomNights > 0 && m.cpor > 0)
  const vsText = (txt, d) => (Math.abs(d) < 0.05 ? t('dashboard.unit.same', { month: vs }) : `${txt} ${t('dashboard.unit.vsMonth', { month: vs })}`)
  const pts = (d) => t('dashboard.unit.pts', { value: pct1(Math.abs(d)) })
  const dC = prevCpor != null && cpor != null ? cpor - prevCpor : null
  const dR = prevRatio != null && expenseRatio != null ? expenseRatio - prevRatio : null
  const dM = prevMargin != null && margin != null ? margin - prevMargin : null
  return (
    <Card title={t('dashboard.unit.title')} subtitle={t('dashboard.unit.sub')} className="md:col-span-2 xl:col-span-4 flex flex-col"
          bodyClassName="flex-1 flex flex-col divide-y divide-line">
      <UnitRow label={t('dashboard.unit.cpor')} value={formatCurrency(cpor)} help={t('dashboard.unit.cporHelp')}
               delta={dC != null && <Delta value={dC} upIsGood={false}>{vsText(formatCurrency(Math.abs(dC)), dC)}</Delta>}>
        {spark.length > 1 && (
          <div className="w-[96px] sm:w-[120px] h-12 shrink-0" role="img" aria-label={t('dashboard.unit.trend')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                <XAxis dataKey="month" hide />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip content={<ChartTooltip names={{ cpor: t('dashboard.unit.cpor') }} colors={{ cpor: EXP }} labelFor={longMonth} />} />
                <Line dataKey="cpor" type="linear" stroke={EXP} strokeWidth={2} isAnimationActive={false}
                      dot={(p) => (p.index === spark.length - 1 ? <circle key="end" cx={p.cx} cy={p.cy} r={4} fill={EXP} stroke="var(--surface)" strokeWidth={2} /> : <g key={p.index} />)} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </UnitRow>
      <UnitRow label={t('dashboard.unit.expenseRatio')} value={`${pct1(expenseRatio)}%`} help={t('dashboard.unit.expenseRatioHelp')}
               delta={dR != null && <Delta value={dR} upIsGood={false}>{vsText(pts(dR), dR)}</Delta>} />
      <UnitRow label={t('dashboard.unit.netMargin')} value={`${pct1(margin)}%`} help={t('dashboard.unit.netMarginHelp')}
               delta={dM != null && <Delta value={dM} upIsGood>{vsText(pts(dM), dM)}</Delta>} />
    </Card>
  )
}

// ── Row 3: spend by group (ranked bars) + fixed/variable + aging ──────────────
function GroupChange({ cur, prev }) {
  const { t } = useTranslation('expenses')
  if (prev == null) return null
  const d = cur - prev
  const label = t('dashboard.where.vsPrev')
  if (!prev && cur) return <Delta value={1} upIsGood={false} className="w-14 justify-end"><span title={label}>{t('dashboard.where.new')}</span></Delta>
  if (Math.abs(d) < 1) return <span className="w-14 text-right text-xs text-ink3 tabular-nums" title={`${t('dashboard.where.same')} ${label}`}>0%<span className="sr-only"> {t('dashboard.where.same')}</span></span>
  const pct = Math.round((Math.abs(d) / prev) * 100)
  return (
    <Delta value={d} upIsGood={false} className="w-14 justify-end">
      <span title={`${d > 0 ? '+' : '−'}${formatCurrency(Math.abs(d))} ${label}`}>{pct}%</span><span className="sr-only"> {label}</span>
    </Delta>
  )
}

function GroupsCard({ byGroup, prevByGroup, total }) {
  const { t } = useTranslation('expenses')
  const gl = (g) => t(`groups.${g}`, { defaultValue: g })
  const rows = [...byGroup].filter((g) => g.amount > 0).sort((a, b) => b.amount - a.amount)
  const prev = Array.isArray(prevByGroup) ? Object.fromEntries(prevByGroup.map((g) => [g.group, g.amount])) : null
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.budget || 0)), 1)
  return (
    <Card title={t('dashboard.where.title')} subtitle={t(prev ? 'dashboard.where.sub' : 'dashboard.where.subAll')} className="md:col-span-2 xl:col-span-7 flex flex-col"
          actions={rows.length ? <span className="text-sm font-semibold text-ink tabular-nums">{t('dashboard.where.total', { amount: formatCurrency(total) })}</span> : null}
          bodyClassName="flex-1 flex flex-col px-4 sm:px-5 py-4">
      {rows.length ? (
        <ol className="flex-1 flex flex-col justify-between gap-2.5">
          {rows.map((r) => {
            const hasBudget = r.budget != null && r.budget > 0
            const over = hasBudget && r.amount > r.budget
            return (
              <li key={r.group} className="min-w-0">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-ink font-medium truncate min-w-0 flex-1">{gl(r.group)}</span>
                  {prev && <GroupChange cur={r.amount} prev={prev[r.group] ?? 0} />}
                  <span className="w-9 shrink-0 text-right text-xs text-ink3 tabular-nums">{total ? Math.round((r.amount / total) * 100) : 0}%</span>
                  <span className="w-[84px] shrink-0 text-right font-semibold text-ink tabular-nums">{formatCurrency(r.amount)}</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-surface2">
                  <div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: EXP }} />
                  {hasBudget && (
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink" style={{ left: `calc(${(r.budget / max) * 100}% - 1px)` }}
                          title={t('dashboard.where.budgetTick', { amount: formatCurrency(r.budget) })} aria-hidden />
                  )}
                </div>
                {hasBudget && (
                  <div className={`mt-1 flex items-center gap-1 text-xs ${over ? 'text-danger-text font-medium' : 'text-ink3'}`}>
                    {over && <LuTriangleAlert size={12} aria-hidden />}
                    {over
                      ? t('dashboard.where.over', { amount: formatCurrency(r.amount - r.budget), budget: formatCurrency(r.budget) })
                      : t('dashboard.where.left', { amount: formatCurrency(r.budget - r.amount), budget: formatCurrency(r.budget) })}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      ) : <EmptyState icon="₹" title={t('dashboard.noSpend')} />}
    </Card>
  )
}

function FixedCard({ fixed, variable }) {
  const { t } = useTranslation('expenses')
  const total = fixed + variable
  const fp = total ? Math.round((fixed / total) * 100) : 0
  const parts = [['fixed', fixed, EXP], ['variable', variable, 'var(--xd-other)']]
  return (
    <Card title={t('dashboard.fixed.title')} subtitle={t('dashboard.fixed.sub')} bodyClassName="px-4 sm:px-5 py-4">
      {total ? (
        <>
          <div className="text-sm font-semibold text-ink">{t('dashboard.fixed.share', { pct: fp })}</div>
          <div className="mt-2 flex gap-0.5 h-2" role="presentation">
            {parts.map(([k, v, c]) => v > 0 && <div key={k} className="h-full rounded-full" style={{ width: `${(v / total) * 100}%`, background: c }} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {parts.map(([k, v, c]) => (
              <div key={k} className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-ink3"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} aria-hidden />{t(`dashboard.fixed.${k}`)}</div>
                <div className="text-sm font-semibold text-ink tabular-nums">{formatCurrency(v)} <span className="text-xs font-normal text-ink3">· {total ? Math.round((v / total) * 100) : 0}%</span></div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink3 leading-snug">{t('dashboard.fixed.note')}</p>
        </>
      ) : <Muted>{t('dashboard.noSpend')}</Muted>}
    </Card>
  )
}

const AGING_ICON = { '31-60': { icon: LuClock, tone: TONE.warn }, '60+': { icon: LuTriangleAlert, tone: TONE.bad } }

function AgingCard({ aging, onOpenUnpaid, className = '' }) {
  const { t } = useTranslation('expenses')
  const total = aging.reduce((n, b) => n + b.amount, 0)
  return (
    <Card title={t('dashboard.aging.title')} subtitle={t('dashboard.aging.sub')} className={`flex flex-col ${className}`}
          actions={total ? <span className="text-sm font-semibold text-ink tabular-nums">{t('dashboard.aging.total', { amount: formatCurrency(total) })}</span> : null}
          bodyClassName="flex-1 flex flex-col px-2 sm:px-3 py-2">
      {total ? (
        <ul className="flex-1 flex flex-col divide-y divide-line">
          {aging.map((b) => {
            const st = AGING_ICON[b.bucket]
            return (
              <li key={b.bucket} className="flex-1 flex">
                <button type="button" onClick={onOpenUnpaid} disabled={!b.count}
                  className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-2.5 bg-transparent border-none cursor-pointer enabled:hover:bg-surface2 disabled:cursor-default text-sm">
                  <span className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${st && b.count ? st.tone : ''}`}>
                    {st && b.count ? <st.icon size={12} aria-hidden /> : null}
                  </span>
                  <span className="text-ink2">{t(`dashboard.aging.buckets.${b.bucket}`)}</span>
                  <span className="text-xs text-ink3">{t('dashboard.aging.bills', { count: b.count })}</span>
                  <span className={`ml-auto font-semibold tabular-nums ${b.count ? 'text-ink' : 'text-ink3'}`}>{formatCurrency(b.amount)}</span>
                  <LuChevronRight size={14} className={b.count ? 'text-ink3' : 'opacity-0'} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      ) : <Muted>{t('dashboard.aging.none')}</Muted>}
    </Card>
  )
}

// ── Row 4: daily spend + payees ───────────────────────────────────────────────
function DailyCard({ daily: all }) {
  const { t } = useTranslation('expenses')
  const monthly = all[0]?.date?.length === 7
  // Days still to come carry nothing yet — chart only up to today.
  const nowKey = new Date().toLocaleDateString('en-CA').slice(0, monthly ? 7 : 10)
  const daily = all.some((d) => d.date <= nowKey) ? all.filter((d) => d.date <= nowKey) : all
  const labelFor = (d) => (monthly ? monthLabel(d, { month: 'short', year: '2-digit' }) : dayLabel(d))
  const total = daily.reduce((n, d) => n + (d.out || 0), 0)
  // Average over the days (months) that have started, not the whole range.
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const elapsed = daily.filter((d) => d.date <= todayKey.slice(0, monthly ? 7 : 10)).length || daily.length || 1
  const busiest = daily.reduce((b, d) => ((d.out || 0) > (b?.out || 0) ? d : b), null)
  const stats = [
    [t('dashboard.daily.total'), formatCurrency(total)],
    [t(monthly ? 'dashboard.daily.avgMonth' : 'dashboard.daily.avgDay'), formatCurrency(Math.round(total / elapsed))],
    [t(monthly ? 'dashboard.daily.busiestMonth' : 'dashboard.daily.busiestDay'), busiest ? `${labelFor(busiest.date)} · ${formatCurrency(busiest.out)}` : '—'],
  ]
  return (
    <Card title={monthly ? t('dashboard.daily.monthlyTitle') : t('dashboard.daily.title')} subtitle={t('dashboard.daily.sub')}
          className="md:col-span-2 xl:col-span-7 flex flex-col" bodyClassName="flex-1 flex flex-col p-3 sm:p-4">
      {total > 0 ? (
        <>
          <dl className="grid grid-cols-3 gap-3 pb-3 px-1">
            {stats.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-ink3 truncate">{k}</dt>
                <dd className="text-sm font-semibold text-ink leading-snug break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex-1 min-h-[200px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={labelFor} tick={axisTick} axisLine={{ stroke: 'var(--border2)' }} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip names={{ out: t('dashboard.expenses') }} colors={{ out: EXP }} labelFor={labelFor} />} cursor={{ fill: 'var(--surface2)' }} />
                <Bar dataKey="out" fill={EXP} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : <Muted>{t('dashboard.noSpend')}</Muted>}
    </Card>
  )
}

function PayeesCard({ topPayees, byPaidFrom, largest }) {
  const { t } = useTranslation('expenses')
  const top = topPayees.slice(0, 5)
  const topMax = Math.max(...top.map((p) => p.amount), 1)
  const pfTotal = byPaidFrom.reduce((s, r) => s + r.amount, 0)
  // Older servers send no category per payee; fall back to their largest entry's.
  const catOf = (p) => p.category || largest.find((e) => e.payee === p.payee)?.category || null
  return (
    <Card title={t('dashboard.payees.title')} subtitle={t('dashboard.payees.sub')} className="md:col-span-2 xl:col-span-5 flex flex-col"
          bodyClassName="flex-1 flex flex-col px-4 sm:px-5 py-4">
      {top.length ? (
        <ol className="space-y-3">
          {top.map((p, i) => {
            const cat = catOf(p)
            return (
              <li key={p.payee} className="min-w-0">
                <div className="flex items-baseline gap-2 text-sm min-w-0">
                  <span className="w-4 shrink-0 text-xs text-ink3 tabular-nums">{i + 1}</span>
                  <span className="text-ink font-medium truncate">{p.payee}</span>
                  <span className="text-xs text-ink3 truncate min-w-0 flex-1">
                    {[cat, p.count ? t('dashboard.payees.entries', { count: p.count }) : null].filter(Boolean).join(' · ')}
                  </span>
                  <span className="shrink-0 font-semibold text-ink tabular-nums">{formatCurrency(p.amount)}</span>
                </div>
                <div className="ml-6 mt-1 h-1.5 rounded-full bg-surface2">
                  <div className="h-full rounded-full" style={{ width: `${(p.amount / topMax) * 100}%`, background: EXP }} />
                </div>
              </li>
            )
          })}
        </ol>
      ) : <Muted>{t('dashboard.noSpend')}</Muted>}
      {pfTotal > 0 && (
        <div className="mt-auto pt-4">
          <div className="pt-3 border-t border-line">
            <div className="text-xs font-semibold text-ink2 mb-2">{t('dashboard.payees.paidFrom')}</div>
            <div className="flex gap-0.5 h-2" role="presentation">
              {byPaidFrom.filter((r) => r.amount > 0).map((r) => (
                <div key={r.paidFrom} className="h-full rounded-full" style={{ width: `${(r.amount / pfTotal) * 100}%`, background: PAID_FROM[r.paidFrom] || 'var(--xd-other)' }} />
              ))}
            </div>
            <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
              {byPaidFrom.map((r) => (
                <li key={r.paidFrom} className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PAID_FROM[r.paidFrom] || 'var(--xd-other)' }} aria-hidden />
                  <span className="text-ink2 truncate">{t(`paidFrom.${r.paidFrom}`, { defaultValue: r.paidFrom })}</span>
                  <span className="ml-auto text-ink tabular-nums whitespace-nowrap">{Math.round((r.amount / pfTotal) * 100)}% · {formatCurrency(r.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── All properties: comparison ────────────────────────────────────────────────
const COLS = [
  { key: 'name', get: (p) => p.name.toLowerCase(), left: true },
  { key: 'expenses', get: (p) => p.totals.expenses },
  { key: 'revenue', get: (p) => p.totals.revenue },
  { key: 'net', get: (p) => p.totals.net },
  { key: 'margin', get: (p) => p.totals.margin },
  { key: 'cpor', get: (p) => p.kpis.cpor },
  { key: 'unpaid', get: (p) => p.totals.unpaid },
]

function CompareTable({ properties, totals, onOpen }) {
  const { t } = useTranslation('expenses')
  const [sort, setSort] = useState({ key: 'expenses', dir: 'desc' })
  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key)
    return [...properties].sort((a, b) => {
      const va = col.get(a); const vb = col.get(b)
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [properties, sort])
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))
  const label = (k) => t(`dashboard.compare.${k === 'name' ? 'property' : k}`)
  const money = (v) => formatCurrency(v)
  const sortHeader = (c) => {
    const active = sort.key === c.key
    const Icon = !active ? LuChevronsUpDown : sort.dir === 'asc' ? LuArrowUp : LuArrowDown
    return (
      <button type="button" onClick={() => onSort(c.key)}
        aria-label={`${label(c.key)}${active ? ` (${sort.dir === 'asc' ? 'ascending' : 'descending'})` : ''}`}
        className={`inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer uppercase tracking-[inherit] font-[inherit] ${active ? 'text-ink' : 'text-ink3'} ${c.left ? '' : 'flex-row-reverse'}`}>
        {label(c.key)}<Icon size={12} className={active ? '' : 'opacity-50'} aria-hidden />
      </button>
    )
  }
  // Totals sit in DataTable's footer row; archived properties are dimmed.
  const netCell = (v) => <span className={`font-semibold ${v < 0 ? 'text-danger-text' : 'text-ink'}`}>{money(v)}</span>
  const columns = [
    {
      key: 'name', header: sortHeader(COLS[0]), className: 'min-w-[160px]',
      footer: () => t('dashboard.compare.total'),
      render: (p) => (
        <span className="block">
          <span className="font-medium text-ink">{p.name}</span>
          <span className="block text-xs text-ink3">{[p.code, p.status === 'archived' && t('dashboard.compare.archived')].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { key: 'expenses', render: (p) => money(p.totals.expenses), footer: () => money(totals.expenses) },
    { key: 'revenue', render: (p) => money(p.totals.revenue), footer: () => money(totals.revenue) },
    { key: 'net', render: (p) => netCell(p.totals.net), footer: () => netCell(totals.net) },
    { key: 'margin', render: (p) => `${pct1(p.totals.margin)}%`, footer: () => `${pct1(totals.margin)}%` },
    { key: 'cpor', render: (p) => money(p.kpis.cpor), footer: () => money(totals.cpor) },
    { key: 'unpaid', render: (p) => <span className={p.totals.unpaid ? 'text-ink' : 'text-ink3'}>{money(p.totals.unpaid)}</span>, footer: () => money(totals.unpaid) },
  ].map((c, i) => (i === 0 ? c : { ...c, header: sortHeader(COLS[i]), align: 'right', className: 'tabular-nums' }))
  return (
    <Card title={t('dashboard.compare.title')} subtitle={t('dashboard.compare.sub')} className="md:col-span-2 xl:col-span-12">
      <DataTable
        mobile="scroll"
        columns={columns}
        rows={rows}
        onRowClick={(p) => onOpen(p.id)}
        rowClassName={(p) => (p.status === 'archived' ? 'opacity-60' : '')}
      />
    </Card>
  )
}

const compareAxes = (
  <>
    <CartesianGrid vertical={false} stroke="var(--border)" />
    <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: 'var(--border2)' }} tickLine={false} interval={0} />
    <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={52} />
  </>
)
const propLabel = (p) => p.code || p.name

function CompareVsCard({ properties }) {
  const { t } = useTranslation('expenses')
  const vs = properties.filter((p) => p.status !== 'archived').map((p) => ({ name: propLabel(p), revenue: p.totals.revenue, expenses: p.totals.expenses }))
  const names = { revenue: t('dashboard.revenue'), expenses: t('dashboard.expenses') }
  return (
    <Card title={t('dashboard.compare.vsTitle')} subtitle={t('dashboard.compare.vsSub')} className="md:col-span-2 xl:col-span-12" bodyClassName="p-3 sm:p-4">
      <Legend className="justify-start pb-2" items={[{ label: names.revenue, color: REV }, { label: names.expenses, color: EXP }]} />
      <div className="h-[240px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={vs} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barGap={2}>
            {compareAxes}
            <Tooltip content={<ChartTooltip names={names} colors={{ revenue: REV, expenses: EXP }} />} cursor={{ fill: 'var(--surface2)' }} />
            <Bar dataKey="revenue" fill={REV} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expenses" fill={EXP} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function CompareGroupsCard({ properties, className = '' }) {
  const { t } = useTranslation('expenses')
  const live = properties.filter((p) => p.status !== 'archived')
  // ≤ 7 fixed slots + Other, stacked bottom-up in slot order whatever the data.
  const present = new Set(live.flatMap((p) => p.byGroup.filter((g) => g.amount > 0).map((g) => g.group)))
  const keys = [...GROUP_SLOTS.filter((g) => present.has(g)), ...([...present].some((g) => !GROUP_SLOTS.includes(g)) ? ['other'] : [])]
  const stacked = live.map((p) => {
    const row = { name: propLabel(p) }
    for (const g of p.byGroup) {
      const k = GROUP_SLOTS.includes(g.group) ? g.group : 'other'
      row[k] = (row[k] || 0) + g.amount
    }
    row.top = [...keys].reverse().find((k) => row[k] > 0)
    return row
  })
  const gNames = Object.fromEntries(keys.map((g) => [g, g === 'other' ? t('dashboard.compare.other') : t(`groups.${g}`, { defaultValue: g })]))
  const gColors = Object.fromEntries(keys.map((g) => [g, slotColor(g)]))
  return (
    <Card title={t('dashboard.compare.groupTitle')} subtitle={t('dashboard.compare.groupSub')} className={`flex flex-col ${className}`} bodyClassName="flex-1 flex flex-col p-3 sm:p-4">
      <Legend className="justify-start pb-2" items={keys.map((g) => ({ label: gNames[g], color: gColors[g] }))} />
      <div className="flex-1 min-h-[240px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stacked} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            {compareAxes}
            <Tooltip content={<ChartTooltip names={gNames} colors={gColors} />} cursor={{ fill: 'var(--surface2)' }} />
            {/* The surface-coloured 2px stroke is the gap between stacked segments. */}
            {keys.map((g) => (
              <Bar key={g} dataKey={g} stackId="g" fill={gColors[g]} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false}>
                {stacked.map((row) => <Cell key={row.name} radius={row.top === g ? [4, 4, 0, 0] : 0} />)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const GRID = 'grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-12'

function DashboardSkeleton() {
  return (
    <div className={GRID} aria-busy="true">
      <Skeleton className="h-24 md:col-span-2 xl:col-span-12" />
      <Skeleton className="h-80 md:col-span-2 xl:col-span-8" />
      <Skeleton className="h-80 md:col-span-2 xl:col-span-4" />
      <Skeleton className="h-96 md:col-span-2 xl:col-span-7" />
      <Skeleton className="h-96 md:col-span-2 xl:col-span-5" />
    </div>
  )
}

/**
 * Dashboard tab. Rows (xl 12 columns): what stands out · P&L | unit economics ·
 * spend by group | fixed vs variable + unpaid by age · daily spend | top payees.
 * In the "All properties" scope (topbar switcher) it shows every property combined, with a comparison.
 */
export default function ExpenseDashboard({ all, summary, portfolio, loading, onOpenUnpaid, onOpenProperty }) {
  const { t } = useTranslation('expenses')
  const gl = (g) => t(`groups.${g}`, { defaultValue: g })
  const wrap = (busy, body) => (
    <div className={`xd space-y-4 ${busy ? 'opacity-70 transition-opacity' : ''}`}>
      <style>{PALETTE_CSS}</style>
      {body}
    </div>
  )

  if (all) {
    if (!portfolio) return wrap(false, loading ? <DashboardSkeleton /> : <Card><EmptyState title={t('loadError')} /></Card>)
    const p = portfolio
    const live = (p.properties || []).filter((x) => x.status !== 'archived')
    const orn = live.reduce((n, x) => n + (x.kpis?.occupiedRoomNights || 0), 0)
    const tot = { ...p.totals, cpor: orn ? p.totals.expenses / orn : 0 }
    const byGroup = p.byGroup || []
    const fixed = byGroup.filter((g) => FIXED_GROUPS.includes(g.group)).reduce((n, g) => n + g.amount, 0)
    const months = (p.months || []).map((m) => ({ ...m, otherIncome: 0 }))
    return wrap(loading, (
      <div className={GRID}>
        <InsightsCard items={portfolioInsights(p, t)} />
        <PnlCard months={months} />
        <UnitCard cpor={tot.cpor} expenseRatio={tot.revenue ? (tot.expenses / tot.revenue) * 100 : 0} margin={tot.margin} months={months} />
        <GroupsCard byGroup={byGroup} total={tot.expenses} />
        <div className="md:col-span-2 xl:col-span-5 min-w-0 flex flex-col gap-4">
          <FixedCard fixed={fixed} variable={Math.max(0, tot.expenses - fixed)} />
          <CompareGroupsCard properties={p.properties || []} className="flex-1" />
        </div>
        <CompareTable properties={p.properties || []} totals={tot} onOpen={onOpenProperty} />
        <CompareVsCard properties={p.properties || []} />
      </div>
    ))
  }

  if (!summary) return wrap(false, loading ? <DashboardSkeleton /> : <Card><EmptyState title={t('loadError')} /></Card>)
  const s = summary
  const { totals, kpis } = s
  const months = s.months || []
  const fv = s.fixedVariable || { fixed: 0, variable: 0 }
  return wrap(loading, (
    <div className={GRID}>
      <InsightsCard items={propertyInsights(s, t, gl)} />
      <PnlCard months={months} />
      <UnitCard cpor={kpis?.cpor} expenseRatio={kpis?.expenseRatio} margin={totals?.margin} months={months} />
      <GroupsCard byGroup={s.byGroup || []} prevByGroup={s.prevByGroup} total={totals?.expenses || 0} />
      <div className="md:col-span-2 xl:col-span-5 min-w-0 flex flex-col gap-4">
        <FixedCard fixed={fv.fixed} variable={fv.variable} />
        <AgingCard aging={s.aging || []} onOpenUnpaid={onOpenUnpaid} className="flex-1" />
      </div>
      <DailyCard daily={s.daily || []} />
      <PayeesCard topPayees={s.topPayees || []} byPaidFrom={s.byPaidFrom || []} largest={s.largest || []} />
    </div>
  ))
}
