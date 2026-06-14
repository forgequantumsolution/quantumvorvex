import { useState } from 'react'
import { Modal, Field, Button } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { balance, dateRangeLabel } from '../../../utils/booking'

const REASONS = [
  'Guest changed travel plans',
  'Found alternative accommodation',
  'Booked by mistake',
  'Payment not completed',
  'No-show',
  'Other',
]

/**
 * Cancel-a-booking dialog. Works in two modes:
 *  - fixed:  pass `booking` → confirm cancelling that specific booking.
 *  - picker: pass `bookings` (list of cancellable ones) → user selects one.
 * Calls onConfirm({ id, reason }).
 */
export default function CancelModal({ isOpen, onClose, booking, bookings = [], onConfirm }) {
  const isPicker = !booking
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [error, setError] = useState('')

  // Derive the target without an effect: prefer the explicit selection, then the
  // fixed booking, then the first cancellable one.
  const target =
    booking ||
    bookings.find((b) => b.id === selectedId) ||
    bookings[0] ||
    null

  const reset = () => {
    setSelectedId('')
    setReason(REASONS[0])
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleConfirm = () => {
    if (!target) {
      setError('Select a booking to cancel')
      return
    }
    onConfirm({ id: target.id, reason })
    reset()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cancel Booking"
      subtitle={booking ? `${booking.bookingNo} · ${booking.guestName}` : 'Select a booking to cancel'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Keep Booking</Button>
          <Button variant="danger" onClick={handleConfirm} icon="✕">Confirm Cancellation</Button>
        </>
      }
    >
      {isPicker && (
        <Field
          label="Booking"
          value={target?.id || ''}
          onChange={(e) => setSelectedId(e.target.value)}
          options={bookings.map((b) => ({ value: b.id, label: `${b.bookingNo} · ${b.guestName} · Room ${b.roomNumber || b.room}` }))}
          error={error}
          className="mb-4"
        />
      )}

      {target && (
        <div className="rounded-lg bg-surface2 border border-line px-4 py-3 mb-4 text-sm space-y-1.5">
          <Row label="Guest" value={target.guestName} />
          <Row label="Room" value={`${target.roomNumber || target.room} · ${target.roomType}`} />
          <Row label="Stay" value={dateRangeLabel(target)} />
          <Row label="Outstanding" value={formatCurrency(balance(target))} />
        </div>
      )}

      <Field label="Reason for cancellation" value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS} />

      <p className="mt-4 text-[12.5px] text-danger-text bg-danger-bg border border-danger/30 rounded-lg px-3 py-2">
        This frees the room and moves the booking to the Cancellations list. This can’t be undone.
      </p>
    </Modal>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink3">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </div>
  )
}
