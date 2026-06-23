import { useState } from 'react'
import Modal from '../../ui/Modal'
import { formatCurrency } from '../../../utils/format'

const MAX_PROOF_BYTES = 10 * 1024 * 1024 // matches the server's 10MB limit

// Lowercase values are what the check-out API persists for the payment method —
// shared by both the guests and bookings flows so the payments ledger stays uniform.
const DEFAULT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

/**
 * Shared two-step check-out modal used by both Guests and Bookings.
 *
 * The base flow (bill summary → confirm & pay) is entity-agnostic — callers
 * pass a normalised bill (lineItems + advance + balanceDue) and receive the
 * raw inputs back via onConfirm. Booking-only billing controls (extra charges,
 * partial "collect now" amount, payment reference) are opt-in via flags so the
 * guest flow stays a simple full-balance settlement.
 *
 * onConfirm receives: { extra, finalPayment, paymentMethod, paymentReference, notes, proofFile }
 */
export default function CheckOutModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  guestName,
  folio,
  room,
  stayPeriod,
  lineItems = [],
  advance = 0,
  balanceDue = 0,
  paymentMethods = DEFAULT_METHODS,
  allowExtraCharges = false,
  allowPartialPayment = false,
  footnote = 'Room will be marked as Dirty and queued for housekeeping automatically.',
}) {
  // Both call sites render this modal conditionally (it unmounts on close), so
  // state initialisers re-run on every open — the collectable amount defaults to
  // the full balance without needing a reset effect.
  const [step, setStep] = useState(1)
  const [extra, setExtra] = useState(0)
  const [payment, setPayment] = useState(() => (balanceDue > 0 ? balanceDue : 0))
  const [payMethod, setPayMethod] = useState(() => paymentMethods[0]?.value)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [settled, setSettled] = useState(false)
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')

  if (!isOpen) return null

  const extraNum = Number(extra) || 0
  // Without the partial-payment control we always settle the full balance.
  const paymentNum = allowPartialPayment ? (Number(payment) || 0) : Math.max(balanceDue, 0)
  const dueAfter = balanceDue + extraNum - paymentNum
  const collecting = paymentNum > 0
  // A reference number is only meaningful for non-cash methods when collecting.
  const showReference = allowPartialPayment && collecting && payMethod !== 'cash'

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

  const handleConfirm = () => {
    if (step === 1) { setStep(2); return }
    onConfirm({
      extra: extraNum,
      finalPayment: paymentNum,
      paymentMethod: payMethod,
      paymentReference: showReference ? reference.trim() : '',
      notes,
      proofFile: proof,
    })
  }

  const confirmLabel = submitting
    ? 'Processing…'
    : allowPartialPayment && paymentNum > 0
      ? `Collect ${formatCurrency(paymentNum)} & Check Out`
      : 'Complete Check-Out'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Check-Out — ${guestName}`}
      maxWidth="520px"
      footer={
        <>
          <button
            className="btn btn-outline btn-sm"
            disabled={submitting}
            onClick={step === 2 ? () => setStep(1) : onClose}
          >
            {step === 2 ? 'Back' : 'Cancel'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={submitting || (step === 2 && !settled)}
            onClick={handleConfirm}
          >
            {step === 1 ? 'Review & Confirm →' : confirmLabel}
          </button>
        </>
      }
    >
      {/* Step indicator */}
      <div className="flex gap-1.5 mb-5">
        {['Bill Summary', 'Confirm & Pay'].map((s, i) => (
          <div key={s} className="flex-1 text-center">
            <div className={`h-[3px] rounded-sm mb-[5px] ${step > i ? 'bg-gold' : 'bg-line'}`} />
            <span className={`text-[10.5px] font-semibold ${step > i ? 'text-gold' : 'text-ink3'}`}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Room + period */}
          <div className="bg-surface2 rounded-lg px-3.5 py-3 mb-3.5 border border-line">
            {folio && (
              <div className="flex justify-between mb-1.5">
                <span className="t-xs text-ink3">Folio</span>
                <span className="t-xs text-ink2" style={{ fontFamily: 'var(--font-mono)' }}>{folio}</span>
              </div>
            )}
            <div className="flex justify-between mb-1.5">
              <span className="t-xs text-ink3">Room</span>
              <span className="t-title" style={{ fontFamily: 'var(--font-mono)' }}>{room}</span>
            </div>
            {stayPeriod && (
              <div className="flex justify-between">
                <span className="t-xs text-ink3">Stay Period</span>
                <span className="text-[12.5px] font-medium">{stayPeriod}</span>
              </div>
            )}
          </div>

          {/* Bill breakdown */}
          <div className="mb-3.5">
            {lineItems.map(([k, v]) => v > 0 && (
              <div key={k} className="flex justify-between py-[7px] border-b border-line">
                <span className="t-sm text-ink2">{k}</span>
                <span className="t-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(v)}</span>
              </div>
            ))}
            <div className="flex justify-between py-[9px] border-b border-line">
              <span className="t-sm text-ink2">Advance Paid</span>
              <span className="t-sm text-success-text" style={{ fontFamily: 'var(--font-mono)' }}>−{formatCurrency(advance)}</span>
            </div>
            <div className="t-h3 flex justify-between py-[11px]">
              <span>Balance Due</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: balanceDue > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {formatCurrency(Math.abs(balanceDue))} {balanceDue <= 0 ? '(refund)' : ''}
              </span>
            </div>
          </div>

          {footnote && (
            <div className="t-xs text-ink3 mt-2.5">{footnote}</div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          {/* Fixed full-balance settlement (guest flow) */}
          {!allowPartialPayment && (
            <div className="bg-[var(--gold-bg)] rounded-lg px-3.5 py-3 mb-4 flex justify-between items-center">
              <span className="font-semibold text-gold">Amount to Collect</span>
              <span className="t-h3 text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(Math.max(balanceDue, 0))}</span>
            </div>
          )}

          {/* Editable billing controls (booking flow) */}
          {(allowExtraCharges || allowPartialPayment) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
              {allowExtraCharges && (
                <div>
                  <label className="form-label block mb-[5px]">Extra charges (₹)</label>
                  <input className="form-input" type="number" min="0" value={extra}
                    onChange={e => setExtra(e.target.value)} placeholder="0" />
                </div>
              )}
              {allowPartialPayment && (
                <div>
                  <label className="form-label block mb-[5px]">Collect now (₹)</label>
                  <input className="form-input" type="number" min="0" value={payment}
                    onChange={e => setPayment(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label block mb-[5px]">Payment Method</label>
            <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {showReference && (
            <div className="mb-3.5">
              <label className="form-label block mb-[5px]">Reference / txn no.</label>
              <input className="form-input" value={reference}
                onChange={e => setReference(e.target.value)} placeholder="e.g. UPI ref, last 4 digits" />
            </div>
          )}

          <div className="mb-3.5">
            <label className="form-label block mb-[5px]">Remarks (optional)</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key return confirmation, damages, etc." />
          </div>

          <div className="mb-3.5">
            <label className="form-label block mb-[5px]">Payment screenshot / proof (optional)</label>
            {proof ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line2 bg-surface px-3 py-2">
                <span className="t-sm text-ink truncate">📎 {proof.name}</span>
                <button
                  type="button"
                  className="t-xs text-ink3 hover:text-danger-text shrink-0"
                  onClick={() => { setProof(null); setProofError('') }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-line2 bg-surface px-3 py-2.5 t-sm text-ink3 hover:border-gold hover:text-ink2">
                <span className="text-base">⬆</span>
                <span>Attach an image or PDF (e.g. UPI / card receipt)</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={pickProof} />
              </label>
            )}
            {proofError && <span className="block text-[11.5px] text-danger mt-1">{proofError}</span>}
          </div>

          {/* Running balance after this settlement (booking flow) */}
          {(allowExtraCharges || allowPartialPayment) && (
            <div className="mb-3.5 flex items-center justify-between rounded-lg bg-surface2 border border-line px-3.5 py-3">
              <span className="font-semibold text-ink">Balance after check-out</span>
              <span className="t-h3" style={{ fontFamily: 'var(--font-mono)', color: dueAfter > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {dueAfter > 0 ? formatCurrency(dueAfter) : 'Settled'}
              </span>
            </div>
          )}

          <label className="t-sm flex items-center gap-[9px] cursor-pointer">
            <input type="checkbox" checked={settled} onChange={e => setSettled(e.target.checked)} />
            Payment received & key returned — confirm checkout
          </label>
        </>
      )}
    </Modal>
  )
}
