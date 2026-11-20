import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSave, LuUserPlus } from 'react-icons/lu'
import { Modal, Field, Button } from '../../ui-tw'
import { foodApi } from '../../../api/client'
import SubscriptionFields from './SubscriptionFields'
import {
  DIETS, PHONE_RE, EMAIL_RE, EMPTY_SALE, cleanPhone, todayInput, fieldErrors, planCycles, saleFor, saleErrors, salePayload,
} from './foodUtils'

const EMPTY = { name: '', phone: '', email: '', address: '', diet: '', guestId: '', notes: '' }

const fromCustomer = (c) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, c[k] == null ? EMPTY[k] : String(c[k])])),
})

function Section({ title, hint, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-[13px] font-semibold text-ink">{title}</h4>
        {hint && <span className="text-xs text-ink3">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * Add or edit a food customer: an outside person, or one of the in-house hotel
 * / PG guests (picking one fills their details). A new customer can be put on
 * a meal plan in the same step.
 */
export default function CustomerModal({ customer, plans, onClose, onSaved }) {
  const { t } = useTranslation('food')
  const editing = !!customer?.id
  const fromBooking = editing && !!customer.bookingId
  const [form, setForm] = useState(() => (editing ? fromCustomer(customer) : EMPTY))
  const [kind, setKind] = useState(editing && (customer.guestId || customer.bookingId) ? 'guest' : 'outside')
  const [guests, setGuests] = useState(null)
  const [sale, setSale] = useState(() => saleFor(plans.find((p) => p.active && planCycles(p).length), EMPTY_SALE))
  const [withPlan, setWithPlan] = useState(true)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (kind !== 'guest' || guests || fromBooking) return
    foodApi.guests().then(({ data }) => setGuests(data.guests)).catch(() => setGuests([]))
  }, [kind, guests, fromBooking])

  const pickGuest = (id) => {
    const g = guests?.find((x) => x.id === id)
    setForm((f) => ({
      ...f, guestId: id,
      ...(g && { name: g.name || f.name, phone: cleanPhone(g.phone) || f.phone, email: g.email || f.email, address: g.address || f.address }),
    }))
  }

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = t('errors.name')
    if (!PHONE_RE.test(cleanPhone(form.phone))) e.phone = t('errors.phone')
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = t('errors.email')
    if (kind === 'guest' && !fromBooking && !form.guestId) e.guestId = t('errors.guest')
    if (!editing && withPlan) Object.assign(e, saleErrors(t, plans, sale))
    setErrors(e)
    return e
  }

  const submit = async (ev) => {
    ev?.preventDefault()
    const e = validate()
    if (Object.keys(e).length) {
      document.querySelector(`[name="${Object.keys(e)[0]}"]`)?.focus()
      return
    }
    setSaving(true); setApiError('')
    const body = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
      phone: cleanPhone(form.phone),
      guestId: kind === 'guest' ? form.guestId : '',
    }
    if (!editing && withPlan && plans.some((p) => p.active)) body.subscription = salePayload(plans, sale)
    try {
      const { data } = editing ? await foodApi.updateCustomer(customer.id, body) : await foodApi.createCustomer(body)
      onSaved(data.customer, editing)
    } catch (err) {
      const fe = fieldErrors(err)
      if (Object.keys(fe).length) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace(/^subscription\./, ''), v])))
      setApiError(err.response?.data?.message || (Object.keys(fe).length ? t('errors.fix') : t('toast.failed')))
    } finally {
      setSaving(false)
    }
  }

  const freeGuests = (guests || []).filter((g) => !g.isCustomer || g.id === customer?.guestId)
  const guestLabel = (g) => `${g.name}${g.roomNumber ? ` · ${t('room', { room: g.roomNumber })}` : ''} · ${g.phone}`

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      subtitle={editing ? customer.customerNo : t('form.newSubtitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={editing ? <LuSave /> : <LuUserPlus />} onClick={submit} disabled={saving}>
          {saving ? t('common:saving', { defaultValue: '…' }) : editing ? t('form.save') : t('form.create')}
        </Button>
      </>}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}

        {fromBooking ? (
          <p className="m-0 rounded-lg bg-violet-bg text-violet-text px-3 py-2 text-sm">
            {t('form.fromBooking', { booking: customer.booking?.bookingNo || '' })}
          </p>
        ) : (
          <Section title={t('form.customerType')}>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {['outside', 'guest'].map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                  className={`text-left rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${kind === k ? 'border-gold bg-gold-bg' : 'border-line2 bg-surface hover:border-gold'}`}>
                  <span className="block text-[13px] font-semibold text-ink">{t(`form.kind.${k}`)}</span>
                  <span className="block text-xs text-ink3">{t(`form.kind.${k}Hint`)}</span>
                </button>
              ))}
            </div>
            {kind === 'guest' && (
              <Field label={t('form.guest')} name="guestId" value={form.guestId} onChange={(e) => pickGuest(e.target.value)} error={errors.guestId}
                options={[
                  { value: '', label: guests ? (freeGuests.length ? t('form.chooseGuest') : t('form.noGuests')) : t('common:loading') },
                  ...freeGuests.map((g) => ({ value: g.id, label: guestLabel(g) })),
                ]} />
            )}
          </Section>
        )}

        <Section title={t('form.details')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label={t('form.name')} name="name" required value={form.name} onChange={set('name')} error={errors.name} maxLength={80} autoFocus={!editing} />
            <Field label={t('form.phone')} name="phone" required type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={18} />
            <Field label={t('form.email')} name="email" type="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={120} />
            <Field label={t('form.diet')} value={form.diet} onChange={set('diet')}
              options={[{ value: '', label: '—' }, ...DIETS.map((d) => ({ value: d, label: t(`diets.${d}`) }))]} />
            <Field className="sm:col-span-2" label={t('form.address')} value={form.address} onChange={set('address')} maxLength={300} />
          </div>
        </Section>

        {!editing && (
          <Section title={t('form.firstPlan')} hint={
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-[var(--gold)]" checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} />
              {t('form.subscribeNow')}
            </label>
          }>
            {withPlan && <SubscriptionFields plans={plans} sale={sale} onChange={setSale} errors={errors} defaultStart={todayInput()} />}
          </Section>
        )}

        <Field label={t('form.notes')} textarea value={form.notes} onChange={set('notes')} maxLength={500} placeholder={t('form.notesPlaceholder')} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
