import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, Button } from '../../ui-tw'
import PhoneFields from './PhoneFields'
import { formatCurrency } from '../../../utils/format'
import NameFields from './NameFields'
import { joinPhones, phoneErrors, splitPhones, joinNames, nameErrors, splitNames } from '../../../utils/booking'

const DAY_MS = 86400000

// Values go to the server; labels come from bookings:sources.<value>.
const SOURCE_VALUES = ['walk_in', 'phone', 'website', 'ota', 'referral', 'corporate']

// Local YYYY-MM-DD (avoids the UTC off-by-one of toISOString).
const ymd = (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x)) return ''
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

const nights = (from, to) => {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
}

// A titled panel, matching the grouping used in the create form.
function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-line overflow-hidden">
      <header className="px-3.5 sm:px-4 py-2.5 border-b border-line bg-surface2">
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
      </header>
      <div className="p-3.5 sm:p-4 bg-surface grid grid-cols-2 sm:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-3.5">{children}</div>
    </section>
  )
}

const from = (b) => ({
  guestNames: splitNames(b.guestName).length ? splitNames(b.guestName) : [''],
  guestPhones: splitPhones(b.guestPhone).length ? splitPhones(b.guestPhone) : [''],
  guestEmail: b.guestEmail || '',
  guestAddress: b.guestAddress || '',
  nationality: b.nationality || '',
  idType: b.idType || '',
  idNumber: b.idNumber || '',
  adults: b.adults ?? 1,
  children: b.children ?? 0,
  fromDate: ymd(b.fromDate),
  toDate: ymd(b.toDate),
  months: b.months ?? 1,
  roomRate: b.roomRate ?? 0,
  discount: b.discount ?? 0,
  taxRate: b.taxRate ?? 0,
  extraCharges: b.extraCharges ?? 0,
  advance: b.advance ?? 0,
  securityDeposit: b.securityDeposit ?? 0,
  source: b.source || 'walk_in',
  specialRequests: b.specialRequests || '',
  notes: b.notes || '',
})

/**
 * Fix a booking that was entered wrong: guest details, dates and the money.
 *
 * The room itself can't be swapped here (the server's general edit keeps the
 * booking on its room) and the server refuses edits once a booking is checked
 * out or cancelled — the list only offers this on live bookings.
 *
 * onSave receives the PUT /bookings/:id payload; the server re-checks room
 * availability for changed dates and recomputes the totals, so the figures shown
 * here are a preview of its formula, not the source of truth.
 */
export default function EditBookingModal({ isOpen, booking, submitting = false, onClose, onSave }) {
  const { t } = useTranslation('bookings')
  const [values, setValues] = useState(() => (booking ? from(booking) : null))
  const [errors, setErrors] = useState({})

  const isMonthly = booking?.stayType === 'monthly'
  // PG tenancy: no end date or stay total — rent is invoiced monthly, so only the
  // rate for coming months, the GST, the advance and the deposit are editable.
  const tenancy = isMonthly && !booking?.months
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  // Mirrors the server's computePricing: the rate is GST-inclusive, so tax is
  // extracted from (subtotal − discount) rather than added on top.
  const preview = useMemo(() => {
    if (!values) return null
    const rate = Number(values.roomRate) || 0
    const units = isMonthly ? Number(values.months) || 0 : nights(values.fromDate, values.toDate)
    const gross = Math.max(0, rate * units - (Number(values.discount) || 0))
    const total = gross + (Number(values.extraCharges) || 0)
    return { units, total, balance: total - (Number(values.advance) || 0) }
  }, [values, isMonthly])

  if (!isOpen || !booking || !values) return null

  const validate = () => {
    const e = { ...phoneErrors(values.guestPhones), ...nameErrors(values.guestNames) }
    if (values.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.guestEmail.trim()))
      e.guestEmail = t('form.err.email')
    if (!values.fromDate) e.fromDate = t('form.err.checkInRequired')
    if (tenancy) {
      // open-ended
    } else if (isMonthly) {
      if (!values.months || Number(values.months) < 1) e.months = t('form.err.oneMonth')
    } else if (!values.toDate || nights(values.fromDate, values.toDate) < 1) {
      e.toDate = t('form.err.afterCheckIn')
    }
    if (!values.roomRate || Number(values.roomRate) <= 0) e.roomRate = t('form.err.rate')
    setErrors(e)
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length) return
    onSave({
      guestName: joinNames(values.guestNames),
      guestPhone: joinPhones(values.guestPhones) || null,
      guestEmail: values.guestEmail.trim() || null,
      guestAddress: values.guestAddress.trim() || null,
      nationality: values.nationality.trim() || null,
      idType: values.idType.trim() || null,
      idNumber: values.idNumber.trim() || null,
      adults: Number(values.adults) || 1,
      children: Number(values.children) || 0,
      fromDate: new Date(values.fromDate).toISOString(),
      ...(tenancy ? {} : isMonthly
        ? { months: Number(values.months) }
        : { toDate: new Date(values.toDate).toISOString() }),
      roomRate: Number(values.roomRate) || 0,
      taxRate: Number(values.taxRate) || 0,
      advance: Number(values.advance) || 0,
      ...(tenancy
        ? { securityDeposit: Number(values.securityDeposit) || 0 }
        : { discount: Number(values.discount) || 0, extraCharges: Number(values.extraCharges) || 0 }),
      source: values.source,
      specialRequests: values.specialRequests.trim() || null,
      notes: values.notes.trim() || null,
    })
  }

  const delta = preview.total - (Number(booking.amount) || 0)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={t('edit.title', { no: booking.bookingNo })}
      subtitle={`${t('roomN', { room: booking.roomNumber })}${booking.roomType ? ` · ${booking.roomType}` : ''} · ${t('edit.roomFixed')}`}
      footer={
        <>
          <Button variant="ghost" disabled={submitting} onClick={onClose}>{t('common:cancel')}</Button>
          <Button disabled={submitting} onClick={handleSave}>
            {submitting ? t('common:saving') : t('common:saveChanges')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Section title={t('form.guestDetails')}>
          <NameFields className="col-span-2" names={values.guestNames} errors={errors}
                      onChange={(guestNames) => setValues((v) => ({ ...v, guestNames }))} />
          <PhoneFields className="col-span-2" phones={values.guestPhones} errors={errors} required
                       onChange={(guestPhones) => setValues((v) => ({ ...v, guestPhones }))} />
          <Field className="col-span-2" label={t('common:email')} name="guestEmail" type="email" value={values.guestEmail}
                 onChange={set('guestEmail')} error={errors.guestEmail} placeholder="guest@example.com" />
          <Field className="col-span-2" label={t('form.address')} value={values.guestAddress}
                 onChange={set('guestAddress')} placeholder={t('form.addressPlaceholder')} />
          <Field label={t('form.nationality')} value={values.nationality} onChange={set('nationality')} />
          <Field label={t('form.adults')} type="number" min="1" value={values.adults} onChange={set('adults')} />
          <Field label={t('form.children')} type="number" min="0" value={values.children} onChange={set('children')} />
          <Field label={t('edit.source')} options={SOURCE_VALUES.map((value) => ({ value, label: t(`sources.${value}`) }))}
                 value={values.source} onChange={set('source')} />
          <Field className="col-span-2" label={t('pg.idType')} value={values.idType} onChange={set('idType')}
                 placeholder="Aadhaar, PAN" hint={t('edit.idTypeHint')} />
          <Field className="col-span-2" label={t('form.idNumber')} value={values.idNumber} onChange={set('idNumber')} />
        </Section>

        {tenancy ? (
        <Section title={t('edit.tenancy')}>
          <Field className="col-span-2" label={t('form.moveIn')} name="fromDate" type="date" value={values.fromDate}
                 onChange={set('fromDate')} error={errors.fromDate} disabled={booking.status === 'CheckedIn'} />
          <Field className="col-span-2" label={t('edit.rentPerMonth')} name="roomRate" type="number" min="0"
                 value={values.roomRate} onChange={set('roomRate')} error={errors.roomRate}
                 hint={t('edit.rentHint')} />
          <Field label={t('edit.gstPct')} type="number" min="0" max="30" value={values.taxRate} onChange={set('taxRate')} />
          <Field label={t('edit.advanceReceived')} type="number" min="0" value={values.advance}
                 onChange={set('advance')} />
          <Field className="col-span-2" label={t('edit.deposit')} type="number" min="0" value={values.securityDeposit}
                 onChange={set('securityDeposit')} hint={t('edit.depositHint')} />
          <Field className="col-span-2 sm:col-span-4" label={t('form.notes')} textarea value={values.notes}
                 onChange={set('notes')} placeholder={t('form.internalNotes')} />
        </Section>
        ) : (
        <Section title={isMonthly ? t('edit.stayChargesMonthly') : t('edit.stayCharges')}>
          <Field className="col-span-2" label={t('form.checkIn')} name="fromDate" type="date" value={values.fromDate}
                 onChange={set('fromDate')} error={errors.fromDate} />
          {isMonthly ? (
            <Field className="col-span-2" label={t('form.monthsLabel')} name="months" type="number" min="1" value={values.months}
                   onChange={set('months')} error={errors.months} />
          ) : (
            <Field className="col-span-2" label={t('form.checkOut')} name="toDate" type="date" min={values.fromDate}
                   value={values.toDate} onChange={set('toDate')} error={errors.toDate} />
          )}
          <Field label={isMonthly ? t('edit.ratePerMonth') : t('edit.ratePerNight')} name="roomRate" type="number" min="0"
                 value={values.roomRate} onChange={set('roomRate')} error={errors.roomRate} />
          <Field label={t('form.discount')} type="number" min="0" value={values.discount} onChange={set('discount')} />
          <Field label={t('edit.gstPct')} type="number" min="0" max="30" value={values.taxRate} onChange={set('taxRate')} />
          <Field label={t('form.extra')} type="number" min="0" value={values.extraCharges}
                 onChange={set('extraCharges')} />
          <Field className="col-span-2" label={t('edit.advancePaid')} type="number" min="0" value={values.advance}
                 onChange={set('advance')} hint={t('edit.advanceHint')} />
          <Field className="col-span-2 sm:col-span-4" label={t('form.notes')} textarea value={values.notes}
                 onChange={set('notes')} placeholder={t('form.internalNotes')} />
        </Section>
        )}

        {tenancy ? (
        <div className="rounded-xl border border-gold-border bg-gold-bg px-4 py-3 text-sm space-y-1">
          <div className="flex items-baseline justify-between text-ink2">
            <span>{t('edit.rentBilled')}</span><span className="tabular-nums">{formatCurrency(booking.amount)}</span>
          </div>
          <div className="flex items-baseline justify-between text-ink2">
            <span>{t('edit.received')}</span><span className="tabular-nums">{formatCurrency(Number(values.advance) || 0)}</span>
          </div>
          <div className="flex items-baseline justify-between font-medium text-gold pt-2 mt-1 border-t border-gold-border">
            <span>{t('edit.rentDue')}</span>
            <span className="tabular-nums">{formatCurrency(Math.max(0, booking.amount - (Number(values.advance) || 0)))}</span>
          </div>
        </div>
        ) : (
        /* Live preview of what the server will recompute. */
        <div className="rounded-xl border border-gold-border bg-gold-bg px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between text-ink2">
            <span>{t('edit.newStay')}</span>
            <span className="tabular-nums">{t(isMonthly ? 'form.months' : 'form.nights', { count: preview.units })}</span>
          </div>
          <div className="flex items-baseline justify-between text-ink2 mt-1">
            <span>{t('form.balanceDue')}</span>
            <span className="tabular-nums">{formatCurrency(Math.max(0, preview.balance))}</span>
          </div>
          <div className="flex items-baseline justify-between font-medium text-gold mt-2 pt-2 border-t border-gold-border">
            <span>{t('edit.newTotal')}</span>
            <span className="tabular-nums">
              {formatCurrency(preview.total)}
              {delta !== 0 && (
                <span className="ml-2 text-xs font-normal">
                  ({delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))})
                </span>
              )}
            </span>
          </div>
        </div>
        )}

        <p className="text-xs text-ink3">
          {t('edit.footnote')}
        </p>
      </div>
    </Modal>
  )
}
