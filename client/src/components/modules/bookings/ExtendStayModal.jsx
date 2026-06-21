import { useState, useMemo, useEffect } from 'react'
import Modal from '../../ui/Modal'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel, stayLabel } from '../../../utils/booking'

const DAY_MS = 86400000
const LIVE = ['Pending', 'Confirmed', 'CheckedIn']

// Local YYYY-MM-DD for a date (avoids the UTC off-by-one of toISOString).
const ymd = (d) => {
  const x = new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

const nights = (from, to) => {
  if (!from || !to) return 0
  return Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY_MS))
}

/**
 * Extend an existing booking's stay. Daily stays pick a later check-out date;
 * monthly stays add whole months. The new total is recomputed locally for preview
 * (mirroring the server's computePricing) — the server stays the source of truth.
 *
 * For daily stays we look up the next booking on the same room and cap the date
 * picker to it, so staff can only pick a window that's actually free. A same-day
 * turnover is allowed: the new check-out may equal the next booking's check-in.
 *
 * onConfirm receives the PUT /bookings/:id payload:
 *   daily   → { toDate: <ISO string> }
 *   monthly → { months: <new total months> }
 */
export default function ExtendStayModal({ isOpen, onClose, onConfirm, submitting = false, booking }) {
  const isMonthly = booking?.stayType === 'monthly'

  // Minimum valid new check-out = day after the current one; default to +1 night.
  const minDate = useMemo(
    () => (booking?.toDate ? ymd(new Date(booking.toDate).getTime() + DAY_MS) : ''),
    [booking],
  )
  const [newToDate, setNewToDate] = useState(minDate)
  const [addMonths, setAddMonths] = useState(1)

  // `undefined` = still checking, `null` = no upcoming booking, object = the blocker.
  // The modal remounts per open (parent renders it conditionally), so this initial
  // value is correct each time without resetting it inside the effect.
  const [nextBooking, setNextBooking] = useState(undefined)

  // On open (daily only), find the earliest live booking on this room that starts
  // on/after the current check-out — that's the latest we can extend to.
  useEffect(() => {
    if (!booking || isMonthly) return
    let cancelled = false
    bookingsApi.getAll({ roomId: booking.roomId })
      .then(({ data }) => {
        if (cancelled) return
        const curEnd = new Date(booking.toDate).getTime()
        const next = (data.bookings || [])
          .filter((x) => x.id !== booking.id && LIVE.includes(x.status) && new Date(x.fromDate).getTime() >= curEnd)
          .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate))[0]
        setNextBooking(next || null)
      })
      .catch(() => { if (!cancelled) setNextBooking(null) })
    return () => { cancelled = true }
  }, [booking, isMonthly])

  const maxDate = nextBooking ? ymd(nextBooking.fromDate) : ''

  const preview = useMemo(() => {
    if (!booking) return null
    const rate = Number(booking.roomRate) || 0
    const units = isMonthly
      ? (Number(booking.months) || 1) + (Number(addMonths) || 0)
      : nights(booking.fromDate, newToDate)
    const subtotal = rate * units
    const taxable = Math.max(0, subtotal - (Number(booking.discount) || 0))
    const taxAmount = (taxable * (Number(booking.taxRate) || 0)) / 100
    const total = taxable + taxAmount + (Number(booking.extraCharges) || 0)
    const additional = total - (Number(booking.amount) || 0)
    return { units, total, additional }
  }, [booking, isMonthly, newToDate, addMonths])

  if (!isOpen || !booking) return null

  // The new check-out must move the stay later and stay within the free window.
  const valid = isMonthly
    ? Number(addMonths) >= 1
    : !!newToDate
      && nights(booking.fromDate, newToDate) > (Number(booking.nights) || 0)
      && (!maxDate || newToDate <= maxDate)

  const handleConfirm = () => {
    if (!valid || submitting) return
    onConfirm(
      isMonthly
        ? { months: (Number(booking.months) || 1) + Number(addMonths) }
        : { toDate: new Date(newToDate).toISOString() },
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Extend Stay — ${booking.guestName}`}
      maxWidth="460px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" disabled={submitting} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" disabled={submitting || !valid} onClick={handleConfirm}>
            {submitting ? 'Extending…' : 'Confirm Extension'}
          </button>
        </>
      }
    >
      {/* Current stay */}
      <div className="bg-surface2 rounded-lg px-3.5 py-3 mb-4 border border-line">
        <div className="flex justify-between mb-1.5">
          <span className="t-xs text-ink3">Booking</span>
          <span className="t-xs text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>{booking.bookingNo}</span>
        </div>
        <div className="flex justify-between mb-1.5">
          <span className="t-xs text-ink3">Room</span>
          <span className="t-xs text-ink2">Room {booking.roomNumber} · {booking.roomType}</span>
        </div>
        <div className="flex justify-between">
          <span className="t-xs text-ink3">Current stay</span>
          <span className="text-[12.5px] font-medium">{dateRangeLabel(booking)} · {stayLabel(booking)}</span>
        </div>
      </div>

      {/* New end of stay */}
      {isMonthly ? (
        <div className="mb-4">
          <label className="form-label block mb-[5px]">Add months</label>
          <input
            className="form-input"
            type="number"
            min="1"
            value={addMonths}
            onChange={(e) => setAddMonths(e.target.value)}
          />
        </div>
      ) : (
        <div className="mb-4">
          <label className="form-label block mb-[5px]">New check-out date</label>
          <input
            className="form-input"
            type="date"
            min={minDate}
            max={maxDate || undefined}
            value={newToDate}
            onChange={(e) => setNewToDate(e.target.value)}
          />
          {/* Availability hint (A): how far this room is actually free. */}
          <p className={`t-xs mt-1.5 ${nextBooking ? 'text-warning-text' : 'text-ink3'}`}>
            {nextBooking === undefined
              ? 'Checking room availability…'
              : nextBooking
                ? `Room is booked again from ${formatDate(nextBooking.fromDate)} (${nextBooking.bookingNo}) — extend up to then.`
                : 'No upcoming bookings on this room.'}
          </p>
        </div>
      )}

      {/* Price preview */}
      {preview && valid && (
        <div className="rounded-lg bg-gold-bg border border-gold-border px-4 py-3 text-sm">
          <div className="flex justify-between text-ink2">
            <span>New {isMonthly ? 'duration' : 'length'}</span>
            <span>{preview.units} {isMonthly ? 'month(s)' : 'night(s)'}</span>
          </div>
          <div className="flex justify-between text-ink2 mt-1">
            <span>New total</span>
            <span>{formatCurrency(preview.total)}</span>
          </div>
          <div className="flex justify-between font-medium text-gold mt-2 pt-2 border-t border-gold-border">
            <span>Additional due</span>
            <span>{formatCurrency(Math.max(0, preview.additional))}</span>
          </div>
        </div>
      )}

      <p className="t-xs text-ink3 mt-3">
        The room is re-checked for availability. Payment is collected at check-out.
      </p>
    </Modal>
  )
}
