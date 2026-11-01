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
 * Rent follows calendar months. Moving in on 25 Oct bills 25–31 Oct by the day
 * (7/31 of the rent), then every month from the 1st in full. A tenancy whose
 * rentBilledUntil is mid-month (billed before this rule) lines up the same way.
 * Moving out mid-month cuts that month's invoice to the days stayed; anything
 * already paid above that stays on the booking as credit to refund. After
 * move-out, dues come out of the security deposit and the rest is refunded.
 */
import prisma from './prisma.js'

// Monthly and open-ended. Older monthly bookings with a fixed `months` term
// keep the one-invoice-per-stay model.
export const isTenancy = (b) => b?.stayType === 'monthly' && !b?.months

// Far end used as the "until" of an open-ended tenancy in overlap checks.
export const OPEN_END = new Date('9999-12-31T00:00:00.000Z')

// The day rent starts: always the booking's move-in date, whenever check-in is clicked.
export const rentStartDay = (fromDate) => {
  const start = new Date(fromDate)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate())
}

// One rent period: from `from` to the end of its calendar month. A period
// starting on the 1st is a full month; any other is charged by the day.
export const rentPeriod = (from, monthlyRent) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const inMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const days = inMonth - start.getDate() + 1
  return {
    end,
    rent: days === inMonth ? monthlyRent : round2((monthlyRent * days) / inMonth),
    period: days === inMonth ? periodLabel(start, end) : `${periodLabel(start, end)} (${days} of ${inMonth} days)`,
  }
}

const round2 = (n) => +Number(n).toFixed(2)

const fmt = (d, withYear) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', ...(withYear && { year: 'numeric' }) })

// "31 Oct – 29 Nov 2026" — the last day of the cycle is the day before the next starts.
export const periodLabel = (start, end) =>
  `${fmt(start)} – ${fmt(new Date(end.getTime() - 86400000), true)}`

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
 * Bill every rent period of a checked-in tenancy that has started by `now`
 * (catching up missed months). Idempotent: rentBilledUntil only moves forward.
 * Returns the invoices created.
 */
export const billDueRent = async (tx, booking, now = new Date()) => {
  if (!isTenancy(booking) || booking.status !== 'CheckedIn' || !booking.rentBilledUntil || !booking.guestId) return []
  const created = []
  while (booking.rentBilledUntil <= now && created.length < 24) {
    const { period, rent, end } = rentPeriod(new Date(booking.rentBilledUntil), booking.roomRate)
    created.push(await invoiceTenancy(tx, booking, { period, rent, cycleEnd: end }))
  }
  return created
}

// The part of the current rent period used by a tenant leaving on `now`, or null
// when the whole period is used (or it's an old mid-month cycle, left as billed).
const moveOutCut = (booking, now) => {
  const end = new Date(booking.rentBilledUntil)
  if (!booking.rentBilledUntil || end <= now || end.getDate() !== 1) return null
  const first = new Date(end.getFullYear(), end.getMonth() - 1, 1)
  const moveIn = rentStartDay(booking.fromDate)
  const start = moveIn > first ? moveIn : first
  const inMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const days = inMonth - start.getDate() + 1
  // Days from the start of rent to today, at least one if they leave before it starts.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const used = Math.max(1, Math.round((today - start) / 86400000) + 1)
  if (used >= days) return null
  const lastDayEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + used)
  return {
    used,
    days,
    billedAs: periodLabel(start, end),
    period: `${periodLabel(start, lastDayEnd)} (${used} of ${inMonth} days)`,
  }
}

/**
 * Cut the current month's invoice to the days stayed when a tenant moves out.
 * Updates `booking` in memory (amount, advanceApplied); the caller saves it.
 * Runs inside `tx`, after billDueRent.
 */
export const settleMoveOutRent = async (tx, booking, now = new Date()) => {
  const cut = moveOutCut(booking, now)
  if (!cut) return null
  const inv = await tx.invoice.findFirst({
    where: { bookingId: booking.id, deletedAt: null, period: { startsWith: cut.billedAs } },
    orderBy: { createdAt: 'desc' },
  })
  if (!inv) return null
  const total = round2((inv.total * cut.used) / cut.days)
  const base = round2(total / (1 + (inv.gstRate || 0) / 100))
  const paid = Math.min(inv.amountPaid, total)
  const updated = await tx.invoice.update({
    where: { id: inv.id },
    data: {
      period: cut.period,
      rent: total,
      gstAmount: round2(total - base),
      total,
      amountPaid: paid,
      ...(paid >= total && { status: 'Paid', paidAt: inv.paidAt ?? now }),
    },
  })
  booking.amount = round2(booking.amount - (inv.total - total))
  booking.advanceApplied = round2(booking.advanceApplied - (inv.amountPaid - paid))
  return updated
}

// What a move-out on `now` would leave on the account, without writing anything:
// rent to date, what is still due, and any credit to refund.
export const moveOutPreview = (booking, invoices, now = new Date()) => {
  let amount = booking.amount
  let rentBilledUntil = booking.rentBilledUntil
  let lastTotal = null
  while (rentBilledUntil && new Date(rentBilledUntil) <= now) {
    const { rent, end } = rentPeriod(new Date(rentBilledUntil), booking.roomRate)
    amount = round2(amount + rent)
    lastTotal = rent
    rentBilledUntil = end
  }
  const cut = moveOutCut({ ...booking, rentBilledUntil }, now)
  const billed = cut && (lastTotal ?? invoices.find((i) => i.period.startsWith(cut.billedAs))?.total)
  if (billed) amount = round2(amount - (billed - round2((billed * cut.used) / cut.days)))
  return {
    amount,
    due: tenancyTotals({ amount, advance: booking.advance }).balance,
    credit: Math.max(0, round2(booking.advance - amount)),
  }
}

/**
 * Spread a payment over a tenancy's unpaid invoices, oldest first, recording a
 * Payment per invoice. Anything left over stays on the booking as credit for
 * the next month. Returns the amount applied to invoices.
 */
export const payTenancyInvoices = async (tx, booking, amount, method = 'cash', reference = null, logPayment = true) => {
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
    if (logPayment) {
      await tx.payment.create({
        data: { guestId: booking.guestId, invoiceId: inv.id, amount: pay, method, reference, type: 'collection' },
      })
    }
    left = round2(left - pay)
  }
  return round2(amount - left)
}

// Bookings settled with a refund: tenancies, and any stay holding a deposit.
export const canRefund = (b) => isTenancy(b) || b.securityDeposit > 0

// A checked-out booking's settlement (mirrored in client utils/beds.js): dues come
// out of the deposit first, and what's left plus any rent credit can be refunded.
export const refundAccount = (b) => {
  const depositLeft = round2(b.securityDeposit - b.depositUsed)
  const credit = Math.max(0, round2(b.advance - b.amount))
  const due = Math.max(0, round2(b.amount - b.advance))
  const fromDeposit = Math.min(depositLeft, due)
  return {
    depositLeft,
    credit,
    due,
    fromDeposit,
    owed: round2(due - fromDeposit),
    refundable: Math.max(0, round2(depositLeft + credit - fromDeposit - b.refundAmount)),
  }
}

/**
 * Settle a checked-out booking: raise any deduction (damage, cleaning…) as a bill,
 * take dues from the deposit, and record the money handed back as a refund Payment.
 * The deposit was logged as received at check-in, so using it moves no cash and
 * logs no Payment. Throws { refundError } when `amount` is more than is left.
 * Runs inside `tx`; returns the updated booking fields.
 */
export const settleRefund = async (tx, booking, { amount = 0, deduction = 0, reason, method = 'cash', reference = null }) => {
  const b = { ...booking }
  const tenancy = isTenancy(b)
  if (deduction > 0) {
    if (tenancy) await invoiceTenancy(tx, b, { period: reason ? `Deduction — ${reason}` : 'Deduction', rent: deduction })
    else b.amount = round2(b.amount + deduction)
  }
  const { fromDeposit } = refundAccount(b)
  if (fromDeposit > 0) {
    const applied = tenancy ? await payTenancyInvoices(tx, b, fromDeposit, 'deposit', null, false) : 0
    b.advance = round2(b.advance + fromDeposit)
    b.advanceApplied = round2(b.advanceApplied + applied)
    b.depositUsed = round2(b.depositUsed + fromDeposit)
  }
  const { refundable } = refundAccount(b)
  if (amount > refundable) throw Object.assign(new Error('refund too high'), { refundError: `Only ₹${refundable} can be refunded.` })
  if (amount > 0) {
    await tx.payment.create({ data: { guestId: b.guestId, amount, method, reference, type: 'refund' } })
    b.refundAmount = round2(b.refundAmount + amount)
    b.refundedAt = new Date()
  }
  return {
    amount: b.amount,
    advance: b.advance,
    advanceApplied: b.advanceApplied,
    depositUsed: b.depositUsed,
    refundAmount: b.refundAmount,
    refundedAt: b.refundedAt,
    ...tenancyTotals({ amount: b.amount, advance: b.advance }),
  }
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
