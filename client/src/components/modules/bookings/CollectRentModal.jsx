import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'

// Values go to the server; labels come from bookings:methods.<value>.
const METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque']

/**
 * A monthly tenancy's rent, collected on the booking itself: every month's
 * invoice (raised automatically), what is due now, and a payment that settles
 * the oldest months first — nothing about the tenant is entered again.
 */
export default function CollectRentModal({ booking, onClose, onCollected }) {
  const { t } = useTranslation('bookings')
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    bookingsApi.rentAccount(booking.id)
      .then(({ data }) => { setAccount(data); setAmount(data.due > 0 ? String(data.due) : '') })
      .catch((err) => setError(err.response?.data?.message || t('rent.loadError')))
    // t only feeds the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  const submit = async () => {
    if (!(Number(amount) > 0)) { setError(t('rent.enterAmount')); return }
    setBusy(true); setError('')
    try {
      const { data } = await bookingsApi.collectRent(booking.id, {
        amount: Number(amount), method, reference: reference.trim() || undefined,
      })
      onCollected(data.booking, Number(amount))
    } catch (err) {
      setError(err.response?.data?.message || t('rent.saveError'))
      setBusy(false)
    }
  }

  const open = account?.invoices.filter((i) => i.status !== 'Paid') || []
  const overdue = open.filter((i) => i.status === 'Overdue')
  const overdueAmt = overdue.reduce((n, i) => n + i.total - i.amountPaid, 0)
  const inHouse = booking.status === 'CheckedIn'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('rent.title', { name: booking.guestName.split(',')[0] })}
      footer={inHouse && (
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common:close')}</Button>
          <Button onClick={submit} disabled={busy || !account}>
            {busy ? t('common:saving') : t('rent.collect', { amount: amount ? formatCurrency(Number(amount)) : '' }).trim()}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink3 m-0">
          {t('roomN', { room: booking.roomNumber })}{booking.bed ? ` · ${t('bedN', { bed: booking.bed })}` : ''} · {formatCurrency(booking.roomRate)}{t('table.perMonth')}
          {account?.nextBillOn && ` · ${t('rent.nextBill', { date: formatDate(account.nextBillOn) })}`}
        </p>

        {error && <div className="rounded-lg bg-danger-bg text-danger-text text-sm px-3 py-2">{error}</div>}
        {!account && !error && <p className="text-sm text-ink3">{t('common:loading')}</p>}
        {overdue.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger-bg text-danger-text text-[13px] px-3 py-2">
            {t('rent.overdueBanner', { amount: formatCurrency(overdueAmt), count: overdue.length })}
          </div>
        )}

        {account && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                [t('rent.dueNow'), account.due, account.due > 0 ? 'text-warning-text' : 'text-ink'],
                [t('rent.credit'), account.credit, 'text-ink'],
                [t('rent.monthlyRent'), account.rent, 'text-ink'],
              ].map(([label, v, tone]) => (
                <div key={label} className="rounded-lg border border-line bg-surface2 px-2.5 sm:px-3 py-2 min-w-0">
                  <div className="text-xs text-ink3 truncate">{label}</div>
                  <div className={`text-[15px] sm:text-[16px] font-semibold tabular-nums truncate ${tone}`}>{formatCurrency(v)}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-ink2 mb-1.5">{t('rent.months')}</p>
              {account.invoices.length === 0 ? (
                <p className="text-xs text-ink3 m-0">{t('rent.noneBilled')}</p>
              ) : (
                <ul className="m-0 p-0 list-none rounded-lg border border-line divide-y divide-line max-h-56 overflow-auto">
                  {account.invoices.slice().reverse().map((i) => {
                    const left = i.total - i.amountPaid
                    return (
                      // Phones: period over invoice no. on the left, amount over status on
                      // the right. From sm the four sit on one line.
                      <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                        <span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-3">
                          <span className="block sm:flex-1 min-w-0 truncate text-ink">{i.period}</span>
                          <span className="block text-xs text-ink3 font-mono truncate">{i.invoiceNo}</span>
                        </span>
                        <span className="shrink-0 text-right sm:flex sm:items-center sm:gap-3">
                          <span className="block tabular-nums text-ink sm:w-20">{formatCurrency(i.total)}</span>
                          <span className={`block text-xs font-medium sm:w-24 ${
                            i.status === 'Paid' ? 'text-success-text' : i.status === 'Overdue' ? 'text-danger-text' : 'text-warning-text'}`}>
                            {i.status === 'Paid' ? t('common:paid')
                              : t(i.status === 'Overdue' ? 'rent.leftOverdue' : 'rent.leftDue', { amount: formatCurrency(left) })}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {inHouse ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={t('rent.amountReceived')} type="number" min="0" value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       hint={open.length ? t('rent.settlesOldest', { count: open.length }) : t('rent.keptAsCredit')} />
                <Field label={t('rent.method')} value={method} onChange={(e) => setMethod(e.target.value)}
                       options={METHODS.map((value) => ({ value, label: t(`methods.${value}`) }))} />
                <Field label={t('rent.reference')} value={reference} onChange={(e) => setReference(e.target.value)}
                       placeholder={t('rent.referencePlaceholder')} />
              </div>
            ) : (
              <p className="text-xs text-ink3 m-0">{t('rent.notCheckedIn')}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
