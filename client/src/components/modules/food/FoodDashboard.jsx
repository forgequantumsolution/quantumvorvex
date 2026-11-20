import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { LuRefreshCw, LuIndianRupee, LuTags, LuUserPlus, LuCircleCheck, LuClipboardList } from 'react-icons/lu'
import { Card, Button, EmptyState } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { StatusPill } from './CustomerDetailModal'
import { MEAL_ICONS, compactMoney, monthLabel, daysLeftLabel, shortDate, initials } from './foodUtils'
import { appLocale } from '../../../i18n'

// Same two categorical slots as the gym dashboard (validated with the dataviz
// palette checker against the card surface in both modes):
//   A = brand gold — revenue, meals served, hotel guests
//   B = blue       — outside customers
const PALETTE_CSS = `
.fd{--fd-a:#a8862e;--fd-b:#2a78d6}
.dark .fd{--fd-a:#b0903a;--fd-b:#3987e5}
`
const A = 'var(--fd-a)'
const B = 'var(--fd-b)'
const axisTick = { fontSize: 11, fill: 'var(--text3)' }
const dayLabel = (d) => new Date(d).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' })

function ChartTooltip({ active, payload, label, title, rows }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line2 rounded-lg shadow-soft px-3 py-2 text-xs min-w-[140px]">
      <div className="text-ink3 mb-1">{title(label)}</div>
      {rows.map((r) => {
        const v = payload[0]?.payload?.[r.key]
        if (v == null || (r.hideZero && !v)) return null
        return (
          <div key={r.key} className="flex items-center gap-2 py-px">
            {r.color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: r.color }} />}
            <span className="text-ink2">{r.label}</span>
            <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">{r.format ? r.format(v) : v}</span>
          </div>
        )
      })}
    </div>
  )
}

function ShareBars({ rows, labelFor, total }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="m-0 p-0 list-none space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-ink truncate">{labelFor(r.key)}</span>
            <span className="shrink-0 tabular-nums text-ink2">
              <b className="text-ink font-semibold">{r.count}</b>
              {total ? <span className="text-ink3"> · {Math.round((r.count / total) * 100)}%</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface2 overflow-hidden" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: A }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ListRow({ c, right, onOpen }) {
  return (
    <li className="flex items-center gap-2 pr-4 sm:pr-5 hover:bg-surface2 min-w-0">
      <button type="button" onClick={() => onOpen(c)}
        className="flex-1 flex items-center gap-3 pl-4 sm:pl-5 py-2.5 text-left bg-transparent border-0 cursor-pointer min-w-0">
        <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center text-xs font-bold">{initials(c.name)}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-ink truncate">{c.name}</span>
          <span className="block text-xs text-ink3 truncate">{[c.planName, c.roomNumber, c.customerNo].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      {right}
    </li>
  )
}

/**
 * Food at a glance: today's kitchen (headcount and menu per meal), money
 * (revenue trend, dues), meals served over two weeks, who eats here, and the
 * follow-ups (plans ending, dues to chase).
 */
export default function FoodDashboard({ data, loading, canManage, noPlans, onOpen, onRenew, onPay, onAddPlan, onAddCustomer, onOpenSheet }) {
  const { t } = useTranslation('food')

  if (!data && loading) {
    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl bg-surface2 animate-pulse" />)}</div>
  }
  if (!data) return null

  if (noPlans || data.kpis.total === 0) {
    return (
      <Card>
        <div className="px-5 py-8 sm:py-10 max-w-xl mx-auto text-center">
          <div className="text-4xl mb-3" aria-hidden>🍽</div>
          <h3 className="m-0 font-display text-lg font-semibold text-ink">{t('setup.title')}</h3>
          <p className="m-0 mt-1.5 text-sm text-ink3">{t('setup.subtitle')}</p>
          <ol className="m-0 mt-6 p-0 list-none grid gap-3 text-left">
            {[
              { done: !noPlans, icon: <LuTags />, title: t('setup.step1'), hint: t('setup.step1Hint'), action: canManage && noPlans && <Button size="sm" onClick={onAddPlan}>{t('plans.add')}</Button> },
              { done: data.kpis.total > 0, icon: <LuUserPlus />, title: t('setup.step2'), hint: t('setup.step2Hint'), action: canManage && !noPlans && <Button size="sm" onClick={onAddCustomer}>{t('addCustomer')}</Button> },
            ].map((s, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.done ? 'border-success bg-success-bg/40' : 'border-line bg-surface'}`}>
                <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${s.done ? 'bg-success-bg text-success-text' : 'bg-gold-bg text-gold'}`} aria-hidden>
                  {s.done ? <LuCircleCheck /> : s.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{s.title}</span>
                  <span className="block text-xs text-ink3">{s.hint}</span>
                </span>
                {!s.done && s.action}
              </li>
            ))}
          </ol>
          <p className="m-0 mt-4 text-xs text-ink3">{t('setup.bookingHint')}</p>
        </div>
      </Card>
    )
  }

  const { kpis, today, trend, served, planMix, sources, diets, expiring, topDues, recentPayments } = data
  const latest = trend[trend.length - 1]
  const anyRevenue = trend.some((m) => m.revenue)
  const anyServed = served.some((d) => d.total)
  const sourceTotal = sources.reduce((n, s) => n + s.count, 0)

  return (
    <div className="fd space-y-4">
      <style>{PALETTE_CSS}</style>

      {/* Today's kitchen */}
      <Card title={t('dash.today')} subtitle={t('dash.todayHint', { count: kpis.mealsToday, served: kpis.servedToday })}
        actions={<Button size="sm" variant="ghost" icon={<LuClipboardList />} onClick={onOpenSheet}>{t('dash.openSheet')}</Button>}>
        {today.length ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5">
            {today.map((m) => (
              <div key={m.meal} className="rounded-xl border border-line px-4 py-3 min-w-0">
                <div className="text-[13px] font-semibold text-ink"><span aria-hidden>{MEAL_ICONS[m.meal]}</span> {t(`meals.${m.meal}`)}</div>
                <div className="mt-1 text-[22px] font-bold text-ink tabular-nums leading-none">
                  {m.served}<span className="text-ink3 text-sm font-medium"> / {m.expected}</span>
                </div>
                <div className="text-xs text-ink3 mt-0.5">{t('sheet.servedOf')}</div>
                <p className="m-0 mt-2 text-xs text-ink2 line-clamp-2">{m.menu || <span className="text-ink3">{t('sheet.noMenu')}</span>}</p>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="🍽" title={t('sheet.emptyTitle')} message={t('sheet.empty')} />}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('dash.revenue')} subtitle={t('dash.revenueHint', { amount: formatCurrency(kpis.revenueThisMonth), last: formatCurrency(kpis.revenueLastMonth) })}>
          <div className="h-56 px-2 pt-3 pb-2" role="img" aria-label={t('dash.revenueAria', { amount: formatCurrency(latest.revenue) })}>
            {anyRevenue ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 22, right: 12, left: -6, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactMoney} tick={axisTick} axisLine={false} tickLine={false} width={52} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface2)' }} content={<ChartTooltip title={monthLabel} rows={[
                    { key: 'revenue', label: t('dash.revenueSeries'), color: A, format: formatCurrency },
                    { key: 'subscriptions', label: t('dash.subscriptionsSeries') },
                  ]} />} />
                  <Bar dataKey="revenue" fill={A} radius={[4, 4, 0, 0]} maxBarSize={36}>
                    <LabelList dataKey="revenue" position="top"
                      content={({ x, y, width, value, index }) => (index === trend.length - 1 && value
                        ? <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">{compactMoney(value)}</text>
                        : null)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="h-full flex items-center justify-center m-0 text-sm text-ink3">{t('dash.noData')}</p>}
          </div>
        </Card>

        <Card title={t('dash.served')} subtitle={t('dash.servedHint')}>
          <div className="h-56 px-2 pt-3 pb-2" role="img" aria-label={t('dash.servedAria', { count: served[served.length - 1]?.total || 0 })}>
            {anyServed ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={served} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={dayLabel} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface2)' }} content={<ChartTooltip title={dayLabel} rows={[
                    { key: 'total', label: t('dash.mealsSeries'), color: A },
                    ...['breakfast', 'lunch', 'snacks', 'dinner'].map((m) => ({ key: m, label: `${MEAL_ICONS[m]} ${t(`meals.${m}`)}`, hideZero: true })),
                  ]} />} />
                  <Bar dataKey="total" fill={A} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="h-full flex items-center justify-center m-0 text-sm text-ink3">{t('dash.noServed')}</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t('dash.planMix')} subtitle={t('dash.planMixHint', { count: kpis.active })}>
          <div className="px-4 sm:px-5 py-4">
            {planMix.length
              ? <ShareBars rows={planMix} total={kpis.active} labelFor={(k) => (k === 'unknown' ? '—' : k)} />
              : <p className="m-0 text-sm text-ink3">{t('dash.noActive')}</p>}
          </div>
        </Card>

        <Card title={t('dash.who')} subtitle={t('dash.whoHint')}>
          <div className="px-4 sm:px-5 py-4 space-y-4">
            {sourceTotal > 0 ? (
              <div>
                <div className="flex h-3 rounded-full overflow-hidden gap-[2px]" aria-hidden>
                  {sources.map((s) => <div key={s.key} style={{ width: `${(s.count / sourceTotal) * 100}%`, background: s.key === 'guest' ? A : B }} />)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
                  {sources.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.key === 'guest' ? A : B }} aria-hidden />
                      {t(`source.${s.key}`)} <b className="text-ink tabular-nums">{s.count}</b>
                      <span className="text-ink3">({Math.round((s.count / sourceTotal) * 100)}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : <p className="m-0 text-sm text-ink3">{t('dash.noActive')}</p>}
            {diets.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-ink2 mb-1.5">{t('dash.diets')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {diets.map((d) => (
                    <span key={d.key} className="rounded-full bg-surface2 px-2.5 py-1 text-xs text-ink2">
                      {d.key === 'unknown' ? t('dash.notGiven') : t(`diets.${d.key}`)} <b className="text-ink tabular-nums">{d.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('dash.followUp')} subtitle={t('dash.followUpHint')} bodyClassName="py-1">
          {expiring.length ? (
            <ul className="m-0 p-0 list-none divide-y divide-line">
              {expiring.map((c) => (
                <ListRow key={c.id} c={c} onOpen={onOpen} right={
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:flex flex-col items-end text-xs">
                      <StatusPill status={c.status} />
                      <span className="text-ink3 mt-0.5">{daysLeftLabel(t, c)}</span>
                    </span>
                    {canManage && (
                      <button type="button" onClick={() => onRenew(c)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gold-bg text-gold px-2.5 py-1.5 pointer-coarse:min-h-11 text-xs font-semibold border-0 cursor-pointer hover:bg-gold hover:text-black">
                        <LuRefreshCw size={12} aria-hidden /> {t('actions.renew')}
                      </button>
                    )}
                  </span>
                } />
              ))}
            </ul>
          ) : <EmptyState icon="✅" title={t('dash.allGood')} message={t('dash.noExpiring')} />}
        </Card>

        <Card title={t('dash.dues')} subtitle={t('dash.duesHint', { amount: formatCurrency(kpis.duesAmount), count: kpis.duesCustomers })} bodyClassName="py-1">
          {topDues.length ? (
            <ul className="m-0 p-0 list-none divide-y divide-line">
              {topDues.map((c) => (
                <ListRow key={c.id} c={c} onOpen={onOpen} right={
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-semibold text-danger-text tabular-nums">{formatCurrency(c.due)}</span>
                    {canManage && (
                      <button type="button" onClick={() => onPay(c)} aria-label={t('pay.collectFrom', { name: c.name })}
                        className="inline-flex items-center rounded-lg border border-line2 bg-surface px-2 py-1.5 pointer-coarse:min-h-11 text-ink2 cursor-pointer hover:border-gold hover:text-gold">
                        <LuIndianRupee size={13} aria-hidden />
                      </button>
                    )}
                  </span>
                } />
              ))}
            </ul>
          ) : <EmptyState icon="💰" title={t('dash.noDuesTitle')} message={t('dash.noDues')} />}
        </Card>

        <Card title={t('dash.recent')} bodyClassName="py-1">
          {recentPayments.length ? (
            <ul className="m-0 p-0 list-none divide-y divide-line">
              {recentPayments.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 min-w-0">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-ink truncate">{p.customer?.name}</span>
                    <span className="block text-xs text-ink3 truncate">{[p.planName, t(`payModes.${p.mode}`), shortDate(p.paidAt)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-success-text tabular-nums">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="🧾" title={t('dash.noPaymentsTitle')} message={t('dash.noPayments')} />}
        </Card>
      </div>
    </div>
  )
}
