import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSave, LuUserPlus } from 'react-icons/lu'
import { Modal, Field, Button } from '../../ui-tw'
import { gymApi } from '../../../api/client'
import PlanSaleFields from './PlanSaleFields'
import { EMPTY_SALE, saleErrors, salePayload } from './gymSale'
import {
  GENDERS, GOALS, SOURCES, ID_TYPES, PHONE_RE, EMAIL_RE, cleanPhone, dateInput, todayInput, fieldErrors,
} from './gymUtils'

const EMPTY = {
  name: '', phone: '', email: '', gender: '', dob: '', goal: '', source: 'walk_in', guestId: '',
  address: '', idType: 'aadhaar', idNumber: '', emergencyName: '', emergencyPhone: '', healthNotes: '', notes: '',
  joinedAt: '',
}

const fromMember = (m) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, m[k] == null ? (k === 'idType' ? '' : EMPTY[k]) : String(m[k])])),
  dob: dateInput(m.dob),
  joinedAt: dateInput(m.joinedAt),
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
 * Add or edit a member. A new member is an outside customer or one of the
 * in-house hotel / PG guests (picking one fills their details), and can buy
 * their first plan in the same step.
 */
export default function MemberModal({ member, plans, onClose, onSaved }) {
  const { t } = useTranslation('gym')
  const editing = !!member?.id
  const [form, setForm] = useState(() => (editing ? fromMember(member) : { ...EMPTY, joinedAt: todayInput() }))
  const [kind, setKind] = useState(editing && member.guestId ? 'guest' : 'outside')
  const [guests, setGuests] = useState(null)
  const [sale, setSale] = useState(() => ({ ...EMPTY_SALE, planId: plans.find((p) => p.active)?.id || '' }))
  const [withPlan, setWithPlan] = useState(true)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (kind !== 'guest' || guests) return
    gymApi.guests().then(({ data }) => setGuests(data.guests)).catch(() => setGuests([]))
  }, [kind, guests])

  const pickGuest = (id) => {
    const g = guests?.find((x) => x.id === id)
    setForm((f) => ({
      ...f, guestId: id,
      ...(g && {
        name: g.name || f.name, phone: cleanPhone(g.phone) || f.phone, email: g.email || f.email,
        gender: GENDERS.includes(String(g.gender).toLowerCase()) ? String(g.gender).toLowerCase() : f.gender,
        address: g.address || f.address,
      }),
    }))
  }

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = t('errors.name')
    if (!PHONE_RE.test(cleanPhone(form.phone))) e.phone = t('errors.phone')
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = t('errors.email')
    if (form.idType === 'aadhaar' && form.idNumber.trim() && !/^\d{12}$/.test(form.idNumber.replace(/\s/g, ''))) e.idNumber = t('errors.aadhaar')
    if (kind === 'guest' && !form.guestId) e.guestId = t('errors.guest')
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
      idNumber: form.idType === 'aadhaar' ? form.idNumber.replace(/\s/g, '') : form.idNumber.trim(),
      guestId: kind === 'guest' ? form.guestId : '',
      source: kind === 'guest' ? 'guest' : form.source,
    }
    if (!editing && withPlan && plans.some((p) => p.active)) body.membership = salePayload(plans, sale)
    try {
      const { data } = editing ? await gymApi.updateMember(member.id, body) : await gymApi.createMember(body)
      onSaved(data.member, editing)
    } catch (err) {
      const fe = fieldErrors(err)
      if (Object.keys(fe).length) setErrors(fe)
      setApiError(err.response?.data?.message || (Object.keys(fe).length ? t('errors.fix') : t('toast.failed')))
    } finally {
      setSaving(false)
    }
  }

  const freeGuests = (guests || []).filter((g) => !g.isMember || g.id === member?.guestId)

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      subtitle={editing ? member.memberNo : t('form.newSubtitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={editing ? <LuSave /> : <LuUserPlus />} onClick={submit} disabled={saving}>
          {saving ? t('common:saving', { defaultValue: '…' }) : editing ? t('form.save') : t('form.create')}
        </Button>
      </>}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}

        <Section title={t('form.memberType')}>
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
                ...freeGuests.map((g) => ({ value: g.id, label: `${g.name}${g.roomNumber ? ` · ${t('room', { room: g.roomNumber })}` : ''} · ${g.phone}` })),
              ]} />
          )}
        </Section>

        <Section title={t('form.personal')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label={t('form.name')} name="name" required value={form.name} onChange={set('name')} error={errors.name} maxLength={80} autoFocus={!editing} />
            <Field label={t('form.phone')} name="phone" required type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={18} />
            <Field label={t('form.email')} name="email" type="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={120} />
            <div className="grid grid-cols-2 gap-3.5">
              <Field label={t('form.gender')} value={form.gender} onChange={set('gender')}
                options={[{ value: '', label: '—' }, ...GENDERS.map((g) => ({ value: g, label: t(`genders.${g}`) }))]} />
              <Field label={t('form.dob')} type="date" value={form.dob} onChange={set('dob')} />
            </div>
            <Field label={t('form.goal')} value={form.goal} onChange={set('goal')}
              options={[{ value: '', label: '—' }, ...GOALS.map((g) => ({ value: g, label: t(`goals.${g}`) }))]} />
            {kind === 'outside' && (
              <Field label={t('form.source')} value={form.source} onChange={set('source')}
                options={SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))} />
            )}
            <Field label={t('form.joinedAt')} type="date" value={form.joinedAt} onChange={set('joinedAt')} />
            <Field className={kind === 'outside' ? '' : 'sm:col-span-2'} label={t('form.address')} value={form.address} onChange={set('address')} maxLength={300} />
          </div>
        </Section>

        <Section title={t('form.idAndSafety')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label={t('form.idType')} value={form.idType} onChange={set('idType')}
              options={[{ value: '', label: '—' }, ...ID_TYPES.map((x) => ({ value: x, label: t(`idTypes.${x}`) }))]} />
            <Field label={form.idType === 'aadhaar' ? t('form.aadhaar') : t('form.idNumber')} name="idNumber" value={form.idNumber}
              inputMode={form.idType === 'aadhaar' ? 'numeric' : undefined} maxLength={form.idType === 'aadhaar' ? 14 : 30}
              onChange={set('idNumber')} error={errors.idNumber} disabled={!form.idType} autoComplete="off" />
            <Field label={t('form.emergencyName')} value={form.emergencyName} onChange={set('emergencyName')} maxLength={80} />
            <Field label={t('form.emergencyPhone')} type="tel" inputMode="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} maxLength={20} />
            <Field className="sm:col-span-2" label={t('form.healthNotes')} textarea value={form.healthNotes} onChange={set('healthNotes')}
              maxLength={500} placeholder={t('form.healthPlaceholder')} />
          </div>
        </Section>

        {!editing && (
          <Section title={t('form.firstPlan')} hint={
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-[var(--gold)]" checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} />
              {t('form.sellNow')}
            </label>
          }>
            {withPlan && <PlanSaleFields plans={plans} sale={sale} onChange={setSale} errors={errors} defaultStart={todayInput()} />}
          </Section>
        )}

        <Field label={t('form.notes')} textarea value={form.notes} onChange={set('notes')} maxLength={500} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
