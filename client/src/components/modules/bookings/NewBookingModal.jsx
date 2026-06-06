import { useEffect, useMemo, useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import { bookingsApi, roomsApi, settingsApi } from '../../../api/client'
import { TODAY } from '../../../utils/booking'

const DAY_MS = 86400000

const EMPTY = {
  guestName: '', guestPhone: '', guestEmail: '',
  idType: 'Aadhaar', idNumber: '', nationality: 'Indian', guestAddress: '',
  adults: 1, children: 0,
  roomId: '', stayType: 'daily',
  fromDate: TODAY, toDate: '', months: 1,
  roomRate: '', discount: 0, taxRate: 12, extraCharges: 0, advance: 0,
  source: 'walk_in', specialRequests: '', notes: '',
}

const SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'ota', label: 'OTA (Booking.com / MMT)' },
  { value: 'referral', label: 'Referral' },
  { value: 'corporate', label: 'Corporate' },
]
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other']

function nights(from, to) {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
}

/**
 * Create-booking form. Loads real rooms from the API, previews the full pricing
 * breakdown, and POSTs to the booking API. Calls onSaved(booking) on success.
 */
export default function NewBookingModal({ isOpen, onClose, onSaved }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  // Load rooms + hotel settings whenever the modal opens
  useEffect(() => {
    if (!isOpen) return
    setApiError('')
    setLoadingRooms(true)
    Promise.all([roomsApi.getAll(), settingsApi.get().catch(() => ({ data: {} }))])
      .then(([roomsRes, settingsRes]) => {
        const list = roomsRes.data?.rooms || roomsRes.data || []
        const available = list.filter((r) => r.status === 'available')
        const pool = available.length ? available : list
        setRooms(pool)
        setRoomTypes(settingsRes.data?.roomTypes || [])
        const gst = settingsRes.data?.hotel?.gstRate
        setValues((v) => ({
          ...EMPTY,
          ...v,
          roomId: pool[0]?.id || '',
          roomRate: pool[0]?.dailyRate ?? '',
          taxRate: gst ?? v.taxRate,
        }))
      })
      .catch(() => setApiError('Could not load rooms. Is the backend running?'))
      .finally(() => setLoadingRooms(false))
  }, [isOpen])

  const room = useMemo(() => rooms.find((r) => r.id === values.roomId), [rooms, values.roomId])
  const typeName = (r) => roomTypes.find((t) => t.id === r?.typeId)?.name || ''

  // When the selected room or stay type changes, refresh the rate default
  useEffect(() => {
    if (!room) return
    setValues((v) => ({
      ...v,
      roomRate: v.stayType === 'daily' ? room.dailyRate : room.monthlyRate,
    }))
  }, [values.roomId, values.stayType]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live pricing preview (mirrors the server formula) ──
  const pricing = useMemo(() => {
    const rate = Number(values.roomRate) || 0
    const units = values.stayType === 'daily' ? nights(values.fromDate, values.toDate) : Number(values.months) || 0
    const subtotal = rate * units
    const taxable = Math.max(0, subtotal - (Number(values.discount) || 0))
    const taxAmount = (taxable * (Number(values.taxRate) || 0)) / 100
    const total = taxable + taxAmount + (Number(values.extraCharges) || 0)
    const balance = total - (Number(values.advance) || 0)
    return { units, subtotal, taxAmount, total, balance }
  }, [values])

  const validate = () => {
    const e = {}
    if (!values.guestName.trim()) e.guestName = 'Guest name is required'
    if (!values.roomId) e.roomId = 'Select a room'
    if (values.stayType === 'daily') {
      if (!values.toDate) e.toDate = 'Check-out date is required'
      else if (nights(values.fromDate, values.toDate) < 1) e.toDate = 'Must be after check-in'
    } else if (!values.months || Number(values.months) < 1) {
      e.months = 'At least 1 month'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const reset = () => { setValues(EMPTY); setErrors({}); setApiError('') }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setApiError('')
    try {
      const payload = {
        guestName: values.guestName.trim(),
        guestPhone: values.guestPhone.trim() || undefined,
        guestEmail: values.guestEmail.trim() || undefined,
        guestAddress: values.guestAddress.trim() || undefined,
        nationality: values.nationality.trim() || undefined,
        idType: values.idType || undefined,
        idNumber: values.idNumber.trim() || undefined,
        adults: Number(values.adults) || 1,
        children: Number(values.children) || 0,
        roomId: values.roomId,
        stayType: values.stayType,
        fromDate: new Date(values.fromDate).toISOString(),
        toDate: values.stayType === 'daily' ? new Date(values.toDate).toISOString() : undefined,
        months: values.stayType === 'monthly' ? Number(values.months) : undefined,
        roomRate: Number(values.roomRate) || 0,
        discount: Number(values.discount) || 0,
        taxRate: Number(values.taxRate) || 0,
        extraCharges: Number(values.extraCharges) || 0,
        advance: Number(values.advance) || 0,
        source: values.source,
        specialRequests: values.specialRequests.trim() || undefined,
        notes: values.notes.trim() || undefined,
      }
      const { data } = await bookingsApi.create(payload)
      onSaved(data.booking)
      reset()
    } catch (err) {
      const d = err.response?.data
      setApiError(d?.message || d?.error || 'Could not create the booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => { reset(); onClose() }
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="New Booking"
      subtitle="Reserve a room and capture guest details"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} icon="＋" disabled={submitting || loadingRooms}>
            {submitting ? 'Saving…' : 'Create Booking'}
          </Button>
        </>
      }
    >
      {apiError && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {apiError}
        </div>
      )}

      {/* ── Guest ── */}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2">Guest details</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Guest name" value={values.guestName} onChange={set('guestName')}
               placeholder="Full name" error={errors.guestName} required />
        <Field label="Phone" value={values.guestPhone} onChange={set('guestPhone')} placeholder="+91 …" />
        <Field label="Email" type="email" value={values.guestEmail} onChange={set('guestEmail')}
               placeholder="guest@example.com" />
        <Field label="Nationality" value={values.nationality} onChange={set('nationality')} placeholder="Indian" />
        <Field label="ID type" value={values.idType} onChange={set('idType')}
               options={ID_TYPES.map((t) => ({ value: t, label: t }))} />
        <Field label="ID number" value={values.idNumber} onChange={set('idNumber')} placeholder="ID / document no." />
        <Field label="Address" value={values.guestAddress} onChange={set('guestAddress')}
               placeholder="City, State" className="sm:col-span-2" />
        <Field label="Adults" type="number" min="1" value={values.adults} onChange={set('adults')} />
        <Field label="Children" type="number" min="0" value={values.children} onChange={set('children')} />
      </div>

      {/* ── Stay ── */}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2 mt-5">Stay</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Room" value={values.roomId} onChange={set('roomId')} error={errors.roomId}
               options={
                 loadingRooms
                   ? [{ value: '', label: 'Loading rooms…' }]
                   : rooms.length
                     ? rooms.map((r) => ({ value: r.id, label: `Room ${r.number}${typeName(r) ? ` · ${typeName(r)}` : ''} · ₹${r.dailyRate}/night` }))
                     : [{ value: '', label: 'No rooms available' }]
               } />
        <Field label="Booking source" value={values.source} onChange={set('source')} options={SOURCES} />
        <Field label="Stay type" value={values.stayType} onChange={set('stayType')}
               options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]} />
        <Field label="Check-in" type="date" value={values.fromDate} onChange={set('fromDate')} />
        {values.stayType === 'daily' ? (
          <Field label="Check-out" type="date" value={values.toDate} onChange={set('toDate')}
                 error={errors.toDate} required />
        ) : (
          <Field label="Months" type="number" min="1" value={values.months} onChange={set('months')}
                 error={errors.months} required />
        )}
      </div>

      {/* ── Pricing ── */}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-2 mt-5">Pricing</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label={`Rate (₹/${values.stayType === 'daily' ? 'night' : 'month'})`} type="number" min="0"
               value={values.roomRate} onChange={set('roomRate')} />
        <Field label="Discount (₹)" type="number" min="0" value={values.discount} onChange={set('discount')} />
        <Field label="GST (%)" type="number" min="0" value={values.taxRate} onChange={set('taxRate')} />
        <Field label="Extra charges (₹)" type="number" min="0" value={values.extraCharges} onChange={set('extraCharges')} />
        <Field label="Advance paid (₹)" type="number" min="0" value={values.advance} onChange={set('advance')} />
      </div>

      {/* ── Notes ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <Field label="Special requests" textarea value={values.specialRequests} onChange={set('specialRequests')}
               placeholder="Late check-in, extra bed…" />
        <Field label="Internal notes" textarea value={values.notes} onChange={set('notes')}
               placeholder="Staff-only notes…" />
      </div>

      {/* ── Pricing summary ── */}
      <div className="mt-5 rounded-lg bg-gold-bg border border-gold-border px-4 py-3 text-sm">
        <div className="flex justify-between text-ink2">
          <span>Subtotal{pricing.units ? ` · ${pricing.units} ${values.stayType === 'daily' ? 'night(s)' : 'month(s)'} × ${inr(values.roomRate)}` : ''}</span>
          <span>{inr(pricing.subtotal)}</span>
        </div>
        {Number(values.discount) > 0 && (
          <div className="flex justify-between text-ink2 mt-1"><span>Discount</span><span>− {inr(values.discount)}</span></div>
        )}
        <div className="flex justify-between text-ink2 mt-1"><span>GST ({values.taxRate || 0}%)</span><span>{inr(pricing.taxAmount)}</span></div>
        {Number(values.extraCharges) > 0 && (
          <div className="flex justify-between text-ink2 mt-1"><span>Extra charges</span><span>{inr(values.extraCharges)}</span></div>
        )}
        <div className="flex justify-between font-display font-bold text-base text-gold mt-2 pt-2 border-t border-gold-border">
          <span>Total</span><span>{inr(pricing.total)}</span>
        </div>
        <div className="flex justify-between text-ink2 mt-1">
          <span>Advance</span><span>{inr(values.advance)}</span>
        </div>
        <div className="flex justify-between font-medium text-ink mt-1">
          <span>Balance due</span><span>{inr(pricing.balance)}</span>
        </div>
      </div>
    </Modal>
  )
}
