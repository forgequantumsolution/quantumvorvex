import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../ui/Modal'
import CameraCapture from '../../ui/CameraCapture'
import { formatCurrency } from '../../../utils/format'

// Step labels: checkout:steps.<key>.
const STEPS = ['bill', 'pay', 'photo']

const MAX_PROOF_BYTES = 10 * 1024 * 1024 // matches the server's 10MB limit

// Lowercase values are what the check-out API persists for the payment method —
// shared by both the guests and bookings flows so the payments ledger stays uniform.
// A method without a label is shown as checkout:methods.<value>.
const DEFAULT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'other'].map((value) => ({ value }))

/**
 * Shared two-step check-out modal used by both Guests and Bookings.
 *
 * The base flow (bill summary → confirm & pay) is entity-agnostic — callers
 * pass a normalised bill (lineItems + advance + balanceDue) and receive the
 * raw inputs back via onConfirm. Booking-only billing controls (extra charges,
 * partial "collect now" amount, payment reference) are opt-in via flags so the
 * guest flow stays a simple full-balance settlement.
 *
 * A final step captures a check-out photo of the guest; it is optional, so a
 * device without a working camera never blocks the check-out.
 *
 * onConfirm receives: { extra, finalPayment, paymentMethod, paymentReference, notes, proofFile, photoFile }
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
  defaultPayment,
  paymentMethods = DEFAULT_METHODS,
  allowExtraCharges = false,
  allowPartialPayment = false,
  footnote, // defaults to checkout:footnote; pass '' to hide it
}) {
  const { t } = useTranslation('checkout')
  // Both call sites render this modal conditionally (it unmounts on close), so
  // state initialisers re-run on every open — the collectable amount defaults to
  // the full balance without needing a reset effect.
  const [step, setStep] = useState(1)
  const [extra, setExtra] = useState(0)
  const [payment, setPayment] = useState(() => defaultPayment ?? (balanceDue > 0 ? balanceDue : 0))
  const [payMethod, setPayMethod] = useState(() => paymentMethods[0]?.value)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [settled, setSettled] = useState(false)
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')
  const [photo, setPhoto] = useState(null)

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
      setProof(null); setProofError(t('fileTooLarge'))
      e.target.value = ''
      return
    }
    setProof(file)
  }

  const handleConfirm = () => {
    if (step < 3) { setStep(step + 1); return }
    onConfirm({
      extra: extraNum,
      finalPayment: paymentNum,
      paymentMethod: payMethod,
      paymentReference: showReference ? reference.trim() : '',
      notes,
      proofFile: proof,
      photoFile: photo,
    })
  }

  const confirmLabel = submitting
    ? t('processing')
    : allowPartialPayment && paymentNum > 0
      ? t('collectAndCheckOut', { amount: formatCurrency(paymentNum) })
      : t('complete')

  const nextLabel = step === 1 ? `${t('review')} →` : step === 2 ? `${t('nextPhoto')} →` : confirmLabel
  const note = footnote ?? t('footnote')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title', { name: guestName })}
      maxWidth="520px"
      footer={
        <>
          <button
            className="btn btn-outline btn-sm"
            disabled={submitting}
            onClick={step > 1 ? () => setStep(step - 1) : onClose}
          >
            {step > 1 ? t('common:back') : t('common:cancel')}
          </button>
          <button
            className="btn btn-danger btn-sm max-sm:whitespace-normal max-sm:leading-tight"
            disabled={submitting || (step === 2 && !settled)}
            onClick={handleConfirm}
          >
            {nextLabel}
          </button>
        </>
      }
    >
      {/* Step indicator */}
      <div className="flex gap-1.5 mb-4 sm:mb-5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 min-w-0 text-center">
            <div className={`h-[3px] rounded-sm mb-[5px] ${step > i ? 'bg-gold' : 'bg-line'}`} />
            <span className={`block text-xs leading-tight font-semibold ${step > i ? 'text-gold' : 'text-ink3'}`}>{t(`steps.${s}`)}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Room + period */}
          <div className="bg-surface2 rounded-lg px-3.5 py-3 mb-3.5 border border-line">
            {folio && (
              <div className="flex justify-between gap-3 mb-1.5">
                <span className="t-xs text-ink3 shrink-0">{t('folio')}</span>
                <span className="t-xs text-ink2 font-mono text-right break-all">{folio}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 mb-1.5">
              <span className="t-xs text-ink3 shrink-0">{t('common:room')}</span>
              <span className="t-title font-mono text-right min-w-0 break-words">{room}</span>
            </div>
            {stayPeriod && (
              <div className="flex justify-between gap-3">
                <span className="t-xs text-ink3 shrink-0">{t('stayPeriod')}</span>
                <span className="text-[12.5px] font-medium text-right min-w-0">{stayPeriod}</span>
              </div>
            )}
          </div>

          {/* Bill breakdown */}
          <div className="mb-3.5">
            {lineItems.map(([k, v]) => v > 0 && (
              <div key={k} className="flex justify-between gap-3 py-[7px] border-b border-line">
                <span className="t-sm text-ink2 min-w-0">{k}</span>
                <span className="t-sm font-mono">{formatCurrency(v)}</span>
              </div>
            ))}
            <div className="flex justify-between py-[9px] border-b border-line">
              <span className="t-sm text-ink2">{t('advancePaid')}</span>
              <span className="t-sm text-success-text font-mono">−{formatCurrency(advance)}</span>
            </div>
            <div className="t-h3 flex flex-wrap justify-between gap-x-3 py-[11px]">
              <span>{t('balanceDue')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: balanceDue > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {formatCurrency(Math.abs(balanceDue))} {balanceDue <= 0 ? `(${t('refund')})` : ''}
              </span>
            </div>
          </div>

          {note && (
            <div className="t-xs text-ink3 mt-2.5">{note}</div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          {/* Fixed full-balance settlement (guest flow) */}
          {!allowPartialPayment && (
            <div className="bg-[var(--gold-bg)] rounded-lg px-3.5 py-3 mb-4 flex flex-wrap justify-between items-center gap-x-3">
              <span className="font-semibold text-gold">{t('amountToCollect')}</span>
              <span className="t-h3 text-gold font-mono">{formatCurrency(Math.max(balanceDue, 0))}</span>
            </div>
          )}

          {/* Editable billing controls (booking flow) */}
          {(allowExtraCharges || allowPartialPayment) && (
            <div className={`grid gap-3 mb-3.5 ${allowExtraCharges && allowPartialPayment ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {allowExtraCharges && (
                <div>
                  <label className="form-label block mb-[5px]">{t('extraCharges')}</label>
                  <input className="form-input w-full" type="number" min="0" value={extra}
                    onChange={e => setExtra(e.target.value)} placeholder="0" />
                </div>
              )}
              {allowPartialPayment && (
                <div>
                  <label className="form-label block mb-[5px]">{t('collectNow')}</label>
                  <input className="form-input w-full" type="number" min="0" value={payment}
                    onChange={e => setPayment(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label block mb-[5px]">{t('paymentMethod')}</label>
            <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label || t(`methods.${m.value}`, { defaultValue: m.value })}</option>)}
            </select>
          </div>

          {showReference && (
            <div className="mb-3.5">
              <label className="form-label block mb-[5px]">{t('reference')}</label>
              <input className="form-input" value={reference}
                onChange={e => setReference(e.target.value)} placeholder={t('referencePlaceholder')} />
            </div>
          )}

          <div className="mb-3.5">
            <label className="form-label block mb-[5px]">{t('remarks')}</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('remarksPlaceholder')} />
          </div>

          <div className="mb-3.5">
            <label className="form-label block mb-[5px]">{t('proof')}</label>
            {proof ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line2 bg-surface px-3 py-2">
                <span className="t-sm text-ink truncate">📎 {proof.name}</span>
                <button
                  type="button"
                  className="t-xs text-ink3 hover:text-danger-text shrink-0 pointer-coarse:min-h-11 pointer-coarse:px-2"
                  onClick={() => { setProof(null); setProofError('') }}
                >
                  {t('common:remove')}
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 min-h-11 cursor-pointer rounded-lg border border-dashed border-line2 bg-surface px-3 py-2.5 t-sm text-ink3 hover:border-gold hover:text-ink2">
                <span className="text-base shrink-0">⬆</span>
                <span>{t('attachProof')}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={pickProof} />
              </label>
            )}
            {proofError && <span className="block text-xs text-danger mt-1">{proofError}</span>}
          </div>

          {/* Running balance after this settlement (booking flow) */}
          {(allowExtraCharges || allowPartialPayment) && (
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-surface2 border border-line px-3.5 py-3">
              <span className="font-semibold text-ink">{t('balanceAfter')}</span>
              <span className="t-h3" style={{ fontFamily: 'var(--font-mono)', color: dueAfter > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>
                {dueAfter > 0 ? formatCurrency(dueAfter) : t('settled')}
              </span>
            </div>
          )}

          <label className="t-sm flex items-center gap-[9px] min-h-11 cursor-pointer">
            <input className="shrink-0 w-[18px] h-[18px]" type="checkbox" checked={settled} onChange={e => setSettled(e.target.checked)} />
            {t('confirmReceived')}
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <p className="t-sm text-ink3 mb-3">
            {t('photoHint')}
          </p>
          {/* Mounted only on this step so the camera stops the moment the user
              goes Back or the check-out completes. */}
          <CameraCapture
            facingMode="user"
            namePrefix="checkout-photo"
            disabled={submitting}
            onChange={setPhoto}
          />
        </>
      )}
    </Modal>
  )
}
