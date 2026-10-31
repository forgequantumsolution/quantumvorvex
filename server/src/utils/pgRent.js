/**
 * Monthly tenancy billing (PG beds and whole rooms let by the month).
 *
 * A monthly stay with no fixed number of months is a *tenancy*: booked once,
 * open-ended, billed one rent invoice per month (Billing module) instead of one
 * invoice for the whole stay. Staff collect each month's rent on the booking.
 * The booking keeps a running account of the tenancy:
 *   amount          rent billed so far (sum of its invoices)
 *   advance         all money received (advance at booking + collections)
 *   advanceApplied  the part of `advance` set against invoices; the rest is
 *                   credit that pays the next invoice
 *   rentBilledUntil end of the last billed month; the next cycle starts here
 *
 * Cycles run from the move-in day: moving in on the 31st bills 31 Oct–30 Nov,
 * then 30 Nov–30 Dec (day clamped to the month's length), and so on.
 */
import prisma from './prisma.js'

// Monthly and open-ended. Older monthly bookings with a fixed `months` term
// keep the one-invoice-per-stay model.
export const isTenancy = (b) => b?.stayType === 'monthly' && !b?.months

// Far end used as the "until" of an open-ended tenancy in overlap checks.
export const OPEN_END = new Date('9999-12-31T00:00:00.000Z')

// Same day-of-month `n` months on, clamped to the target month's last day.
export const addMonths = (date, n, day = new Date(date).getDate()) => {
  const d = new Date(date)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes())
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return target
}

const fmt = (d, withYear) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', ...(withYear && { year: 'numeric' }) })

// "31 Oct – 29 Nov 2026" — the last day of the cycle is the day before the next starts.
export const periodLabel = (start, end) =>
  `${fmt(start)} – ${fmt(new Date(end.getTime() - 86400000), true)}`

const round2 = (n) => +Number(n).toFixed(2)

// Running-account fields for a tenancy after its totals change.
export const tenancyTotals = ({ amount, advance }) => {
  const balance = round2(Math.max(0, amount - advance))
  return {
    amount: round2(amount),
    advance: round2(advance),
    balance,
    paymentStatus: amount <= 0 ? (advance > 0 ? 'partial' : 'unpaid') : balance <= 0 ? 'paid' : advance > 0 ? 'partial' : 'unpaid',
  }
}

// Next free Billing invoice number (INV-0001…). Probed rather than retried: a
// failed insert would abort the surrounding Postgres transaction.
const nextInvoiceNo = async (tx) => {
  let n = (await tx.invoice.count()) + 1
  const no = () => `INV-${String(n).padStart(4, '0')}`
  while (await tx.invoice.findFirst({ where: { invoiceNo: no() }, select: { id: true } })) n++
  return no()
}

/**
 * Create one invoice on a tenancy: `rent` is GST-inclusive (tax extracted, as in
 * the Billing module). Unapplied credit pays it down first. Returns the invoice
 * and writes the booking's running account. Runs inside `tx`.
 */
export const invoiceTenancy = async (tx, booking, { period, rent, cycleEnd }) => {
  const gstRate = booking.taxRate ?? 0
  const base = round2(rent / (1 + gstRate / 100))
  const gstAmount = round2(rent - base)
  const total = round2(rent)

  const credit = Math.max(0, round2(booking.advance - booking.advanceApplied))
  const applied = Math.min(credit, total)

  const invoice = await tx.invoice.create({
    data: {
      invoiceNo: await nextInvoiceNo(tx),
      guestId: booking.guestId,
      bookingId: booking.id,
      period,
      rent: total,
      gstRate,
      gstAmount,
      total,
      amountPaid: applied,
      status: applied >= total ? 'Paid' : 'Pending',
      paidAt: applied >= total ? new Date() : null,
    },
  })

  if (applied > 0) {
    await tx.payment.create({
      data: { guestId: booking.guestId, invoiceId: invoice.id, amount: applied, method: 'advance', type: 'advance' },
    })
  }

  const amount = booking.amount + total
  Object.assign(booking, {
    ...tenancyTotals({ amount, advance: booking.advance }),
    advanceApplied: round2(booking.advanceApplied + applied),
    ...(cycleEnd && { rentBilledUntil: cycleEnd }),
  })
  await tx.booking.update({
    where: { id: booking.id },
    data: {
      amount: booking.amount, balance: booking.balance, paymentStatus: booking.paymentStatus,
      advanceApplied: booking.advanceApplied,
      ...(cycleEnd && { rentBilledUntil: cycleEnd }),
    },
  })
  return invoice
}

/**
 * Bill every rent cycle of a checked-in tenancy that has started by `now`
 * (catching up missed months). Idempotent: rentBilledUntil only moves forward.
 * Returns the invoices created.
 */
export const billDueRent = async (tx, booking, now = new Date()) => {
  if (!isTenancy(booking) || booking.status !== 'CheckedIn' || !booking.rentBilledUntil || !booking.guestId) return []
  const anchorDay = new Date(booking.checkedInAt || booking.fromDate).getDate()
  const created = []
  while (booking.rentBilledUntil <= now && created.length < 24) {
    const start = new Date(booking.rentBilledUntil)
    const end = addMonths(start, 1, anchorDay)
    created.push(await invoiceTenancy(tx, booking, {
      period: periodLabel(start, end),
      rent: booking.roomRate,
      cycleEnd: end,
    }))
  }
  return created
}

/**
 * Spread a payment over a tenancy's unpaid invoices, oldest first, recording a
 * Payment per invoice. Anything left over stays on the booking as credit for
 * the next month. Returns the amount applied to invoices.
 */
export const payTenancyInvoices = async (tx, booking, amount, method = 'cash', reference = null) => {
  let left = round2(amount)
  const open = await tx.invoice.findMany({
    where: { bookingId: booking.id, status: { not: 'Paid' }, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  for (const inv of open) {
    if (left <= 0) break
    const pay = Math.min(left, round2(inv.total - inv.amountPaid))
    if (pay <= 0) continue
    const paid = round2(inv.amountPaid + pay)
    await tx.invoice.update({
      where: { id: inv.id },
      data: { amountPaid: paid, ...(paid >= inv.total && { status: 'Paid', paidAt: new Date() }) },
    })
    await tx.payment.create({
      data: { guestId: booking.guestId, invoiceId: inv.id, amount: pay, method, reference, type: 'collection' },
    })
    left = round2(left - pay)
  }
  return round2(amount - left)
}

/**
 * Rent left unpaid past the property's grace period (Settings → grace period,
 * days after the month is billed) becomes Overdue, with one notification per
 * invoice when it turns. Returns how many turned overdue.
 */
export const markOverdueRent = async (now = new Date()) => {
  const hotel = await prisma.hotel.findFirst({ select: { gracePeriod: true } })
  const graceDays = hotel?.gracePeriod ?? 3
  const cutoff = new Date(now.getTime() - graceDays * 86400000)
  const late = await prisma.invoice.findMany({
    where: { bookingId: { not: null }, status: 'Pending', deletedAt: null, createdAt: { lt: cutoff } },
    include: { booking: { select: { bookingNo: true, guestName: true, room: { select: { number: true } } } } },
  })
  for (const inv of late) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'Overdue' } })
    const due = round2(inv.total - inv.amountPaid)
    await prisma.notification.create({
      data: {
        type: 'alert',
        message: `Rent overdue: ${inv.booking.guestName.split(',')[0]} (Room ${inv.booking.room?.number || '—'}, ${inv.booking.bookingNo}) — ₹${due} for ${inv.period}.`,
      },
    })
  }
  return late.length
}

// Daily job body for one property (run inside its property context).
export const runRentBilling = async (now = new Date()) => {
  const due = await prisma.booking.findMany({
    where: {
      stayType: 'monthly', months: null, status: 'CheckedIn', deletedAt: null,
      rentBilledUntil: { lte: now },
    },
  })
  let count = 0
  for (const b of due) {
    count += (await prisma.$transaction((tx) => billDueRent(tx, b, now))).length
  }
  await markOverdueRent(now)
  return count
}
