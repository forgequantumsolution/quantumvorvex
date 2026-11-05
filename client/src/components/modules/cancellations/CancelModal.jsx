import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Field, Button } from '../../ui-tw'
import { formatCurrency } from '../../../utils/format'
import { balance, dateRangeLabel } from '../../../utils/booking'

// The reason is saved on the booking as typed here, so the stored value stays in
// English (one consistent history); only the dropdown label is translated.
const REASONS = [
  { value: 'Guest changed travel plans', key: 'changedPlans' },
  { value: 'Found alternative accommodation', key: 'alternative' },
  { value: 'Booked by mistake', key: 'mistake' },
  { value: 'Payment not completed', key: 'payment' },
  { value: 'No-show', key: 'noShow' },
  { value: 'Other', key: 'other' },
]

/**
 * Cancel-a-booking dialog. Works in two modes:
 *  - fixed:  pass `booking` → confirm cancelling that specific booking.
 *  - picker: pass `bookings` (list of cancellable ones) → user selects one.
 * Calls onConfirm({ id, reason }).
 */
export default function CancelModal({ isOpen, onClose, booking, bookings = [], onConfirm }) {
  const { t } = useTranslation('cancellations')
  const isPicker = !booking
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState(REASONS[0].value)
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
    setReason(REASONS[0].value)
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleConfirm = () => {
    if (!target) {
      setError(t('modal.select'))
      return
    }
    onConfirm({ id: target.id, reason })
    reset()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('modal.title')}
      subtitle={booking ? `${booking.bookingNo} · ${booking.guestName}` : t('modal.select')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>{t('modal.keep')}</Button>
          <Button variant="danger" onClick={handleConfirm} icon="✕">{t('modal.confirm')}</Button>
        </>
      }
    >
      {isPicker && (
        <Field
          label={t('modal.booking')}
          value={target?.id || ''}
          onChange={(e) => setSelectedId(e.target.value)}
          options={bookings.map((b) => ({ value: b.id, label: `${b.bookingNo} · ${b.guestName} · ${t('modal.roomN', { room: b.roomNumber || b.room })}` }))}
          error={error}
          className="mb-4"
        />
      )}

      {target && (
        <div className="rounded-lg bg-surface2 border border-line px-4 py-3 mb-4 text-sm space-y-1.5">
          <Row label={t('common:guest')} value={target.guestName} />
          <Row label={t('common:room')} value={`${target.roomNumber || target.room} · ${target.roomType}`} />
          <Row label={t('modal.stay')} value={dateRangeLabel(target)} />
          <Row label={t('modal.outstanding')} value={formatCurrency(balance(target))} />
        </div>
      )}

      <Field label={t('modal.reason')} value={reason} onChange={(e) => setReason(e.target.value)}
             options={REASONS.map((r) => ({ value: r.value, label: t(`reasons.${r.key}`) }))} />

      <p className="mt-4 text-[12.5px] text-danger-text bg-danger-bg border border-danger/30 rounded-lg px-3 py-2">
        {t('modal.warning')}
      </p>
    </Modal>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink3 shrink-0">{label}</span>
      <span className="text-ink font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  )
}
