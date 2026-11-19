import { useTranslation } from 'react-i18next'
import { Field } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { PAY_MODES, durationLabel, planEnd, shortDate } from './gymUtils'
import { saleTotals } from './gymSale'

/**
 * Plan picker + start date + discount + payment, with a live summary.
 * `defaultStart` (yyyy-mm-dd) is shown when no start date is typed — for a
 * renewal, the day after the current plan ends.
 */
export default function PlanSaleFields({ plans, sale, onChange, errors = {}, defaultStart }) {
  const { t } = useTranslation('gym')
  const set = (k) => (e) => onChange({ ...sale, [k]: e.target.value })
  const active = plans.filter((p) => p.active)
  const { plan, payable, paid, due } = saleTotals(plans, sale)
  const start = sale.startDate || defaultStart
  const end = plan && start ? planEnd(start, plan.durationDays) : null

  if (!active.length) {
    return <p className="m-0 text-sm text-ink3 rounded-lg border border-dashed border-line2 px-3 py-4 text-center">{t('sale.noPlans')}</p>
  }

  return (
    <div className="space-y-3.5">
      {/* Plans as tappable cards: price and length at a glance. */}
      <div role="radiogroup" aria-label={t('sale.plan')} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {active.map((p) => {
          const on = sale.planId === p.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on}
              onClick={() => onChange({ ...sale, planId: p.id })}
              className={`text-left rounded-lg border px-3 py-2.5 min-w-0 transition-colors cursor-pointer ${
                on ? 'border-gold bg-gold-bg' : 'border-line2 bg-surface hover:border-gold'}`}>
              <span className="block text-[13px] font-semibold text-ink truncate">{p.name}</span>
              <span className="block text-xs text-ink3">{durationLabel(t, p.durationDays)}</span>
              <span className="block text-sm font-semibold text-ink mt-1 tabular-nums">{formatCurrency(p.price)}</span>
            </button>
          )
        })}
      </div>
      {errors.planId && <p className="m-0 -mt-1.5 text-xs text-danger-text">{errors.planId}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field className="col-span-2 sm:col-span-1" label={t('sale.startDate')} type="date" value={sale.startDate}
          onChange={set('startDate')} hint={!sale.startDate && defaultStart ? shortDate(`${defaultStart}T00:00`) : undefined} />
        <Field label={t('sale.discount')} type="number" min="0" inputMode="decimal" value={sale.discount}
          onChange={set('discount')} placeholder="0" />
        <Field label={t('sale.amountPaid')} name="amountPaid" type="number" min="0" inputMode="decimal" value={sale.amountPaid}
          onChange={set('amountPaid')} placeholder={plan ? String(payable) : '0'} error={errors.amountPaid} />
        <Field className="col-span-2 sm:col-span-1" label={t('sale.payMode')} value={sale.payMode} onChange={set('payMode')}
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
