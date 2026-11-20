import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuRefreshCw, LuIndianRupee, LuSave } from 'react-icons/lu'
import { Modal, Field, Button } from '../../ui-tw'
import { gymApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import PlanSaleFields from './PlanSaleFields'
import { EMPTY_SALE, saleErrors, salePayload } from './gymSale'
import { PAY_MODES, DURATION_PRESETS, dateInput, todayInput, durationLabel, fieldErrors, shortDate } from './gymUtils'

// Day after the member's current plan ends (or today if it already ended).
const renewalStart = (member) => {
  const end = member?.current?.endDate && member.status !== 'expired' && member.status !== 'no_plan'
    ? new Date(member.current.endDate) : null
  if (!end) return todayInput()
  end.setDate(end.getDate() + 1)
  return dateInput(end)
}

/** Renew, or sell a new plan to an existing member. */
export function SellPlanModal({ member, plans, onClose, onSaved }) {
  const { t } = useTranslation('gym')
  const preferred = plans.find((p) => p.active && p.id === member.current?.planId) || plans.find((p) => p.active)
  const [sale, setSale] = useState({ ...EMPTY_SALE, planId: preferred?.id || '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const renewing = member.status !== 'no_plan'

  const submit = async () => {
    const e = saleErrors(t, plans, sale)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true); setApiError('')
    try {
      const body = salePayload(plans, sale)
      const { data } = await gymApi.sellPlan(member.id, body)
      // A payment taken with the sale gets a receipt offer; otherwise a welcome.
      const ms = data.membership
      const payment = body.amountPaid > 0 ? { amount: body.amountPaid, mode: body.payMode, paidAt: new Date().toISOString() } : null
      onSaved(renewing ? t('toast.renewed', { name: member.name }) : t('toast.planSold', { name: member.name }), { membership: ms, payment })
    } catch (err) {
      setErrors(fieldErrors(err))
      setApiError(err.response?.data?.message || t('toast.failed'))
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} size="lg"
      title={renewing ? t('sale.renewTitle', { name: member.name }) : t('sale.newTitle', { name: member.name })}
      subtitle={member.current ? t('sale.currentPlan', { plan: member.current.planName, date: shortDate(member.current.endDate) }) : member.memberNo}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={<LuRefreshCw />} onClick={submit} disabled={saving}>{renewing ? t('actions.renew') : t('actions.sellPlan')}</Button>
      </>}>
      {apiError && <div role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}
      <PlanSaleFields plans={plans} sale={sale} onChange={setSale} errors={errors} defaultStart={renewalStart(member)} />
    </Modal>
  )
}

/** Collect (part of) what is due on one membership. */
export function PaymentModal({ member, membership, onClose, onSaved }) {
  const { t } = useTranslation('gym')
  const [amount, setAmount] = useState(String(membership.due))
  const [mode, setMode] = useState('cash')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const n = Number(amount)
    if (!(n > 0)) return setError(t('errors.amount'))
    if (n > membership.due) return setError(t('errors.overpaid', { amount: formatCurrency(membership.due) }))
    setSaving(true); setError('')
    try {
      const { data } = await gymApi.pay(membership.id, { amount: n, mode })
      onSaved(t('toast.paid', { amount: formatCurrency(n), name: member.name }),
        { membership: data.membership, payment: { amount: n, mode, paidAt: new Date().toISOString() } })
    } catch (err) {
      setError(err.response?.data?.message || t('toast.failed'))
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title={t('pay.title')}
      subtitle={`${member.name} · ${membership.planName}`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={<LuIndianRupee />} onClick={submit} disabled={saving}>{t('pay.collect')}</Button>
      </>}>
      <div className="space-y-3.5">
        <div className="rounded-lg bg-surface2 border border-line px-3.5 py-2.5 flex items-center justify-between text-sm">
          <span className="text-ink2">{t('pay.due')}</span>
          <span className="font-semibold text-danger-text tabular-nums">{formatCurrency(membership.due)}</span>
        </div>
        <Field label={t('pay.amount')} type="number" min="0" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} error={error} autoFocus />
        <Field label={t('sale.payMode')} value={mode} onChange={(e) => setMode(e.target.value)}
          options={PAY_MODES.map((m) => ({ value: m, label: t(`payModes.${m}`) }))} />
      </div>
    </Modal>
  )
}

/** Add / edit a membership plan. */
export function PlanModal({ plan, onClose, onSaved }) {
  const { t } = useTranslation('gym')
  const editing = !!plan?.id
  const [form, setForm] = useState(() => ({
    name: plan?.name || '', durationDays: String(plan?.durationDays || 30), price: plan?.price != null ? String(plan.price) : '',
    description: plan?.description || '', active: plan?.active ?? true,
  }))
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const days = Number(form.durationDays) || 0
  const perMonth = days && Number(form.price) ? (Number(form.price) / days) * 30 : null

  const submit = async () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = t('errors.planName')
    if (!(days >= 1)) e.durationDays = t('errors.duration')
    if (form.price === '' || Number(form.price) < 0) e.price = t('errors.price')
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true); setApiError('')
    const body = { name: form.name.trim(), durationDays: days, price: Number(form.price), description: form.description.trim(), active: form.active }
    try {
      if (editing) await gymApi.updatePlan(plan.id, body)
      else await gymApi.createPlan(body)
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
      <div className="space-y-3.5">
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}
        <Field label={t('plans.name')} value={form.name} onChange={set('name')} error={errors.name} maxLength={60}
          placeholder={t('plans.namePlaceholder')} autoFocus />
        <div>
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('plans.duration')}</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {DURATION_PRESETS.map((d) => (
              <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, durationDays: String(d) }))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold cursor-pointer min-h-9 ${days === d ? 'border-gold bg-gold-bg text-gold' : 'border-line2 bg-surface text-ink2 hover:border-gold'}`}>
                {durationLabel(t, d)}
              </button>
            ))}
          </div>
          <Field aria-label={t('plans.days')} type="number" min="1" max="1095" inputMode="numeric" value={form.durationDays}
            onChange={set('durationDays')} error={errors.durationDays} hint={days ? `${t('plans.days')}: ${durationLabel(t, days)}` : undefined} />
        </div>
        <Field label={t('plans.price')} type="number" min="0" inputMode="decimal" value={form.price} onChange={set('price')}
          error={errors.price} hint={perMonth != null && days > 30 ? t('plans.perMonth', { amount: formatCurrency(Math.round(perMonth)) }) : undefined} />
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
