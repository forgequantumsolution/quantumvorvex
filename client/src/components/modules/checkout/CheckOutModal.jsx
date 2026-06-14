import { useEffect, useState } from 'react'
import { Modal, Button, Field } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { stayLabel } from '../../../utils/booking'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

const MAX_PROOF_BYTES = 10 * 1024 * 1024 // matches the server's 10MB limit

/** Final bill + settlement before confirming a guest's check-out. */
export default function CheckOutModal({ isOpen, booking, submitting, onClose, onConfirm }) {
  const [extra, setExtra] = useState(0)
  const [payment, setPayment] = useState(0)
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')

  const baseDue = Number(booking?.balanceDue) || 0
  // New balance after adding extra charges and collecting a final payment
  const dueAfter = baseDue + (Number(extra) || 0) - (Number(payment) || 0)
  const collecting = Number(payment) > 0
  // A reference number is only meaningful for non-cash methods.
  const showReference = collecting && method !== 'cash'

  // When a new booking is targeted, default the payment to the full balance.
  useEffect(() => {
    if (booking) {
      setExtra(0); setPayment(baseDue > 0 ? baseDue : 0)
      setMethod('cash'); setReference(''); setProof(null); setProofError('')
    }
  }, [booking]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickProof = (e) => {
    const file = e.target.files?.[0] || null
    setProofError('')
    if (file && file.size > MAX_PROOF_BYTES) {
      setProof(null); setProofError('File is too large (max 10MB).')
      e.target.value = ''
      return
    }
    setProof(file)
  }

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
              paymentMethod: method,
              paymentReference: showReference ? reference.trim() : '',
              proofFile: proof,
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

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="Payment method" options={PAYMENT_METHODS} value={method}
               onChange={(e) => setMethod(e.target.value)} disabled={!collecting} />
        {showReference && (
          <Field label="Reference / txn no." value={reference}
                 onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI ref, last 4 digits" />
        )}
      </div>

      <div className="mt-3">
        <span className="block text-xs font-medium text-ink2 mb-1.5">Payment screenshot / proof (optional)</span>
        {proof ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line2 bg-surface px-3 py-2">
            <span className="text-sm text-ink truncate">📎 {proof.name}</span>
            <button
              type="button"
              className="text-xs text-ink3 hover:text-danger-text shrink-0"
              onClick={() => { setProof(null); setProofError('') }}
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-line2 bg-surface px-3 py-2.5 text-sm text-ink3 hover:border-gold hover:text-ink2">
            <span className="text-base">⬆</span>
            <span>Attach an image or PDF (e.g. UPI / card receipt)</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={pickProof} />
          </label>
        )}
        {proofError && <span className="block text-[11.5px] text-danger mt-1">{proofError}</span>}
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
