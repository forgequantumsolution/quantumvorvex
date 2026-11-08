import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { LuBedDouble, LuPercent, LuScale, LuCalculator } from 'react-icons/lu'
import { Card, StatCard, EmptyState } from '../../ui-tw'
import { formatCurrency, formatCurrencyCompact } from '../../../utils/format'
import { appLocale } from '../../../i18n'

const PAID_FROM_BAR = { reception: 'bg-info', owner: 'bg-gold', bank: 'bg-violet' }

function ChartTooltip({ active, payload, label, labelFor }) {
  const { t } = useTranslation('expenses')
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line2 rounded-lg shadow-soft px-3 py-2 text-xs">
      <div className="text-ink3 mb-1">{labelFor(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink2">{t(`analysis.${p.dataKey === 'out' ? 'moneyOut' : 'moneyIn'}`)}</span>
          <span className="ml-auto font-semibold text-ink tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Bars per group, scaled to the largest of spend and budget; a tick marks the budget.
function GroupBars({ rows }) {
  const { t } = useTranslation('expenses')
  if (!rows.length) return <EmptyState icon="₹" title={t('analysis.noSpend')} />
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.budget || 0)), 1)
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const over = r.budget != null && r.amount > r.budget
        return (
          <li key={r.group} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink font-medium truncate">{t(`groups.${r.group}`, { defaultValue: r.group })}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-ink">{formatCurrency(r.amount)}</span>
                <span className="ml-2 text-xs text-ink3">{Math.round(r.share * 10) / 10}%</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-surface2">
              <div className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-gold'}`} style={{ width: `${(r.amount / max) * 100}%` }} />
              {r.budget != null && (
                <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink2" style={{ left: `calc(${(r.budget / max) * 100}% - 1px)` }}
                      title={t('analysis.budget', { amount: formatCurrency(r.budget) })} aria-hidden />
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink3">
              <span>{t('analysis.entries', { count: r.count })}</span>
              {r.budget != null && (
                <span className={over ? 'text-danger-text font-medium' : ''}>
                  {over
                    ? t('analysis.overBudget', { amount: formatCurrency(r.amount - r.budget), budget: formatCurrency(r.budget) })
                    : t('analysis.budgetLeft', { amount: formatCurrency(r.budget - r.amount), budget: formatCurrency(r.budget) })}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Analysis tab: KPI tiles, spend by group vs budget, daily/monthly trend, who paid and top payees. */
export default function ExpenseAnalysis({ summary, loading }) {
  const { t } = useTranslation('expenses')
  if (!summary) {
    return loading
      ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-surface2 animate-pulse" />)}</div>
      : <Card><EmptyState title={t('loadError')} /></Card>
  }
  const { totals, kpis, byGroup = [], byPaidFrom = [], topPayees = [], daily = [] } = summary
  const monthly = daily[0]?.date?.length === 7
  const labelFor = (d) => {
    if (!d) return ''
    return monthly
      ? new Date(`${d}-01T00:00`).toLocaleDateString(appLocale(), { month: 'short', year: '2-digit' })
      : new Date(`${d}T00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' })
  }
  const paidFromTotal = byPaidFrom.reduce((s, r) => s + r.amount, 0)
  const topMax = Math.max(...topPayees.map((p) => p.amount), 1)

  const tiles = [
    { icon: <LuCalculator />, tone: 'gold', label: t('analysis.cpor'), value: formatCurrency(kpis.cpor), text: t('analysis.cporHelp') },
    { icon: <LuPercent />, tone: 'red', label: t('analysis.expenseRatio'), value: `${kpis.expenseRatio}%`, text: t('analysis.expenseRatioHelp') },
    { icon: <LuScale />, tone: totals.net < 0 ? 'red' : 'green', label: t('analysis.netMargin'), value: `${Math.round(totals.margin * 10) / 10}%`, text: t('analysis.netMarginHelp') },
    { icon: <LuBedDouble />, tone: 'blue', label: t('analysis.roomNights'), value: kpis.occupiedRoomNights.toLocaleString('en-IN'), text: t('analysis.roomNightsHelp') },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map(({ text, ...k }) => (
          <StatCard key={k.label} {...k}>
            <p className="text-xs text-ink3 leading-snug">{text}</p>
          </StatCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={t('analysis.byGroup')} subtitle={t('analysis.byGroupSub', { amount: formatCurrency(totals.expenses) })}
              bodyClassName="p-4 sm:p-5">
          <GroupBars rows={byGroup} />
        </Card>

        <div className="xl:col-span-2 space-y-4 min-w-0">
          <Card title={t('analysis.paidFrom')} bodyClassName="p-4 sm:p-5">
            {paidFromTotal ? (
              <>
                <div className="flex h-3 rounded-full overflow-hidden bg-surface2" role="presentation">
                  {byPaidFrom.map((r) => (
                    <div key={r.paidFrom} className={PAID_FROM_BAR[r.paidFrom] || 'bg-ink3'} style={{ width: `${(r.amount / paidFromTotal) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {byPaidFrom.map((r) => (
                    <li key={r.paidFrom} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${PAID_FROM_BAR[r.paidFrom] || 'bg-ink3'}`} aria-hidden />
                      <span className="text-ink2">{t(`paidFrom.${r.paidFrom}`, { defaultValue: r.paidFrom })}</span>
                      <span className="text-xs text-ink3">{t('analysis.entries', { count: r.count })}</span>
                      <span className="ml-auto font-semibold text-ink tabular-nums">{formatCurrency(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-sm text-ink3">{t('analysis.noSpend')}</p>}
          </Card>

          <Card title={t('analysis.topPayees')} bodyClassName="p-4 sm:p-5">
            {topPayees.length ? (
              <ol className="space-y-2.5">
                {topPayees.map((p, i) => (
                  <li key={p.payee} className="min-w-0">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="w-4 text-xs text-ink3 tabular-nums">{i + 1}</span>
                      <span className="text-ink truncate">{p.payee}</span>
                      <span className="ml-auto shrink-0 font-semibold text-ink tabular-nums">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="ml-6 mt-1 h-1.5 rounded-full bg-surface2">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${(p.amount / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink3">{t('analysis.noSpend')}</p>}
          </Card>
        </div>
      </div>

      <Card title={monthly ? t('analysis.monthlyTrend') : t('analysis.dailyTrend')} subtitle={t('analysis.trendSub')} bodyClassName="p-2 sm:p-4">
        <div className="h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={labelFor} tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip labelFor={labelFor} />} cursor={{ fill: 'rgba(201,168,76,0.08)' }} />
              <Bar dataKey="out" fill="#C9A84C" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line dataKey="in" type="monotone" stroke="var(--green)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 pb-1 text-xs text-ink2">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gold" />{t('analysis.moneyOut')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-success" />{t('analysis.moneyIn')}</span>
        </div>
      </Card>
    </div>
  )
}
