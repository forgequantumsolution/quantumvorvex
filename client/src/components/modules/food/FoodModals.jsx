import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuRefreshCw, LuIndianRupee, LuSave } from 'react-icons/lu'
import { Modal, Field, Button } from '../../ui-tw'
import { foodApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import SubscriptionFields from './SubscriptionFields'
import {
  CYCLES, MEALS, MEAL_ICONS, PAY_MODES, EMPTY_SALE, todayInput, fieldErrors, shortDate, planCycles, renewalStart,
  saleFor, saleErrors, salePayload,
} from './foodUtils'

/** Renew, or put an existing customer on a (new) meal plan. */
export function SubscribeModal({ customer, plans, onClose, onSaved }) {
  const { t } = useTranslation('food')
  const sellable = plans.filter((p) => p.active && planCycles(p).length)
  const preferred = sellable.find((p) => p.id === customer.current?.planId) || sellable[0]
  const [sale, setSale] = useState(() => saleFor(preferred, {
    ...EMPTY_SALE,
    ...(customer.current && { cycle: customer.current.cycle, units: String(customer.current.units) }),
  }))
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const renewing = customer.status !== 'no_plan'

  const submit = async () => {
    const e = saleErrors(t, plans, sale)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true); setApiError('')
    try {
      await foodApi.subscribe(customer.id, salePayload(plans, sale))
      onSaved(renewing ? t('toast.renewed', { name: customer.name }) : t('toast.subscribed', { name: customer.name }))
    } catch (err) {
      setErrors(fieldErrors(err))
      setApiError(err.response?.data?.message || t('toast.failed'))
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} size="lg"
      title={renewing ? t('sale.renewTitle', { name: customer.name }) : t('sale.newTitle', { name: customer.name })}
      subtitle={customer.current ? t('sale.currentPlan', { plan: customer.current.planName, date: shortDate(customer.current.endDate) }) : customer.customerNo}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={<LuRefreshCw />} onClick={submit} disabled={saving}>{renewing ? t('actions.renew') : t('actions.subscribe')}</Button>
      </>}>
      {apiError && <div role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}
      <SubscriptionFields plans={plans} sale={sale} onChange={setSale} errors={errors} defaultStart={renewalStart(customer, todayInput())} />
    </Modal>
  )
}

/** Collect (part of) what is due on one subscription. */
export function PaymentModal({ customer, subscription, onClose, onSaved }) {
  const { t } = useTranslation('food')
  const [amount, setAmount] = useState(String(subscription.due))
  const [mode, setMode] = useState('cash')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const n = Number(amount)
    if (!(n > 0)) return setError(t('errors.amount'))
    if (n > subscription.due) return setError(t('errors.overpaid', { amount: formatCurrency(subscription.due) }))
    setSaving(true); setError('')
    try {
      await foodApi.pay(subscription.id, { amount: n, mode })
      onSaved(t('toast.paid', { amount: formatCurrency(n), name: customer.name }))
    } catch (err) {
      setError(err.response?.data?.message || t('toast.failed'))
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title={t('pay.title')}
      subtitle={`${customer.name} · ${subscription.planName}`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={<LuIndianRupee />} onClick={submit} disabled={saving}>{t('pay.collect')}</Button>
      </>}>
      <div className="space-y-3.5">
        <div className="rounded-lg bg-surface2 border border-line px-3.5 py-2.5 flex items-center justify-between text-sm">
          <span className="text-ink2">{t('pay.due')}</span>
          <span className="font-semibold text-danger-text tabular-nums">{formatCurrency(subscription.due)}</span>
        </div>
        <Field label={t('pay.amount')} type="number" min="0" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} error={error} autoFocus />
        <Field label={t('sale.payMode')} value={mode} onChange={(e) => setMode(e.target.value)}
          options={PAY_MODES.map((m) => ({ value: m, label: t(`payModes.${m}`) }))} />
      </div>
    </Modal>
  )
}

const RATE_KEYS = { daily: 'oneTimeRate', weekly: 'weeklyRate', monthly: 'monthlyRate' }

/** Add / edit a meal plan: which meals it includes and its per day / week / month rates. */
export function PlanModal({ plan, onClose, onSaved }) {
  const { t } = useTranslation('food')
  const editing = !!plan?.id
  const [form, setForm] = useState(() => ({
    name: plan?.name || '', description: plan?.description || '',
    meals: plan?.meals?.length ? plan.meals : ['breakfast', 'lunch', 'dinner'],
    ...Object.fromEntries(CYCLES.map((c) => [RATE_KEYS[c], plan?.[RATE_KEYS[c]] ? String(plan[RATE_KEYS[c]]) : ''])),
    active: plan?.active ?? true,
  }))
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleMeal = (m) => setForm((f) => ({ ...f, meals: f.meals.includes(m) ? f.meals.filter((x) => x !== m) : MEALS.filter((x) => x === m || f.meals.includes(x)) }))

  const submit = async () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = t('errors.planName')
    if (!form.meals.length) e.meals = t('errors.meals')
    if (!CYCLES.some((c) => Number(form[RATE_KEYS[c]]) > 0)) e.rates = t('errors.rates')
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true); setApiError('')
    const body = {
      name: form.name.trim(), description: form.description.trim(), meals: form.meals, active: form.active,
      ...Object.fromEntries(CYCLES.map((c) => [RATE_KEYS[c], Number(form[RATE_KEYS[c]]) || 0])),
    }
    try {
      if (editing) await foodApi.updatePlan(plan.id, body)
      else await foodApi.createPlan(body)
      onSaved(editing ? t('toast.planUpdated') : t('toast.planAdded', { name: body.name }))
    } catch (err) {
      setErrors(fieldErrors(err))
      setApiError(err.response?.data?.message || t('toast.failed'))
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} size="md" title={editing ? t('plans.editTitle') : t('plans.newTitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={<LuSave />} onClick={submit} disabled={saving}>{editing ? t('form.save') : t('plans.add')}</Button>
      </>}>
      <div className="space-y-4">
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}
        <Field label={t('plans.name')} value={form.name} onChange={set('name')} error={errors.name} maxLength={50}
          placeholder={t('plans.namePlaceholder')} autoFocus />
        <div>
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('plans.meals')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MEALS.map((m) => {
              const on = form.meals.includes(m)
              return (
                <button key={m} type="button" role="checkbox" aria-checked={on} onClick={() => toggleMeal(m)}
                  className={`rounded-lg border px-3 py-2 text-[13px] font-medium cursor-pointer min-h-10 ${on ? 'border-gold bg-gold-bg text-ink' : 'border-line2 bg-surface text-ink2 hover:border-gold'}`}>
                  <span aria-hidden>{MEAL_ICONS[m]}</span> {t(`meals.${m}`)}
                </button>
              )
            })}
          </div>
          {errors.meals && <p className="m-0 mt-1 text-xs text-danger-text">{errors.meals}</p>}
        </div>
        <div>
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('plans.rates')}</span>
          <div className="grid grid-cols-3 gap-3">
            {CYCLES.map((c) => (
              <Field key={c} label={`${t(`cycles.${c}`)} ₹`} type="number" min="0" inputMode="decimal" placeholder="—"
                value={form[RATE_KEYS[c]]} onChange={set(RATE_KEYS[c])} />
            ))}
          </div>
          <p className={`m-0 mt-1 text-xs ${errors.rates ? 'text-danger-text' : 'text-ink3'}`}>{errors.rates || t('plans.ratesHint')}</p>
        </div>
        <Field label={t('plans.description')} textarea value={form.description} onChange={set('description')} maxLength={300}
          placeholder={t('plans.descriptionPlaceholder')} />
        {editing && (
          <label className="flex items-center gap-2 text-sm text-ink2 cursor-pointer">
            <input type="checkbox" className="accent-[var(--gold)] w-4 h-4" checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            {t('plans.activeLabel')}
          </label>
        )}
        {editing && <p className="m-0 text-xs text-ink3">{t('plans.editNote')}</p>}
      </div>
    </Modal>
  )
}
