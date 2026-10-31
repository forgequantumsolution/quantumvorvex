import { useEffect, useState } from 'react'
import Modal from '../../ui/Modal'
import { Button, Field } from '../../ui-tw'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
]

/**
 * A monthly tenancy's rent, collected on the booking itself: every month's
 * invoice (raised automatically), what is due now, and a payment that settles
 * the oldest months first — nothing about the tenant is entered again.
 */
export default function CollectRentModal({ booking, onClose, onCollected }) {
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    bookingsApi.rentAccount(booking.id)
      .then(({ data }) => { setAccount(data); setAmount(data.due > 0 ? String(data.due) : '') })
      .catch((err) => setError(err.response?.data?.message || 'Could not load the rent account.'))
  }, [booking.id])

  const submit = async () => {
    if (!(Number(amount) > 0)) { setError('Enter the amount received.'); return }
    setBusy(true); setError('')
    try {
      const { data } = await bookingsApi.collectRent(booking.id, {
        amount: Number(amount), method, reference: reference.trim() || undefined,
      })
      onCollected(data.booking, Number(amount))
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record the payment.')
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
      title={`Rent · ${booking.guestName.split(',')[0]}`}
      footer={inHouse && (
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={submit} disabled={busy || !account}>
            {busy ? 'Saving…' : `Collect ${amount ? formatCurrency(Number(amount)) : ''}`}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink3 m-0">
          Room {booking.roomNumber}{booking.bed ? ` · Bed ${booking.bed}` : ''} · {formatCurrency(booking.roomRate)}/month
          {account?.nextBillOn && ` · next month billed on ${formatDate(account.nextBillOn)}`}
        </p>

        {error && <div className="rounded-lg bg-danger-bg text-danger-text text-sm px-3 py-2">{error}</div>}
        {!account && !error && <p className="text-sm text-ink3">Loading…</p>}
        {overdue.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger-bg text-danger-text text-[12.5px] px-3 py-2">
            {formatCurrency(overdueAmt)} overdue — {overdue.length} month{overdue.length === 1 ? '' : 's'} unpaid past the grace period.
          </div>
        )}

        {account && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Due now', account.due, account.due > 0 ? 'text-warning-text' : 'text-ink'],
                ['Credit', account.credit, 'text-ink'],
                ['Monthly rent', account.rent, 'text-ink'],
              ].map(([label, v, tone]) => (
                <div key={label} className="rounded-lg border border-line bg-surface2 px-3 py-2">
                  <div className="text-[11px] text-ink3">{label}</div>
                  <div className={`text-[16px] font-semibold tabular-nums ${tone}`}>{formatCurrency(v)}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-ink2 mb-1.5">Months</p>
              {account.invoices.length === 0 ? (
                <p className="text-[12px] text-ink3 m-0">No rent billed yet — the first month is billed at check-in.</p>
              ) : (
                <ul className="m-0 p-0 list-none rounded-lg border border-line divide-y divide-line max-h-56 overflow-auto">
                  {account.invoices.slice().reverse().map((i) => {
                    const left = i.total - i.amountPaid
                    return (
                      <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                        <span className="flex-1 min-w-0 truncate text-ink">{i.period}</span>
                        <span className="text-[11px] text-ink3 font-mono">{i.invoiceNo}</span>
                        <span className="tabular-nums text-ink w-20 text-right">{formatCurrency(i.total)}</span>
                        <span className={`text-[11px] font-medium w-24 text-right ${
                          i.status === 'Paid' ? 'text-success-text' : i.status === 'Overdue' ? 'text-danger-text' : 'text-warning-text'}`}>
                          {i.status === 'Paid' ? 'Paid' : `${formatCurrency(left)} ${i.status === 'Overdue' ? 'overdue' : 'due'}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {inHouse ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Amount received (₹)" type="number" min="0" value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       hint={open.length ? `Settles the oldest ${open.length === 1 ? 'month' : 'months'} first` : 'Kept as credit for next month'} />
                <Field label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} />
                <Field label="Reference" value={reference} onChange={(e) => setReference(e.target.value)}
                       placeholder="UPI ref / cheque no." />
              </div>
            ) : (
              <p className="text-[12px] text-ink3 m-0">Rent can be collected once the tenant is checked in.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
