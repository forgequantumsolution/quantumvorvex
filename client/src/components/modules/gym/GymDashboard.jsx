import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { LuRefreshCw, LuIndianRupee, LuTags, LuUserPlus, LuCircleCheck } from 'react-icons/lu'
import { Card, Button, EmptyState } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { StatusPill } from './MemberDetailModal'
import { compactMoney, monthLabel, daysLeftLabel, shortDate, initials } from './gymUtils'

// ── Colours ───────────────────────────────────────────────────────────────────
// Two categorical slots, validated with the dataviz palette checker against the
// card surface in both modes (CVD ΔE ≈ 26, contrast ≥ 3:1 — all checks pass):
//   A = brand gold   (light #a8862e, dark #b0903a)  — revenue, new sign-ups, hotel guests
//   B = blue         (light #2a78d6, dark #3987e5)  — renewals, outside members
// Single-series charts use A only. Text never wears these colours.
const PALETTE_CSS = `
.gd{--gd-a:#a8862e;--gd-b:#2a78d6}
.dark .gd{--gd-a:#b0903a;--gd-b:#3987e5}
`
const A = 'var(--gd-a)'
const B = 'var(--gd-b)'
const axisTick = { fontSize: 11, fill: 'var(--text3)' }

function ChartTooltip({ active, payload, label, rows }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line2 rounded-lg shadow-soft px-3 py-2 text-xs min-w-[150px]">
      <div className="text-ink3 mb-1">{monthLabel(label)}</div>
      {rows.map((r) => {
        const p = payload.find((x) => x.dataKey === r.key)
        if (!p) return null
        return (
          <div key={r.key} className="flex items-center gap-2 py-px">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: r.color }} />
            <span className="text-ink2">{r.label}</span>
            <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">{r.format ? r.format(p.value) : p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.color }} aria-hidden />{i.label}
        </span>
      ))}
    </div>
  )
}

/** Horizontal share bars in plain HTML: label, bar, count + share. One hue. */
function ShareBars({ rows, labelFor, total, valueFor = (r) => r.count, formatValue = (v) => v, color = A }) {
  const max = Math.max(1, ...rows.map(valueFor))
  return (
    <ul className="m-0 p-0 list-none space-y-2.5">
      {rows.map((r) => {
        const v = valueFor(r)
        return (
          <li key={r.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink truncate">{labelFor(r.key)}</span>
              <span className="shrink-0 tabular-nums text-ink2">
                <b className="text-ink font-semibold">{formatValue(v)}</b>
                {total ? <span className="text-ink3"> · {Math.round((r.count / total) * 100)}%</span> : null}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface2 overflow-hidden" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// A follow-up row: the member opens on tap; the action sits beside it (never nested).
function ListRow({ m, right, onOpen }) {
  return (
    <li className="flex items-center gap-2 pr-4 sm:pr-5 hover:bg-surface2 min-w-0">
      <button type="button" onClick={() => onOpen(m)}
        className="flex-1 flex items-center gap-3 pl-4 sm:pl-5 py-2.5 text-left bg-transparent border-0 cursor-pointer min-w-0">
        <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center text-xs font-bold">{initials(m.name)}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-ink truncate">{m.name}</span>
          <span className="block text-xs text-ink3 truncate">{[m.planName, m.memberNo].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      {right}
    </li>
  )
}

/**
 * The gym at a glance: money (revenue trend, dues), the member base (sign-ups
 * vs renewals, plan mix, who trains here) and today's follow-ups (plans ending,
 * dues to chase) — each follow-up one tap from the action.
 */
export default function GymDashboard({ data, loading, canManage, onOpen, onRenew, onPay, onAddPlan, onAddMember, noPlans }) {
  const { t } = useTranslation('gym')

  if (!data && loading) {
    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl bg-surface2 animate-pulse" />)}</div>
  }
  if (!data) return null

  // First run: walk the owner through setup.
  if (noPlans || data.kpis.total === 0) {
    return (
      <Card>
        <div className="px-5 py-8 sm:py-10 max-w-xl mx-auto text-center">
          <div className="text-4xl mb-3" aria-hidden>🏋️</div>
          <h3 className="m-0 font-display text-lg font-semibold text-ink">{t('setup.title')}</h3>
          <p className="m-0 mt-1.5 text-sm text-ink3">{t('setup.subtitle')}</p>
          <ol className="m-0 mt-6 p-0 list-none grid gap-3 text-left">
            {[
              { done: !noPlans, icon: <LuTags />, title: t('setup.step1'), hint: t('setup.step1Hint'), action: canManage && noPlans && <Button size="sm" onClick={onAddPlan}>{t('plans.add')}</Button> },
              { done: data.kpis.total > 0, icon: <LuUserPlus />, title: t('setup.step2'), hint: t('setup.step2Hint'), action: canManage && !noPlans && <Button size="sm" onClick={onAddMember}>{t('addMember')}</Button> },
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
        </div>
      </Card>
    )
  }

  const { kpis, trend, planMix, sources, genders, goals, payModes, expiring, topDues, recentPayments } = data
  const latest = trend[trend.length - 1]
  const anyTrend = trend.some((m) => m.revenue || m.signups || m.renewals)
  const sourceTotal = sources.reduce((n, s) => n + s.count, 0)

  return (
    <div className="gd space-y-4">
      <style>{PALETTE_CSS}</style>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend — single series, the latest month labelled. */}
        <Card title={t('dash.revenue')} subtitle={t('dash.revenueHint', { amount: formatCurrency(kpis.revenueThisMonth), last: formatCurrency(kpis.revenueLastMonth) })}>
          <div className="h-56 px-2 pt-3 pb-2" role="img" aria-label={t('dash.revenueAria', { amount: formatCurrency(latest.revenue) })}>
            {anyTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 22, right: 12, left: -6, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactMoney} tick={axisTick} axisLine={false} tickLine={false} width={52} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface2)' }} content={<ChartTooltip rows={[{ key: 'revenue', label: t('dash.revenueSeries'), color: A, format: formatCurrency }]} />} />
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

        {/* Sign-ups vs renewals — two series, stacked, 2px surface gap. */}
        <Card title={t('dash.joins')} subtitle={t('dash.joinsHint')} actions={<Legend items={[{ label: t('dash.signups'), color: A }, { label: t('dash.renewals'), color: B }]} />}>
          <div className="h-56 px-2 pt-3 pb-2" role="img" aria-label={t('dash.joinsAria', { signups: latest.signups, renewals: latest.renewals })}>
            {anyTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface2)' }} content={<ChartTooltip rows={[
                    { key: 'signups', label: t('dash.signups'), color: A },
                    { key: 'renewals', label: t('dash.renewals'), color: B },
                  ]} />} />
                  <Bar dataKey="signups" stackId="j" fill={A} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} />
                  <Bar dataKey="renewals" stackId="j" fill={B} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="h-full flex items-center justify-center m-0 text-sm text-ink3">{t('dash.noData')}</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card title={t('dash.planMix')} subtitle={t('dash.planMixHint', { count: kpis.active })}>
          <div className="px-4 sm:px-5 py-4">
            {planMix.length
              ? <ShareBars rows={planMix} total={kpis.active} labelFor={(k) => (k === 'unknown' ? '—' : k)} />
              : <p className="m-0 text-sm text-ink3">{t('dash.noActive')}</p>}
          </div>
        </Card>

        <Card title={t('dash.who')} subtitle={t('dash.whoHint')}>
          <div className="px-4 sm:px-5 py-4 space-y-4">
            {sourceTotal > 0 && (
              <div>
                {/* Two-part bar: each part named with its count and share, so colour is never the only cue. */}
                <div className="flex h-3 rounded-full overflow-hidden gap-[2px]" aria-hidden>
                  {sources.map((s) => (
                    <div key={s.key} style={{ width: `${(s.count / sourceTotal) * 100}%`, background: s.key === 'guest' ? A : B }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
                  {sources.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.key === 'guest' ? A : B }} aria-hidden />
                      {t(`dash.source.${s.key}`)} <b className="text-ink tabular-nums">{s.count}</b>
                      <span className="text-ink3">({Math.round((s.count / sourceTotal) * 100)}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-ink2 mb-1.5">{t('dash.gender')}</div>
              <div className="flex flex-wrap gap-1.5">
                {genders.map((g) => (
                  <span key={g.key} className="rounded-full bg-surface2 px-2.5 py-1 text-xs text-ink2">
                    {g.key === 'unknown' ? t('dash.notGiven') : t(`genders.${g.key}`)} <b className="text-ink tabular-nums">{g.count}</b>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink2 mb-1.5">{t('dash.goals')}</div>
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <span key={g.key} className="rounded-full bg-surface2 px-2.5 py-1 text-xs text-ink2">
                    {g.key === 'unknown' ? t('dash.notGiven') : t(`goals.${g.key}`)} <b className="text-ink tabular-nums">{g.count}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title={t('dash.collections')} subtitle={t('dash.collectionsHint')} className="md:col-span-2 xl:col-span-1">
          <div className="px-4 sm:px-5 py-4 space-y-4">
            {payModes.length
              ? <ShareBars rows={payModes} labelFor={(k) => t(`payModes.${k}`)} valueFor={(r) => r.amount} formatValue={formatCurrency} />
              : <p className="m-0 text-sm text-ink3">{t('dash.noPayments')}</p>}
            <dl className="m-0 grid grid-cols-2 gap-3 pt-3 border-t border-line text-sm">
              <div><dt className="text-xs text-ink3">{t('dash.perMember')}</dt><dd className="m-0 font-semibold text-ink tabular-nums">{formatCurrency(kpis.revenuePerMember)}</dd></div>
              <div><dt className="text-xs text-ink3">{t('dash.renewalRate')}</dt><dd className="m-0 font-semibold text-ink tabular-nums">{kpis.renewalRate == null ? '—' : `${kpis.renewalRate}%`}</dd></div>
            </dl>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('dash.followUp')} subtitle={t('dash.followUpHint')} bodyClassName="py-1">
          {expiring.length ? (
            <ul className="m-0 p-0 list-none divide-y divide-line">
              {expiring.map((m) => (
                <ListRow key={m.id} m={m} onOpen={onOpen} right={
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:flex flex-col items-end text-xs">
                      <StatusPill status={m.status} />
                      <span className="text-ink3 mt-0.5">{daysLeftLabel(t, m)}</span>
                    </span>
                    {canManage && (
                      <button type="button" onClick={() => onRenew(m)}
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

        <Card title={t('dash.dues')} subtitle={t('dash.duesHint', { amount: formatCurrency(kpis.duesAmount), count: kpis.duesMembers })} bodyClassName="py-1">
          {topDues.length ? (
            <ul className="m-0 p-0 list-none divide-y divide-line">
              {topDues.map((m) => (
                <ListRow key={m.id} m={m} onOpen={onOpen} right={
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-semibold text-danger-text tabular-nums">{formatCurrency(m.due)}</span>
                    {canManage && (
                      <button type="button" onClick={() => onPay(m)} aria-label={t('pay.collectFrom', { name: m.name })}
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
                    <span className="block text-[13px] text-ink truncate">{p.member?.name}</span>
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
