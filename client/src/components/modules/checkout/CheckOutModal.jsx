import { useEffect, useState } from 'react'
import { Modal, Button, Field } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { stayLabel } from '../../../utils/booking'

/** Final bill + settlement before confirming a guest's check-out. */
export default function CheckOutModal({ isOpen, booking, submitting, onClose, onConfirm }) {
  const [extra, setExtra] = useState(0)
  const [payment, setPayment] = useState(0)

  const baseDue = Number(booking?.balanceDue) || 0
  // New balance after adding extra charges and collecting a final payment
  const dueAfter = baseDue + (Number(extra) || 0) - (Number(payment) || 0)

  // When a new booking is targeted, default the payment to the full balance.
  useEffect(() => {
    if (booking) { setExtra(0); setPayment(baseDue > 0 ? baseDue : 0) }
  }, [booking]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!booking) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Out"
      subtitle={`${booking.guestName} · Room ${booking.roomNumber}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            variant="success"
            icon="✓"
            disabled={submitting}
            onClick={() => onConfirm({
              id: booking.id,
              extraCharges: (Number(booking.extraCharges) || 0) + (Number(extra) || 0),
              finalPayment: Number(payment) || 0,
            })}
          >
            {submitting ? 'Processing…' : Number(payment) > 0 ? `Collect ₹${Number(payment).toLocaleString('en-IN')} & Check Out` : 'Confirm Check Out'}
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-line overflow-hidden">
        <div className="px-4 py-3 bg-surface2 border-b border-line">
          <div className="text-xs text-ink3 uppercase tracking-wide">Folio</div>
          <div className="font-mono text-sm text-ink mt-0.5">{booking.bookingNo}</div>
        </div>
        <div className="px-4 py-3 text-sm space-y-2">
          <Line label="Room" value={`${booking.roomNumber} · ${booking.roomType}`} />
          <Line label="Checked in" value={formatDate(booking.checkedInAt || booking.fromDate)} />
          <Line label="Duration" value={stayLabel(booking)} />
          <Line label="Total amount" value={formatCurrency(booking.amount)} />
          <Line label="Advance paid" value={`− ${formatCurrency(booking.advance)}`} />
          <div className="border-t border-line pt-2 mt-2">
            <Line label="Balance before settlement" value={formatCurrency(baseDue)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Extra charges (₹)" type="number" min="0" value={extra}
               onChange={(e) => setExtra(e.target.value)} placeholder="0" />
        <Field label="Collect now (₹)" type="number" min="0" value={payment}
               onChange={(e) => setPayment(e.target.value)} placeholder="0" />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-surface2 border border-line px-4 py-3">
        <span className="font-display font-semibold text-ink">Balance after check-out</span>
        <span className={`font-display font-bold text-lg ${dueAfter > 0 ? 'text-danger-text' : 'text-success-text'}`}>
          {dueAfter > 0 ? formatCurrency(dueAfter) : 'Settled'}
        </span>
      </div>

      <p className="mt-3 text-[12.5px] text-ink3">
        Confirming releases Room {booking.roomNumber} and moves the guest to checked-out history.
      </p>
    </Modal>
  )
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink3">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </div>
  )
}
