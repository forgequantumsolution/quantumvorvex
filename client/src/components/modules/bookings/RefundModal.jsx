import { useState } from 'react'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { bookingsApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { refundAccount } from '../../../utils/beds'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
]

/**
 * Settle a tenant after move-out: dues come out of the security deposit, and the
 * deposit left plus any rent credit is refunded. This records the refund (Cash
 * Register, ledger, invoice); the money itself is paid by hand or transfer.
 */
export default function RefundModal({ booking, onClose, onRefunded }) {
  const acc = refundAccount(booking)
  const [deduction, setDeduction] = useState('')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(null) // null = follow the full refundable amount
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const deductionNum = Number(deduction) || 0
  const max = Math.max(0, +(acc.refundable - deductionNum).toFixed(2))
  const stillOwed = Math.max(0, +(acc.owed + deductionNum - acc.refundable).toFixed(2))
  const shown = amount === null ? max : amount
  const refundNum = Number(shown) || 0

  const submit = async () => {
    if (refundNum < 0 || refundNum > max) { setError(`You can refund up to ${formatCurrency(max)}.`); return }
    if (!refundNum && !deductionNum) { setError('Enter the amount to refund.'); return }
    setBusy(true); setError('')
    try {
      await bookingsApi.refund(booking.id, {
        amount: refundNum, deduction: deductionNum, reason: reason.trim() || undefined,
        method, reference: reference.trim() || undefined,
      })
      onRefunded(refundNum)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record the refund.')
      setBusy(false)
    }
  }

  const rows = [
    ['Security deposit left', acc.depositLeft],
    acc.credit > 0 && ['Rent paid in advance', acc.credit],
    acc.fromDeposit > 0 && ['Dues taken from deposit', -acc.fromDeposit],
    booking.refundAmount > 0 && ['Already refunded', -booking.refundAmount],
    deductionNum > 0 && [`Deduction${reason.trim() ? ` (${reason.trim()})` : ''}`, -deductionNum],
  ].filter(Boolean)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Refund · ${booking.guestName.split(',')[0]}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Later</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : refundNum > 0 ? `Record refund of ${formatCurrency(refundNum)}` : 'Save deduction'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-danger-bg text-danger-text text-sm px-3 py-2">{error}</div>}

        <div className="rounded-lg border border-line divide-y divide-line text-[13px]">
          {rows.map(([label, v]) => (
            <div key={label} className="flex justify-between gap-3 px-3 py-2">
              <span className="text-ink2 min-w-0 truncate">{label}</span>
              <span className="tabular-nums text-ink">{v < 0 ? `− ${formatCurrency(-v)}` : formatCurrency(v)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 px-3 py-2 font-semibold text-ink">
            <span>To refund</span><span className="tabular-nums">{formatCurrency(max)}</span>
          </div>
          {stillOwed > 0 && (
            <div className="flex justify-between gap-3 px-3 py-2 text-danger-text font-medium">
              <span>Tenant still owes</span><span className="tabular-nums">{formatCurrency(stillOwed)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Deduction (₹)" type="number" min="0" value={deduction} placeholder="0"
                 onChange={(e) => setDeduction(e.target.value)} hint="Damage, cleaning… billed to the tenant" />
          <Field label="Reason" value={reason} maxLength={80} placeholder="e.g. Broken cupboard"
                 onChange={(e) => setReason(e.target.value)} />
          <Field label="Refund now (₹)" type="number" min="0" value={shown}
                 onChange={(e) => setAmount(e.target.value)} hint="Anything less stays pending" />
          <Field label="Paid by" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} />
          <Field className="sm:col-span-2" label="Reference" value={reference} placeholder="UPI ref / cheque no."
                 onChange={(e) => setReference(e.target.value)} />
        </div>

        <p className="text-[12px] text-ink3 m-0">
          This records the refund. Pay the tenant by hand or transfer; the app doesn't send money.
        </p>
      </div>
    </Modal>
  )
}
