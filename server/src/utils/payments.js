/**
 * Recording money received against a booking or a billing invoice — the one
 * place the staff "collect" actions and confirmed UPI claims share, so the
 * booking totals, rent invoices and Payment ledger stay consistent.
 * Every function takes the transaction client `tx`.
 */
import { isTenancy, tenancyTotals, payTenancyInvoices } from './pgRent.js'

const round2 = (n) => +Number(n).toFixed(2)

// Money in on a booking. A PG tenancy settles its open rent invoices oldest first
// and keeps the rest as credit (as collectRent always has); any other stay adds
// to the amount received. A Payment row is logged once the booking has a guest
// (before check-in the advance lives on the booking alone, as when it's typed in).
// → { booking, paymentId } (paymentId: the last Payment row created, or null)
export const recordBookingPayment = async (tx, booking, { amount, method = 'cash', reference = null, include } = {}) => {
  amount = round2(amount)
  let paymentId = null
  let data
  if (isTenancy(booking)) {
    let applied = 0
    if (booking.guestId) {
      applied = await payTenancyInvoices(tx, booking, amount, method, reference)
      if (amount > applied) {
        paymentId = (await tx.payment.create({
          data: { guestId: booking.guestId, amount: round2(amount - applied), method, reference, type: 'advance' },
        })).id
      } else if (applied > 0) {
        paymentId = (await tx.payment.findFirst({
          where: { guestId: booking.guestId, reference, method }, orderBy: { createdAt: 'desc' }, select: { id: true },
        }))?.id || null
      }
    }
    data = {
      advanceApplied: round2(booking.advanceApplied + applied),
      ...tenancyTotals({ amount: booking.amount, advance: booking.advance + amount }),
    }
  } else {
    const advance = round2(booking.advance + amount)
    data = {
      advance,
      balance: round2(booking.amount - advance),
      paymentStatus: advance <= 0 ? 'unpaid' : advance >= booking.amount ? 'paid' : 'partial',
    }
    if (booking.guestId) {
      paymentId = (await tx.payment.create({
        data: { guestId: booking.guestId, amount, method, reference, type: 'collection' },
      })).id
    }
  }
  const updated = await tx.booking.update({ where: { id: booking.id }, data, ...(include && { include }) })
  return { booking: updated, paymentId }
}

// Money in on a billing invoice: amount (default: all that's left) is added to
// amountPaid, which marks it Paid once covered. A PG rent invoice also settles
// that much of its tenancy's running account. logStandalone: whether to log a
// Payment row for an invoice with no booking (the desk "collect" button never has).
// → { invoice, paymentId, collected }
export const recordInvoicePayment = async (tx, invoice, { amount, method = 'cash', reference = null, logStandalone = true } = {}) => {
  const left = round2(invoice.total - (invoice.amountPaid || 0))
  const collected = Math.max(0, Math.min(round2(amount ?? left), left))
  const paid = round2((invoice.amountPaid || 0) + collected)
  const updated = await tx.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: paid, ...(paid >= invoice.total && { status: 'Paid', paidAt: invoice.paidAt || new Date() }) },
  })

  let paymentId = null
  if (collected > 0) {
    const booking = invoice.bookingId ? await tx.booking.findUnique({ where: { id: invoice.bookingId } }) : null
    if (booking || logStandalone) {
      paymentId = (await tx.payment.create({
        data: { guestId: invoice.guestId, invoiceId: invoice.id, amount: collected, method, reference, type: 'collection' },
      })).id
    }
    if (booking) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          advanceApplied: round2(booking.advanceApplied + collected),
          ...tenancyTotals({ amount: booking.amount, advance: booking.advance + collected }),
        },
      })
    }
  }
  return { invoice: updated, paymentId, collected }
}
