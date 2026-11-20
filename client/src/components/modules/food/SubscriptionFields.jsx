import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { CYCLES, PAY_MODES, MEAL_ICONS, planRate, planCycles, saleTotals, saleFor, subEnd, shortDate } from './foodUtils'

/**
 * Meal plan picker + billing (per day / week / month × how many) + start date,
 * discount and payment, with a live summary. `defaultStart` (yyyy-mm-dd) is
 * used when no start date is typed — for a renewal, the day after the current
 * plan ends.
 */
export default function SubscriptionFields({ plans, sale, onChange, errors = {}, defaultStart }) {
  const { t } = useTranslation('food')
  const set = (k) => (e) => onChange({ ...sale, [k]: e.target.value })
  const active = plans.filter((p) => p.active && planCycles(p).length)
  const { plan, units, payable, paid, due } = saleTotals(plans, sale)
  const start = sale.startDate || defaultStart
  const end = plan && start ? subEnd(start, sale.cycle, units) : null
  const cycles = plan ? planCycles(plan) : CYCLES

  if (!active.length) {
    return <p className="m-0 text-sm text-ink3 rounded-lg border border-dashed border-line2 px-3 py-4 text-center">{t('sale.noPlans')}</p>
  }

  return (
    <div className="space-y-3.5">
      <div role="radiogroup" aria-label={t('sale.plan')} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {active.map((p) => {
          const on = sale.planId === p.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} name="planId"
              onClick={() => onChange(saleFor(p, sale))}
              className={`text-left rounded-lg border px-3 py-2.5 min-w-0 transition-colors cursor-pointer ${
                on ? 'border-gold bg-gold-bg' : 'border-line2 bg-surface hover:border-gold'}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink truncate">{p.name}</span>
                <span className="shrink-0 text-sm" aria-hidden>{p.meals.map((m) => MEAL_ICONS[m]).join('')}</span>
              </span>
              <span className="block text-xs text-ink3 truncate">{p.meals.map((m) => t(`meals.${m}`)).join(' · ')}</span>
              <span className="block text-xs text-ink2 mt-1 tabular-nums">
                {planCycles(p).map((c) => `${formatCurrency(planRate(p, c))}${t(`cycles.per.${c}`)}`).join(' · ')}
              </span>
            </button>
          )
        })}
      </div>
      {errors.planId && <p className="m-0 -mt-1.5 text-xs text-danger-text">{errors.planId}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={t('sale.billing')} name="cycle" value={sale.cycle} onChange={set('cycle')} error={errors.cycle}
          options={cycles.map((c) => ({ value: c, label: t(`cycles.${c}`) }))} />
        <Field label={t(`sale.units.${sale.cycle}`)} name="units" type="number" min="1" max="365" inputMode="numeric"
          value={sale.units} onChange={set('units')} error={errors.units} />
        <Field className="col-span-2" label={t('sale.startDate')} type="date" value={sale.startDate}
          onChange={set('startDate')} hint={!sale.startDate && defaultStart ? shortDate(`${defaultStart}T00:00`) : undefined} />
        <Field label={t('sale.discount')} type="number" min="0" inputMode="decimal" value={sale.discount}
          onChange={set('discount')} placeholder="0" />
        <Field label={t('sale.amountPaid')} name="amountPaid" type="number" min="0" inputMode="decimal" value={sale.amountPaid}
          onChange={set('amountPaid')} placeholder={plan ? String(payable) : '0'} error={errors.amountPaid} />
        <Field className="col-span-2" label={t('sale.payMode')} value={sale.payMode} onChange={set('payMode')}
          options={PAY_MODES.map((m) => ({ value: m, label: t(`payModes.${m}`) }))} />
      </div>

      {plan && (
        <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-surface2 border border-line px-3.5 py-3 text-sm">
          <div><dt className="text-xs text-ink3">{t('sale.validTill')}</dt><dd className="m-0 font-semibold text-ink">{end ? shortDate(end) : '—'}</dd></div>
          <div><dt className="text-xs text-ink3">{t('sale.payable')}</dt><dd className="m-0 font-semibold text-ink tabular-nums">{formatCurrency(payable)}</dd></div>
          <div><dt className="text-xs text-ink3">{t('sale.paidNow')}</dt><dd className="m-0 font-semibold text-success-text tabular-nums">{formatCurrency(paid)}</dd></div>
          <div><dt className="text-xs text-ink3">{t('sale.due')}</dt><dd className={`m-0 font-semibold tabular-nums ${due > 0 ? 'text-danger-text' : 'text-ink'}`}>{formatCurrency(due)}</dd></div>
        </dl>
      )}
    </div>
  )
}
