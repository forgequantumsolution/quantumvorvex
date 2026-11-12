import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuLogIn, LuCalendarClock, LuSave, LuTriangleAlert, LuHistory } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { visitorsApi } from '../../../api/client'
import { PURPOSES, ID_TYPES, PHONE_RE, EMAIL_RE, cleanPhone } from './visitorUtils'

const EMPTY = {
  phone: '', name: '', email: '', company: '', purpose: 'guest_visit', hostName: '', roomNumber: '',
  idType: '', idNumber: '', vehicleNo: '', companions: '0', notes: '', when: 'now', expectedAt: '',
}

// <input type="datetime-local"> value for a date (local time).
const localInput = (d) => {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}

const fromVisitor = (v) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, v[k] == null ? EMPTY[k] : String(v[k])])),
  when: v.status === 'expected' ? 'later' : 'now',
  expectedAt: v.expectedAt ? localInput(v.expectedAt) : '',
})

/**
 * Desk entry for a walk-in (checked in now) or an expected visitor, and edits.
 * Typing a known mobile number fills the empty fields from that visitor's last
 * visit and warns when the number is blocked.
 * `visitor` set → edit (the ID number field is left blank unless changed: the
 * list only carries it masked).
 */
export default function VisitorModal({ visitor, onClose, onSaved }) {
  const { t } = useTranslation('visitors')
  const editing = !!visitor?.id
  const [form, setForm] = useState(() => (editing ? { ...fromVisitor(visitor), idNumber: '' } : EMPTY))
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lookup, setLookup] = useState(null) // { visits, blocked }
  const looked = useRef(editing ? cleanPhone(visitor.phone) : '')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Look the number up once it is complete.
  const phone = cleanPhone(form.phone)
  useEffect(() => {
    if (!PHONE_RE.test(phone) || phone.length < 10 || looked.current === phone) return
    let off = false
    const id = setTimeout(() => {
      looked.current = phone
      visitorsApi.lookup(phone).then(({ data }) => {
        if (off) return
        setLookup({ visits: data.visits, blocked: data.blocked })
        if (data.visitor) {
          setForm((f) => {
            const next = { ...f }
            for (const k of ['name', 'email', 'company', 'idType', 'idNumber', 'vehicleNo']) {
              if (!f[k] && data.visitor[k]) next[k] = data.visitor[k]
            }
            return next
          })
        }
      }).catch(() => {})
    }, 350)
    return () => { off = true; clearTimeout(id) }
  }, [phone])

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = t('form.errors.name')
    if (!PHONE_RE.test(phone)) e.phone = t('form.errors.phone')
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = t('form.errors.email')
    if (form.when === 'later' && !form.expectedAt) e.expectedAt = t('form.errors.expectedAt')
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev?.preventDefault()
    if (!validate()) return
    setSaving(true); setApiError('')
    const body = {
      name: form.name.trim(), phone, email: form.email.trim(), company: form.company.trim(),
      purpose: form.purpose, hostName: form.hostName.trim(), roomNumber: form.roomNumber.trim(),
      idType: form.idType, vehicleNo: form.vehicleNo.trim().toUpperCase(),
      companions: Math.max(0, Math.min(20, parseInt(form.companions, 10) || 0)), notes: form.notes.trim(),
    }
    // Editing: keep the stored ID number unless a new one was typed.
    if (!editing || form.idNumber.trim()) body.idNumber = form.idNumber.trim()
    if (!editing && !form.idType) delete body.idNumber
    if (form.when === 'later') body.expectedAt = new Date(form.expectedAt).toISOString()
    else if (!editing) body.checkIn = true
    try {
      const { data } = editing ? await visitorsApi.update(visitor.id, body) : await visitorsApi.create(body)
      onSaved(data.visitor, editing)
    } catch (err) {
      const d = err.response?.data
      if (d?.details?.length) {
        setErrors(Object.fromEntries(d.details.map((x) => [x.field, x.message])))
      } else setApiError(d?.message || t('toast.failed'))
    } finally {
      setSaving(false)
    }
  }

  const showWhen = !editing || visitor.status === 'expected'
  const primaryLabel = editing ? t('form.save') : form.when === 'later' ? t('form.saveExpected') : t('form.saveCheckIn')
  const primaryIcon = editing ? <LuSave /> : form.when === 'later' ? <LuCalendarClock /> : <LuLogIn />

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('form.editTitle') : t('form.newTitle')}
      maxWidth="640px"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common:cancel')}</Button>
        <Button icon={primaryIcon} onClick={submit} disabled={saving}>{saving ? t('common:saving', { defaultValue: '…' }) : primaryLabel}</Button>
      </>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {apiError && <div role="alert" className="rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{apiError}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label={t('form.phone')} required type="tel" inputMode="tel" autoComplete="off" autoFocus={!editing}
            value={form.phone} onChange={set('phone')} error={errors.phone}
            hint={!lookup ? t('form.phoneHint') : undefined} maxLength={18} />
          <Field label={t('form.name')} required value={form.name} onChange={set('name')} error={errors.name} maxLength={80} />
        </div>

        {lookup?.blocked && (
          <div role="alert" className="flex gap-2 rounded-lg px-3 py-2.5 text-sm bg-danger-bg text-danger-text">
            <LuTriangleAlert className="shrink-0 mt-0.5" aria-hidden />
            <span>{t('form.blockedWarning', { reason: lookup.blocked.reason ? ` (${lookup.blocked.reason})` : '' })}</span>
          </div>
        )}
        {lookup?.visits > 0 && !editing && (
          <div className="flex items-center gap-2 text-xs text-info-text">
            <LuHistory aria-hidden /> {t('form.returning', { count: lookup.visits })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label={t('form.purpose')} value={form.purpose} onChange={set('purpose')}
            options={PURPOSES.map((p) => ({ value: p, label: t(`purposes.${p}`) }))} />
          <Field label={t('form.company')} value={form.company} onChange={set('company')} maxLength={80} />
          <Field label={t('form.hostName')} placeholder={t('form.hostPlaceholder')} value={form.hostName} onChange={set('hostName')} maxLength={80} />
          <div className="grid grid-cols-2 gap-3.5">
            <Field label={t('form.roomNumber')} value={form.roomNumber} onChange={set('roomNumber')} maxLength={10} />
            <Field label={t('form.companions')} type="number" min={0} max={20} inputMode="numeric" value={form.companions} onChange={set('companions')} />
          </div>
          <Field label={t('form.idType')} value={form.idType} onChange={set('idType')}
            options={[{ value: '', label: t('form.none') }, ...ID_TYPES.map((p) => ({ value: p, label: t(`idTypes.${p}`) }))]} />
          <Field label={t('form.idNumber')} value={form.idNumber} onChange={set('idNumber')} maxLength={30} disabled={!form.idType}
            placeholder={editing && visitor.idNumber ? visitor.idNumber : undefined} autoComplete="off" />
          <Field label={t('form.vehicleNo')} value={form.vehicleNo} onChange={set('vehicleNo')} maxLength={20} />
          <Field label={t('form.email')} type="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={120} />
        </div>

        <Field label={t('form.notes')} textarea value={form.notes} onChange={set('notes')} maxLength={500} />

        {showWhen && (
          <fieldset className="m-0 p-0 border-0">
            <legend className="block text-xs font-medium text-ink2 mb-1.5">{t('form.when')}</legend>
            <div className="flex flex-wrap items-start gap-3">
              <div role="radiogroup" className="inline-flex rounded-lg border border-line2 overflow-hidden">
                {(editing ? ['later'] : ['now', 'later']).map((w) => (
                  <button key={w} type="button" role="radio" aria-checked={form.when === w}
                    onClick={() => setForm((f) => ({ ...f, when: w, expectedAt: w === 'later' && !f.expectedAt ? localInput(Date.now() + 3600e3) : f.expectedAt }))}
                    className={`px-3.5 py-2 text-sm font-semibold border-0 cursor-pointer min-h-11 sm:min-h-0 ${form.when === w ? 'bg-gold text-black' : 'bg-surface text-ink2 hover:text-gold'}`}>
                    {t(`form.${w}`)}
                  </button>
                ))}
              </div>
              {form.when === 'later' && (
                <Field className="flex-1 min-w-[200px]" type="datetime-local" aria-label={t('form.expectedAt')}
                  value={form.expectedAt} onChange={set('expectedAt')} error={errors.expectedAt} />
              )}
            </div>
          </fieldset>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
