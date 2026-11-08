import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuInfo } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Field, Button } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { expensesApi } from '../../../api/client'
import { GROUPS, PAID_FROM, MODES, today, dayKey } from './expenseUtils'
import CategoryPicker from './CategoryPicker'

const blank = (keep = {}) => ({
  type: 'expense', payee: '', categoryId: '', amount: '', date: today(), status: 'paid',
  paidFrom: 'reception', paidByName: '', paymentMode: 'cash', reference: '', description: '', ...keep,
})

// Two- or three-way segmented switch (type, status, paid from).
function Segmented({ label, value, options, onChange }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs font-medium text-ink2 mb-1.5">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1 bg-surface2 border border-line rounded-lg p-1">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 truncate rounded-md px-2 py-1.5 text-[13px] font-medium min-h-10 sm:min-h-0 transition-colors ${
              value === o.value ? (o.activeClass || 'bg-surface text-ink shadow-soft') : 'text-ink2 hover:text-ink'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Add or edit one cash-book entry. Picking a payee seen before fills in its
 * category (and last amount, if none typed yet). "Save & add another" keeps the
 * date, type and who paid, for entering a day's sheet in one go.
 */
export default function ExpenseModal({ expense, categories, onClose, onSaved }) {
  const { t } = useTranslation('expenses')
  const toast = useToast()
  const [form, setForm] = useState(() => (expense ? {
    ...blank(),
    ...Object.fromEntries(Object.entries(expense).filter(([, v]) => v != null)),
    amount: String(expense.amount ?? ''),
    date: dayKey(expense.date) || today(),
  } : blank()))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [payees, setPayees] = useState([])

  useEffect(() => {
    let off = false
    expensesApi.payees().then(({ data }) => { if (!off) setPayees(data.payees || []) }).catch(() => {})
    return () => { off = true }
  }, [])

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onPayee = (value) => {
    const known = payees.find((p) => p.payee.toLowerCase() === value.trim().toLowerCase())
    setForm((f) => ({
      ...f,
      payee: value,
      ...(known && { categoryId: known.categoryId || f.categoryId, amount: f.amount || (known.lastAmount ? String(known.lastAmount) : '') }),
    }))
    setErrors((e) => ({ ...e, payee: undefined, ...(known && { categoryId: undefined, amount: undefined }) }))
  }

  // Active categories by group (plus the one this entry already uses, even if since deactivated).
  // Money in: the "other" group (where Other income lives) comes first.
  const grouped = useMemo(() => {
    const order = form.type === 'income' ? ['admin_other', ...GROUPS.filter((g) => g !== 'admin_other')] : GROUPS
    return order.map((g) => ({
      group: g,
      items: categories.filter((c) => c.group === g && (c.active !== false || c.id === form.categoryId)),
    })).filter((g) => g.items.length)
  }, [categories, form.categoryId, form.type])

  const category = categories.find((c) => c.id === form.categoryId)

  const validate = () => {
    const e = {}
    if (!form.payee.trim()) e.payee = t(form.type === 'income' ? 'form.errors.payer' : 'form.errors.payee')
    if (!form.categoryId) e.categoryId = t('form.errors.category')
    if (!(Number(form.amount) > 0)) e.amount = t('form.errors.amount')
    if (!form.date) e.date = t('form.errors.date')
    setErrors(e)
    return !Object.keys(e).length
  }

  const save = async (another) => {
    if (!validate()) return
    setSaving(true)
    const body = {
      type: form.type, date: form.date, categoryId: form.categoryId, payee: form.payee.trim(),
      amount: Number(form.amount), status: form.status, paymentMode: form.paymentMode, paidFrom: form.paidFrom,
      description: form.description.trim() || null, paidByName: form.paidByName.trim() || null, reference: form.reference.trim() || null,
    }
    try {
      const { data } = expense ? await expensesApi.update(expense.id, body) : await expensesApi.create(body)
      toast(expense ? t('toast.updated', { payee: body.payee }) : t('toast.added', { payee: body.payee }))
      onSaved(data.expense, another)
      if (another) {
        setForm((f) => blank({ type: f.type, date: f.date, paidFrom: f.paidFrom, paidByName: f.paidByName, paymentMode: f.paymentMode }))
        setErrors({})
      }
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const income = form.type === 'income'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={expense ? t('form.editTitle') : t('form.addTitle')}
      maxWidth="640px"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        {!expense && <Button variant="ghost" onClick={() => save(true)} disabled={saving}>{t('form.saveAnother')}</Button>}
        <Button onClick={() => save(false)} disabled={saving}>{saving ? t('common:saving') : t('common:save')}</Button>
      </>}
    >
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" onSubmit={(e) => { e.preventDefault(); save(false) }} noValidate>
        <div className="sm:col-span-2">
          <Segmented label={t('form.type')} value={form.type} onChange={(v) => set('type', v)} options={[
            { value: 'expense', label: t('form.moneyOut'), activeClass: 'bg-danger-bg text-danger-text shadow-soft' },
            { value: 'income', label: t('form.moneyIn'), activeClass: 'bg-success-bg text-success-text shadow-soft' },
          ]} />
        </div>

        <Field label={income ? t('form.receivedFrom') : t('form.payee')} required value={form.payee} list="qv-expense-payees"
          autoComplete="off" placeholder={t('form.payeePlaceholder')} error={errors.payee}
          onChange={(e) => onPayee(e.target.value)} />
        <datalist id="qv-expense-payees">
          {payees.map((p) => <option key={p.payee} value={p.payee} />)}
        </datalist>

        <CategoryPicker label={t('form.category')} required groups={grouped} value={form.categoryId}
          onChange={(id) => set('categoryId', id)} error={errors.categoryId} />

        {category?.group === 'refunds' && (
          <p className="sm:col-span-2 -mt-1 flex items-start gap-2 rounded-lg bg-info-bg text-info-text px-3 py-2 text-xs">
            <LuInfo size={14} className="shrink-0 mt-px" aria-hidden />
            {t('form.refundHint')}
          </p>
        )}

        <Field label={t('form.amount')} required type="number" inputMode="decimal" min="0" step="any" value={form.amount}
          error={errors.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
        <Field label={t('form.date')} required type="date" value={form.date} max={form.status === 'paid' ? today() : undefined}
          error={errors.date} onChange={(e) => set('date', e.target.value)} />

        <Segmented label={t('form.status')} value={form.status} onChange={(v) => set('status', v)} options={[
          { value: 'paid', label: income ? t('form.received') : t('form.paid') },
          { value: 'unpaid', label: income ? t('form.notReceived') : t('form.notPaid'), activeClass: 'bg-warning-bg text-warning-text shadow-soft' },
        ]} />
        <Segmented label={income ? t('form.receivedInto') : t('form.paidFrom')} value={form.paidFrom} onChange={(v) => set('paidFrom', v)}
          options={PAID_FROM.map((p) => ({ value: p, label: t(`paidFrom.${p}`) }))} />

        <Field label={income ? t('form.receivedBy') : t('form.paidBy')} value={form.paidByName} placeholder={t('form.paidByPlaceholder')}
          onChange={(e) => set('paidByName', e.target.value)} />
        <Field label={t('form.mode')} value={form.paymentMode} onChange={(e) => set('paymentMode', e.target.value)}
          options={MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }))} />

        <Field className="sm:col-span-2" label={t('form.reference')} value={form.reference} placeholder={t('form.referencePlaceholder')}
          onChange={(e) => set('reference', e.target.value)} />
        <Field className="sm:col-span-2" label={t('form.note')} textarea value={form.description} placeholder={t('form.notePlaceholder')}
          onChange={(e) => set('description', e.target.value)} />
      </form>
    </Modal>
  )
}
