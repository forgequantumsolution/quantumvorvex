import { useMemo, useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import { AVAILABLE_ROOMS } from '../../../data/opsSeed'
import { generateBookingNo } from '../../../utils/format'
import { TODAY } from '../../../utils/booking'

const EMPTY = {
  guestName: '', phone: '', email: '',
  room: AVAILABLE_ROOMS[0].number, stayType: 'daily',
  fromDate: TODAY, toDate: '', months: 1, guests: 1, advance: '', notes: '',
}

function nightsBetween(from, to) {
  if (!from || !to) return 0
  const ms = new Date(to) - new Date(from)
  return Math.max(0, Math.round(ms / 86400000))
}

/** Create-booking form. Calls onSave(newBooking) with a fully-shaped record. */
export default function NewBookingModal({ isOpen, onClose, onSave }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const room = useMemo(
    () => AVAILABLE_ROOMS.find((r) => r.number === values.room) || AVAILABLE_ROOMS[0],
    [values.room],
  )

  // Live amount preview
  const nights = values.stayType === 'daily' ? nightsBetween(values.fromDate, values.toDate) : 0
  const monthlyRate = room.rate * 22 // demo: derive a monthly figure from nightly rate
  const amount =
    values.stayType === 'daily' ? nights * room.rate : Number(values.months || 0) * monthlyRate

  const validate = () => {
    const e = {}
    if (!values.guestName.trim()) e.guestName = 'Guest name is required'
    if (!values.phone.trim()) e.phone = 'Phone is required'
    if (values.stayType === 'daily') {
      if (!values.toDate) e.toDate = 'Check-out date is required'
      else if (nights < 1) e.toDate = 'Must be after check-in'
    } else if (!values.months || Number(values.months) < 1) {
      e.months = 'At least 1 month'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      id: `bk-${Date.now()}`,
      bookingNo: generateBookingNo(),
      guestName: values.guestName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      room: values.room,
      roomType: room.type,
      stayType: values.stayType,
      fromDate: values.fromDate,
      toDate: values.stayType === 'daily' ? values.toDate : null,
      months: values.stayType === 'monthly' ? Number(values.months) : null,
      nights: values.stayType === 'daily' ? nights : null,
      rate: values.stayType === 'daily' ? room.rate : monthlyRate,
      guests: Number(values.guests) || 1,
      amount,
      advance: Number(values.advance) || 0,
      status: 'Confirmed',
      notes: values.notes.trim(),
      createdAt: TODAY,
      checkedInAt: null, checkedOutAt: null, cancelledAt: null, cancelReason: null,
    })
    setValues(EMPTY)
    setErrors({})
  }

  const close = () => {
    setValues(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="New Booking"
      subtitle="Reserve a room for a guest"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={handleSubmit} icon="＋">Create Booking</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Guest name" value={values.guestName} onChange={set('guestName')}
               placeholder="Full name" error={errors.guestName} required />
        <Field label="Phone" value={values.phone} onChange={set('phone')}
               placeholder="+91 …" error={errors.phone} required />
        <Field label="Email" value={values.email} onChange={set('email')}
               placeholder="guest@example.com" className="sm:col-span-2" />

        <Field label="Room" value={values.room} onChange={set('room')}
               options={AVAILABLE_ROOMS.map((r) => ({ value: r.number, label: `${r.number} · ${r.type} (₹${r.rate}/night)` }))} />
        <Field label="Stay type" value={values.stayType} onChange={set('stayType')}
               options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]} />

        <Field label="Check-in" type="date" value={values.fromDate} onChange={set('fromDate')} />
        {values.stayType === 'daily' ? (
          <Field label="Check-out" type="date" value={values.toDate} onChange={set('toDate')} error={errors.toDate} required />
        ) : (
          <Field label="Months" type="number" min="1" value={values.months} onChange={set('months')} error={errors.months} required />
        )}

        <Field label="Guests" type="number" min="1" value={values.guests} onChange={set('guests')} />
        <Field label="Advance paid (₹)" type="number" min="0" value={values.advance} onChange={set('advance')} placeholder="0" />

        <Field label="Notes" textarea value={values.notes} onChange={set('notes')}
               placeholder="Special requests…" className="sm:col-span-2" />
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg bg-gold-bg border border-gold-border px-4 py-3">
        <span className="text-sm text-ink2">
          Estimated total
          {values.stayType === 'daily' && nights > 0 && ` · ${nights} night${nights !== 1 ? 's' : ''} × ₹${room.rate}`}
        </span>
        <span className="font-syne font-bold text-lg text-gold">
          ₹{amount.toLocaleString('en-IN')}
        </span>
      </div>
    </Modal>
  )
}
