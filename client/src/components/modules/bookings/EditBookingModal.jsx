import { useMemo, useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import PhoneFields from './PhoneFields'
import { formatCurrency } from '../../../utils/format'
import NameFields from './NameFields'
import { joinPhones, phoneErrors, splitPhones, joinNames, nameErrors, splitNames } from '../../../utils/booking'

const DAY_MS = 86400000

const SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'ota', label: 'OTA (Booking.com / MMT)' },
  { value: 'referral', label: 'Referral' },
  { value: 'corporate', label: 'Corporate' },
]

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
      <header className="px-4 py-2.5 border-b border-line bg-surface2">
        <h4 className="text-[12.5px] font-semibold text-ink">{title}</h4>
      </header>
      <div className="p-4 bg-surface grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3.5">{children}</div>
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
  const [values, setValues] = useState(() => (booking ? from(booking) : null))
  const [errors, setErrors] = useState({})

  const isMonthly = booking?.stayType === 'monthly'
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
      e.guestEmail = 'Enter a valid email address'
    if (!values.fromDate) e.fromDate = 'Check-in date is required'
    if (isMonthly) {
      if (!values.months || Number(values.months) < 1) e.months = 'At least 1 month'
    } else if (!values.toDate || nights(values.fromDate, values.toDate) < 1) {
      e.toDate = 'Must be after check-in'
    }
    if (!values.roomRate || Number(values.roomRate) <= 0) e.roomRate = 'Enter the room rate'
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
      ...(isMonthly
        ? { months: Number(values.months) }
        : { toDate: new Date(values.toDate).toISOString() }),
      roomRate: Number(values.roomRate) || 0,
      discount: Number(values.discount) || 0,
      taxRate: Number(values.taxRate) || 0,
      extraCharges: Number(values.extraCharges) || 0,
      advance: Number(values.advance) || 0,
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
      title={`Edit booking ${booking.bookingNo}`}
      subtitle={`Room ${booking.roomNumber}${booking.roomType ? ` · ${booking.roomType}` : ''} · the room can't be changed here`}
      footer={
        <>
          <Button variant="ghost" disabled={submitting} onClick={onClose}>Cancel</Button>
          <Button disabled={submitting} onClick={handleSave}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Section title="Guest details">
          <NameFields className="col-span-2" names={values.guestNames} errors={errors}
                      onChange={(guestNames) => setValues((v) => ({ ...v, guestNames }))} />
          <PhoneFields className="col-span-2" phones={values.guestPhones} errors={errors} required
                       onChange={(guestPhones) => setValues((v) => ({ ...v, guestPhones }))} />
          <Field className="col-span-2" label="Email" name="guestEmail" type="email" value={values.guestEmail}
                 onChange={set('guestEmail')} error={errors.guestEmail} placeholder="guest@example.com" />
          <Field className="col-span-2" label="Address" value={values.guestAddress}
                 onChange={set('guestAddress')} placeholder="City, State" />
          <Field label="Nationality" value={values.nationality} onChange={set('nationality')} />
          <Field label="Adults" type="number" min="1" value={values.adults} onChange={set('adults')} />
          <Field label="Children" type="number" min="0" value={values.children} onChange={set('children')} />
          <Field label="Source" options={SOURCES} value={values.source} onChange={set('source')} />
          <Field className="col-span-2" label="ID type" value={values.idType} onChange={set('idType')}
                 placeholder="Aadhaar, PAN" hint="Separate multiple IDs with a comma" />
          <Field className="col-span-2" label="ID number" value={values.idNumber} onChange={set('idNumber')} />
        </Section>

        <Section title={`Stay & charges${isMonthly ? ' (monthly)' : ''}`}>
          <Field className="col-span-2" label="Check-in" name="fromDate" type="date" value={values.fromDate}
                 onChange={set('fromDate')} error={errors.fromDate} />
          {isMonthly ? (
            <Field className="col-span-2" label="Months" name="months" type="number" min="1" value={values.months}
                   onChange={set('months')} error={errors.months} />
          ) : (
            <Field className="col-span-2" label="Check-out" name="toDate" type="date" min={values.fromDate}
                   value={values.toDate} onChange={set('toDate')} error={errors.toDate} />
          )}
          <Field label={`Rate / ${isMonthly ? 'month' : 'night'}`} name="roomRate" type="number" min="0"
                 value={values.roomRate} onChange={set('roomRate')} error={errors.roomRate} />
          <Field label="Discount" type="number" min="0" value={values.discount} onChange={set('discount')} />
          <Field label="GST %" type="number" min="0" max="30" value={values.taxRate} onChange={set('taxRate')} />
          <Field label="Extra charges" type="number" min="0" value={values.extraCharges}
                 onChange={set('extraCharges')} />
          <Field className="col-span-2" label="Advance paid" type="number" min="0" value={values.advance}
                 onChange={set('advance')} hint="Total collected so far" />
          <Field className="col-span-2 sm:col-span-4" label="Notes" textarea value={values.notes}
                 onChange={set('notes')} placeholder="Internal notes" />
        </Section>

        {/* Live preview of what the server will recompute. */}
        <div className="rounded-xl border border-gold-border bg-gold-bg px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between text-ink2">
            <span>New stay</span>
            <span className="tabular-nums">{preview.units} {isMonthly ? 'month(s)' : 'night(s)'}</span>
          </div>
          <div className="flex items-baseline justify-between text-ink2 mt-1">
            <span>Balance due</span>
            <span className="tabular-nums">{formatCurrency(Math.max(0, preview.balance))}</span>
          </div>
          <div className="flex items-baseline justify-between font-medium text-gold mt-2 pt-2 border-t border-gold-border">
            <span>New total</span>
            <span className="tabular-nums">
              {formatCurrency(preview.total)}
              {delta !== 0 && (
                <span className="ml-2 text-[11.5px] font-normal">
                  ({delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))})
                </span>
              )}
            </span>
          </div>
        </div>

        <p className="text-[11.5px] text-ink3">
          Changing the dates re-checks the room's availability — if it clashes with another booking the
          edit is rejected and nothing changes.
        </p>
      </div>
    </Modal>
  )
}
