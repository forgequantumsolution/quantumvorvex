import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { bookingsApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { refundAccount } from '../../../utils/beds'

// Values go to the server; labels come from bookings:methods.<value>.
const METHODS = ['cash', 'upi', 'bank_transfer', 'cheque']

/**
 * Settle a tenant after move-out: dues come out of the security deposit, and the
 * deposit left plus any rent credit is refunded. This records the refund (Cash
 * Register, ledger, invoice); the money itself is paid by hand or transfer.
 */
export default function RefundModal({ booking, onClose, onRefunded }) {
  const { t } = useTranslation('bookings')
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
    if (refundNum < 0 || refundNum > max) { setError(t('refund.upTo', { amount: formatCurrency(max) })); return }
    if (!refundNum && !deductionNum) { setError(t('refund.enterAmount')); return }
    setBusy(true); setError('')
    try {
      await bookingsApi.refund(booking.id, {
        amount: refundNum, deduction: deductionNum, reason: reason.trim() || undefined,
        method, reference: reference.trim() || undefined,
      })
      onRefunded(refundNum)
    } catch (err) {
      setError(err.response?.data?.message || t('refund.saveError'))
      setBusy(false)
    }
  }

  const rows = [
    [t('refund.depositLeft'), acc.depositLeft],
    acc.credit > 0 && [t('refund.rentInAdvance'), acc.credit],
    acc.fromDeposit > 0 && [t('refund.fromDeposit'), -acc.fromDeposit],
    booking.refundAmount > 0 && [t('refund.alreadyRefunded'), -booking.refundAmount],
    deductionNum > 0 && [`${t('refund.deduction')}${reason.trim() ? ` (${reason.trim()})` : ''}`, -deductionNum],
  ].filter(Boolean)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('refund.title', { name: booking.guestName.split(',')[0] })}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('refund.later')}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t('common:saving') : refundNum > 0 ? t('refund.record', { amount: formatCurrency(refundNum) }) : t('refund.saveDeduction')}
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
            <span>{t('refund.toRefund')}</span><span className="tabular-nums">{formatCurrency(max)}</span>
          </div>
          {stillOwed > 0 && (
            <div className="flex justify-between gap-3 px-3 py-2 text-danger-text font-medium">
              <span>{t('refund.stillOwes')}</span><span className="tabular-nums">{formatCurrency(stillOwed)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('refund.deductionInr')} type="number" min="0" value={deduction} placeholder="0"
                 onChange={(e) => setDeduction(e.target.value)} hint={t('refund.deductionHint')} />
          <Field label={t('refund.reason')} value={reason} maxLength={80} placeholder={t('refund.reasonPlaceholder')}
                 onChange={(e) => setReason(e.target.value)} />
          <Field label={t('refund.refundNow')} type="number" min="0" value={shown}
                 onChange={(e) => setAmount(e.target.value)} hint={t('refund.refundNowHint')} />
          <Field label={t('refund.paidBy')} value={method} onChange={(e) => setMethod(e.target.value)}
                 options={METHODS.map((value) => ({ value, label: t(`methods.${value}`) }))} />
          <Field className="sm:col-span-2" label={t('rent.reference')} value={reference} placeholder={t('rent.referencePlaceholder')}
                 onChange={(e) => setReference(e.target.value)} />
        </div>

        <p className="text-[12px] text-ink3 m-0">
          {t('refund.footnote')}
        </p>
      </div>
    </Modal>
  )
}
