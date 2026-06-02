import { Modal, Button } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { balance, stayLabel } from '../../../utils/booking'

/** Final bill summary shown before confirming a guest's check-out. */
export default function CheckOutModal({ isOpen, booking, onClose, onConfirm }) {
  if (!booking) return null

  const due = balance(booking)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Out"
      subtitle={`${booking.guestName} · Room ${booking.room}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={() => onConfirm(booking)} icon="✓">
            {due > 0 ? `Settle ₹${due.toLocaleString('en-IN')} & Check Out` : 'Confirm Check Out'}
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
          <Line label="Room" value={`${booking.room} · ${booking.roomType}`} />
          <Line label="Checked in" value={formatDate(booking.checkedInAt || booking.fromDate)} />
          <Line label="Duration" value={stayLabel(booking)} />
          <Line
            label={booking.stayType === 'monthly' ? 'Monthly rate' : `Room (${stayLabel(booking)})`}
            value={formatCurrency(booking.amount)}
          />
          <Line label="Advance paid" value={`− ${formatCurrency(booking.advance)}`} />
          <div className="border-t border-line pt-2 mt-2 flex items-center justify-between">
            <span className="font-syne font-semibold text-ink">Balance due</span>
            <span className={`font-syne font-bold text-lg ${due > 0 ? 'text-danger-text' : 'text-success-text'}`}>
              {due > 0 ? formatCurrency(due) : 'Settled'}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] text-ink3">
        Confirming releases Room {booking.room} and moves the guest to checked-out history.
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
