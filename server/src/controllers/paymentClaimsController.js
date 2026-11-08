/**
 * Pay-by-UPI for guests, no gateway: the public pay page (amount due + the
 * property's QR) and the guest's "I've paid" report (UTR), then staff confirm it
 * against their UPI app, which records the payment like a desk collection.
 *
 * Public links: kind 'b' = a booking token, 'i' = a billing-invoice token
 * (the same signed tokens as the /invoice?b= / ?t= share links).
 */
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { runUnscoped, runWithProperty } from '../utils/propertyContext.js'
import { verifyBookingToken, verifyInvoiceToken, signBookingToken, signInvoiceToken, clientOrigin } from '../utils/invoiceLink.js'
import { hotelLogo, inlineUploadAsset, uploadedQr } from '../utils/invoiceTemplate.js'
import { isUpiId } from '../utils/upi.js'
import { recordBookingPayment, recordInvoicePayment } from '../utils/payments.js'

const round2 = (n) => +Number(n).toFixed(2)
const INVOICE_STATUSES = ['Confirmed', 'CheckedIn', 'CheckedOut'] // a booking with an invoice

const status = (due, paid) => (due <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid')

// One booking / invoice reduced to what the pay page and claims list need.
const bookingRef = (b) => {
  const due = Math.max(0, round2(b.balance))
  return {
    kind: 'booking', id: b.id, invoiceNo: b.invoiceNo || b.bookingNo, bookingNo: b.bookingNo,
    guestName: b.guestName, guestPhone: b.guestPhone || null, guestId: b.guestId || null,
    total: round2(b.amount), paid: round2(b.advance), due, bookingId: b.id,
  }
}
const invoiceRef = (inv) => {
  const due = Math.max(0, round2(inv.total - (inv.amountPaid || 0)))
  return {
    kind: 'invoice', id: inv.id, invoiceNo: inv.invoiceNo,
    guestName: inv.guest?.name || null, guestPhone: inv.guest?.phone || null, guestId: inv.guestId,
    total: round2(inv.total), paid: round2(inv.amountPaid || 0), due, invoiceId: inv.id, bookingId: inv.bookingId || null,
  }
}

// Inside the current property context: the live ref, or null.
const loadRef = async (kind, id) => {
  if (kind === 'booking') {
    const b = await prisma.booking.findUnique({ where: { id } })
    return b && !b.deletedAt && INVOICE_STATUSES.includes(b.status) ? bookingRef(b) : null
  }
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { guest: { select: { name: true, phone: true } } } })
  return inv && !inv.deletedAt ? invoiceRef(inv) : null
}

// :kind/:token → { kind, id, propertyId } or null. The token is verified first;
// the row is then located unscoped only to learn its property.
const resolveToken = async (kindParam, token) => {
  const kind = kindParam === 'b' ? 'booking' : kindParam === 'i' ? 'invoice' : null
  if (!kind) return null
  const id = kind === 'booking' ? verifyBookingToken(token) : verifyInvoiceToken(token)
  if (!id) return null
  const found = await runUnscoped(() => kind === 'booking'
    ? prisma.booking.findUnique({ where: { id }, select: { propertyId: true } })
    : prisma.invoice.findUnique({ where: { id }, select: { propertyId: true } }))
  return found ? { kind, id, propertyId: found.propertyId } : null
}

// The guest's link for a ref: the pay/invoice page (shows "Paid" once settled).
export const shareUrlFor = (req, hotel, kind, id) => kind === 'booking'
  ? `${clientOrigin(req, hotel)}/invoice?b=${encodeURIComponent(signBookingToken(id))}`
  : `${clientOrigin(req, hotel)}/invoice?t=${encodeURIComponent(signInvoiceToken(id))}`

const notFound = (res) => res.status(404).json({ message: 'Invoice not found.', code: 'ERR_NOT_FOUND' })

// ── Public (no auth) ──────────────────────────────────────────────────────────

// GET /public/pay/:kind/:token — only what the invoice itself shows: no phone, ID or notes.
export const getPayPage = async (req, res) => {
  try {
    const t = await resolveToken(req.params.kind, req.params.token)
    if (!t) return notFound(res)
    const data = await runWithProperty(t.propertyId, async () => {
      const ref = await loadRef(t.kind, t.id)
      if (!ref) return null
      const [hotel, pending] = await Promise.all([
        prisma.hotel.findFirst(),
        prisma.paymentClaim.findFirst({
          where: { kind: t.kind, refId: t.id, status: 'pending' },
          select: { amount: true, utr: true, createdAt: true },
        }),
      ])
      return { ref, hotel, pending }
    })
    if (!data) return notFound(res)
    const { ref, hotel, pending } = data
    return res.status(200).json({
      kind: t.kind,
      invoiceNo: ref.invoiceNo,
      guestName: ref.guestName,
      total: ref.total,
      paid: ref.paid,
      due: ref.due,
      status: status(ref.due, ref.paid),
      hotel: {
        name: hotel?.name || '',
        logoUrl: inlineUploadAsset(hotelLogo(hotel)) || null,
        upi: isUpiId(hotel?.upiId) ? { id: hotel.upiId.trim(), name: hotel.upiName || hotel.name } : null,
        qrImage: uploadedQr(hotel),
      },
      // The full printable invoice (booking): relative API path; ?format=pdf for the PDF.
      invoiceUrl: t.kind === 'booking' ? `/api/v1/public/booking-invoice/${encodeURIComponent(req.params.token)}` : null,
      pendingClaim: pending || null,
    })
  } catch (err) {
    logger.error('getPayPage error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /public/pay/:kind/:token/claim { utr, amount, payerName? } — the guest
// reports a UPI payment. One pending claim per booking/invoice: a repeat report
// updates it.
export const submitClaim = async (req, res) => {
  try {
    const utr = String(req.body?.utr ?? '').replace(/\s+/g, '')
    const amount = round2(Number(req.body?.amount))
    const payerName = String(req.body?.payerName ?? '').trim().slice(0, 80) || null
    if (!/^[A-Za-z0-9]{6,30}$/.test(utr)) {
      return res.status(400).json({ message: 'Enter the UPI transaction ID (UTR) — 6 to 30 letters or digits.', code: 'ERR_VALIDATION' })
    }
    if (!(amount > 0)) return res.status(400).json({ message: 'Enter the amount you paid.', code: 'ERR_VALIDATION' })

    const t = await resolveToken(req.params.kind, req.params.token)
    if (!t) return notFound(res)
    const result = await runWithProperty(t.propertyId, async () => {
      const ref = await loadRef(t.kind, t.id)
      if (!ref) return { code: 404 }
      if (ref.due <= 0) return { code: 400, message: 'This invoice is already paid.' }
      if (amount > ref.due + 1) return { code: 400, message: `The amount due is ₹${ref.due}.` }

      const data = { guestName: ref.guestName, amount, utr: utr.toUpperCase(), payerName }
      const pending = await prisma.paymentClaim.findFirst({ where: { kind: t.kind, refId: t.id, status: 'pending' }, select: { id: true } })
      if (pending) await prisma.paymentClaim.update({ where: { id: pending.id }, data: { ...data, createdAt: new Date() } })
      else await prisma.paymentClaim.create({ data: { kind: t.kind, refId: t.id, ...data } })

      const who = ref.guestName || payerName || 'a guest'
      await prisma.notification.create({
        data: { type: 'payment', message: `₹${amount.toLocaleString('en-IN')} UPI payment reported by ${who} for ${ref.invoiceNo} — UTR ${data.utr}. Check your UPI app and confirm in Billing.` },
      })
      return { code: 200 }
    })
    if (result.code === 404) return notFound(res)
    if (result.code === 400) return res.status(400).json({ message: result.message, code: 'ERR_VALIDATION' })
    logger.info('UPI payment claimed', { event: 'PAYMENT', kind: t.kind, refId: t.id, amount })
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error('submitClaim error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// ── Staff (auth, billing permission) ──────────────────────────────────────────

// GET /payment-claims?status=pending → { claims: [{ ...claim, ref }], counts: { pending } }
export const listClaims = async (req, res) => {
  try {
    const where = ['pending', 'confirmed', 'rejected'].includes(req.query.status) ? { status: req.query.status } : {}
    const [rows, pending] = await Promise.all([
      prisma.paymentClaim.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.paymentClaim.count({ where: { status: 'pending' } }),
    ])
    const byKind = (k) => rows.filter((c) => c.kind === k).map((c) => c.refId)
    const [bookings, invoices] = await Promise.all([
      prisma.booking.findMany({ where: { id: { in: byKind('booking') } } }),
      prisma.invoice.findMany({ where: { id: { in: byKind('invoice') } }, include: { guest: { select: { name: true, phone: true } } } }),
    ])
    const refs = new Map([...bookings.map((b) => [b.id, bookingRef(b)]), ...invoices.map((i) => [i.id, invoiceRef(i)])])
    const claims = rows.map((c) => {
      const r = refs.get(c.refId)
      return {
        ...c,
        ref: r ? {
          invoiceNo: r.invoiceNo, ...(r.bookingNo && { bookingNo: r.bookingNo }),
          guestName: r.guestName, guestPhone: r.guestPhone, guestId: r.guestId, due: r.due,
          bookingId: r.bookingId || null, invoiceId: r.invoiceId || null,
        } : null,
      }
    })
    return res.status(200).json({ claims, counts: { pending } })
  } catch (err) {
    logger.error('listClaims error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /payment-claims/:id/confirm { amount? } — staff saw the money in their UPI
// app: record it as a UPI payment (reference = UTR). → { claim, shareUrl }
export const confirmClaim = async (req, res) => {
  try {
    const claim = await prisma.paymentClaim.findUnique({ where: { id: req.params.id } })
    if (!claim) return res.status(404).json({ message: 'Payment claim not found.' })
    if (claim.status !== 'pending') return res.status(409).json({ message: `This claim is already ${claim.status}.`, code: 'ERR_CONFLICT' })
    const amount = round2(req.body?.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) : claim.amount)
    if (!(amount > 0)) return res.status(400).json({ message: 'Enter the amount received.', code: 'ERR_VALIDATION' })

    const updated = await prisma.$transaction(async (tx) => {
      // Claim it first so two staff confirming at once can't record it twice.
      const { count } = await tx.paymentClaim.updateMany({
        where: { id: claim.id, status: 'pending' },
        data: { status: 'confirmed', amount, reviewedAt: new Date(), reviewedById: req.user?.userId || null },
      })
      if (!count) throw Object.assign(new Error('conflict'), { conflict: true })

      const pay = { amount, method: 'upi', reference: claim.utr }
      let paymentId = null
      if (claim.kind === 'booking') {
        const booking = await tx.booking.findUnique({ where: { id: claim.refId } })
        if (!booking || booking.deletedAt) throw Object.assign(new Error('gone'), { gone: true })
        ;({ paymentId } = await recordBookingPayment(tx, booking, pay))
      } else {
        const invoice = await tx.invoice.findUnique({ where: { id: claim.refId } })
        if (!invoice || invoice.deletedAt) throw Object.assign(new Error('gone'), { gone: true })
        ;({ paymentId } = await recordInvoicePayment(tx, invoice, pay))
      }
      return tx.paymentClaim.update({ where: { id: claim.id }, data: { paymentId } })
    })

    const hotel = await prisma.hotel.findFirst({ select: { publicUrl: true } })
    logger.info('UPI claim confirmed', { event: 'PAYMENT', claimId: claim.id, amount })
    return res.status(200).json({ claim: updated, shareUrl: shareUrlFor(req, hotel, claim.kind, claim.refId) })
  } catch (err) {
    if (err.conflict) return res.status(409).json({ message: 'This claim was already reviewed.', code: 'ERR_CONFLICT' })
    if (err.gone) return res.status(404).json({ message: 'The booking or invoice no longer exists.' })
    logger.error('confirmClaim error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /payment-claims/:id/reject { reason? } — not found in the UPI app.
export const rejectClaim = async (req, res) => {
  try {
    const reason = String(req.body?.reason ?? '').trim().slice(0, 200) || null
    const { count } = await prisma.paymentClaim.updateMany({
      where: { id: req.params.id, status: 'pending' },
      data: { status: 'rejected', reviewedAt: new Date(), reviewedById: req.user?.userId || null, ...(reason && { note: reason }) },
    })
    if (!count) {
      const exists = await prisma.paymentClaim.findUnique({ where: { id: req.params.id }, select: { status: true } })
      if (!exists) return res.status(404).json({ message: 'Payment claim not found.' })
      return res.status(409).json({ message: `This claim is already ${exists.status}.`, code: 'ERR_CONFLICT' })
    }
    const claim = await prisma.paymentClaim.findUnique({ where: { id: req.params.id } })
    return res.status(200).json({ claim })
  } catch (err) {
    logger.error('rejectClaim error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
