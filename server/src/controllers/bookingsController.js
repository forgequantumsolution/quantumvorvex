import path from 'path'
import fs from 'fs'
import multer from 'multer'
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { renderInvoiceHtml, buildInvoiceData } from '../utils/invoiceTemplate.js'

const DAY_MS = 86400000

// ── ID-document uploads (Aadhaar front/back, PAN, etc.) ──────────────────────────
const docsDir = path.resolve('uploads/documents')
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const safe = path.basename(file.originalname, ext).replace(/\s+/g, '-')
    cb(null, `${safe}-${Date.now()}${ext}`)
  },
})

export const uploadDocs = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Only image and PDF files are allowed.'))
  },
})

// ── Helpers ────────────────────────────────────────────────────────────────────

// Booking number: BKG-0001. Derives from the highest existing number so deletes
// don't cause collisions.
const generateBookingNo = async () => {
  const last = await prisma.booking.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { bookingNo: true },
  })
  const lastNum = last?.bookingNo?.match(/(\d+)$/)?.[1]
  const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1
  return `BKG-${String(next).padStart(4, '0')}`
}

// Effective end date of a stay (handles open-ended monthly stays).
const stayEnd = (stayType, fromDate, toDate, months) => {
  if (toDate) return new Date(toDate)
  if (stayType === 'monthly' && months) return new Date(new Date(fromDate).getTime() + months * 30 * DAY_MS)
  return new Date(new Date(fromDate).getTime() + DAY_MS)
}

// Number of nights for a daily stay (min 1).
const nightsBetween = (from, to) => {
  if (!to) return 1
  const n = Math.round((new Date(to) - new Date(from)) / DAY_MS)
  return Math.max(1, n)
}

/**
 * Compute the full pricing breakdown from raw inputs.
 * Tax is applied on (subtotal − discount); extra charges are added after tax.
 */
const computePricing = ({ stayType, fromDate, toDate, months, roomRate, discount = 0, taxRate = 0, extraCharges = 0, advance = 0 }) => {
  const nights    = stayType === 'daily' ? nightsBetween(fromDate, toDate) : null
  const units     = stayType === 'daily' ? nights : (months || 1)
  const subtotal  = +(roomRate * units).toFixed(2)
  const taxable   = Math.max(0, subtotal - discount)
  const taxAmount = +((taxable * taxRate) / 100).toFixed(2)
  const amount    = +(taxable + taxAmount + extraCharges).toFixed(2)
  const balance   = +(amount - advance).toFixed(2)
  const paymentStatus = advance <= 0 ? 'unpaid' : advance >= amount ? 'paid' : 'partial'
  return { nights, subtotal, taxAmount, amount, balance, paymentStatus }
}

// Default tax rate from hotel settings (falls back to 0).
const defaultTaxRate = async () => {
  const hotel = await prisma.hotel.findFirst({ select: { gstRate: true } })
  return hotel?.gstRate ?? 0
}

/**
 * Is `roomId` free for [from, end)? Conflicts with other live bookings and with
 * currently-active guests in that room. `ignoreBookingId` skips the booking
 * being edited. Returns the conflicting record (or null if free).
 */
const findConflict = async (roomId, from, end, ignoreBookingId = null) => {
  const LIVE = ['Pending', 'Confirmed', 'CheckedIn']

  const bookingConflict = await prisma.booking.findFirst({
    where: {
      roomId,
      status: { in: LIVE },
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      // overlap: existing.from < newEnd  AND  existing.end > newFrom
      fromDate: { lt: end },
      OR: [
        { toDate: null },                 // open-ended stay blocks everything after its start
        { toDate: { gt: from } },
      ],
    },
    select: { id: true, bookingNo: true, fromDate: true, toDate: true },
  })
  if (bookingConflict) return { type: 'booking', ...bookingConflict }

  const guestConflict = await prisma.guest.findFirst({
    where: {
      roomId,
      status: 'Active',
      checkInDate: { lt: end },
      OR: [
        { checkOutDate: null },
        { checkOutDate: { gt: from } },
      ],
    },
    select: { id: true, name: true },
  })
  if (guestConflict) return { type: 'guest', ...guestConflict }

  return null
}

const bookingInclude = {
  room: { include: { type: true } },
  guest: { select: { id: true, name: true, phone: true, status: true } },
  documents: { orderBy: { uploadedAt: 'asc' } },
}

// ── Handlers ───────────────────────────────────────────────────────────────────

// GET /bookings?status=&source=&q=&roomId=
export const getBookings = async (req, res) => {
  try {
    const { status, source, q, roomId } = req.query
    const where = {}
    if (status && status !== 'all') where.status = status
    if (source) where.source = source
    if (roomId) where.roomId = roomId
    if (q) {
      where.OR = [
        { guestName: { contains: q, mode: 'insensitive' } },
        { bookingNo: { contains: q, mode: 'insensitive' } },
        { guestPhone: { contains: q, mode: 'insensitive' } },
        { room: { number: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json({ bookings, total: bookings.length })
  } catch (err) {
    logger.error('getBookings error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/:id
export const getBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: bookingInclude,
    })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    return res.status(200).json({ booking })
  } catch (err) {
    logger.error('getBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings
export const createBooking = async (req, res) => {
  try {
    const b = req.body   // validated + coerced by Zod
    const room = await prisma.room.findUnique({ where: { id: b.roomId }, include: { type: true } })
    if (!room) return res.status(404).json({ message: 'Room not found.', code: 'ERR_ROOM_NOT_FOUND' })

    if (b.stayType === 'daily' && !b.toDate) {
      return res.status(400).json({ message: 'Check-out date is required for a daily stay.', code: 'ERR_VALIDATION' })
    }
    if (b.stayType === 'monthly' && !b.months) {
      return res.status(400).json({ message: 'Number of months is required for a monthly stay.', code: 'ERR_VALIDATION' })
    }

    const from = new Date(b.fromDate)
    const end  = stayEnd(b.stayType, from, b.toDate, b.months)
    if (end <= from) {
      return res.status(400).json({ message: 'Check-out must be after check-in.', code: 'ERR_DATE_RANGE' })
    }

    // Double-booking prevention
    const conflict = await findConflict(b.roomId, from, end)
    if (conflict) {
      return res.status(409).json({
        message: `Room ${room.number} is not available for these dates (conflicts with ${conflict.type === 'booking' ? conflict.bookingNo : conflict.name}).`,
        code: 'ERR_ROOM_UNAVAILABLE',
        conflict,
      })
    }

    const roomRate = b.roomRate ?? (b.stayType === 'daily' ? room.dailyRate : room.monthlyRate)
    const taxRate  = b.taxRate ?? (await defaultTaxRate())
    const priced   = computePricing({ ...b, roomRate, taxRate })

    const bookingNo = await generateBookingNo()
    const booking = await prisma.booking.create({
      data: {
        bookingNo,
        guestName:    b.guestName,
        guestPhone:   b.guestPhone ?? null,
        guestEmail:   b.guestEmail ?? null,
        guestAddress: b.guestAddress ?? null,
        nationality:  b.nationality ?? null,
        idType:       b.idType ?? null,
        idNumber:     b.idNumber ?? null,
        adults:       b.adults,
        children:     b.children,
        roomId:       b.roomId,
        stayType:     b.stayType,
        fromDate:     from,
        toDate:       b.toDate ? new Date(b.toDate) : null,
        months:       b.stayType === 'monthly' ? b.months : null,
        nights:       priced.nights,
        roomRate,
        subtotal:     priced.subtotal,
        discount:     b.discount,
        taxRate,
        taxAmount:    priced.taxAmount,
        extraCharges: b.extraCharges,
        amount:       priced.amount,
        advance:      b.advance,
        balance:      priced.balance,
        paymentStatus: priced.paymentStatus,
        notes:           b.notes ?? null,
        specialRequests: b.specialRequests ?? null,
        source:       b.source,
        status:       'Confirmed',
        confirmedAt:  new Date(),
      },
      include: bookingInclude,
    })

    logger.info('Booking created', { event: 'BOOKING', bookingNo, roomId: b.roomId })
    return res.status(201).json({ booking })
  } catch (err) {
    logger.error('createBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/documents — attach one or more ID documents to a booking.
// Files come as multipart field "documents"; their labels come as "docTypes"
// (a JSON array, repeated field, or single value) aligned by upload order.
export const uploadBookingDocuments = async (req, res) => {
  try {
    const { id } = req.params
    const files = req.files || []
    if (!files.length) return res.status(400).json({ message: 'No files uploaded.' })

    const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })

    // Normalise docTypes into an array aligned with files
    let labels = req.body.docTypes
    if (typeof labels === 'string') {
      try { labels = JSON.parse(labels) } catch { labels = [labels] }
    }
    if (!Array.isArray(labels)) labels = labels ? [labels] : []

    const created = await prisma.$transaction(
      files.map((file, i) =>
        prisma.bookingDocument.create({
          data: {
            bookingId: id,
            docType: (labels[i] || path.basename(file.originalname)).toString().slice(0, 80),
            url: `/uploads/documents/${file.filename}`,
          },
        })
      )
    )

    logger.info('Booking documents uploaded', { event: 'BOOKING', bookingId: id, count: created.length })
    return res.status(201).json({ documents: created })
  } catch (err) {
    logger.error('uploadBookingDocuments error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /bookings/:id — general edit (recomputes pricing)
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.booking.findUnique({ where: { id }, include: { room: true } })
    if (!existing) return res.status(404).json({ message: 'Booking not found.' })
    if (['CheckedOut', 'Cancelled'].includes(existing.status)) {
      return res.status(400).json({ message: `A ${existing.status} booking cannot be edited.`, code: 'ERR_LOCKED' })
    }

    const b = req.body
    const merged = {
      stayType:     existing.stayType,
      fromDate:     b.fromDate ?? existing.fromDate,
      toDate:       b.toDate !== undefined ? b.toDate : existing.toDate,
      months:       b.months ?? existing.months,
      roomRate:     b.roomRate ?? existing.roomRate,
      discount:     b.discount ?? existing.discount,
      taxRate:      b.taxRate ?? existing.taxRate,
      extraCharges: b.extraCharges ?? existing.extraCharges,
      advance:      b.advance ?? existing.advance,
    }

    const from = new Date(merged.fromDate)
    const end  = stayEnd(merged.stayType, from, merged.toDate, merged.months)

    // If dates changed, re-check availability
    if (b.fromDate || b.toDate !== undefined || b.months) {
      const conflict = await findConflict(existing.roomId, from, end, id)
      if (conflict) {
        return res.status(409).json({ message: 'Room is no longer available for the new dates.', code: 'ERR_ROOM_UNAVAILABLE', conflict })
      }
    }

    const priced = computePricing(merged)
    const data = {
      ...(b.guestName !== undefined && { guestName: b.guestName }),
      ...(b.guestPhone !== undefined && { guestPhone: b.guestPhone }),
      ...(b.guestEmail !== undefined && { guestEmail: b.guestEmail }),
      ...(b.guestAddress !== undefined && { guestAddress: b.guestAddress }),
      ...(b.nationality !== undefined && { nationality: b.nationality }),
      ...(b.idType !== undefined && { idType: b.idType }),
      ...(b.idNumber !== undefined && { idNumber: b.idNumber }),
      ...(b.adults !== undefined && { adults: b.adults }),
      ...(b.children !== undefined && { children: b.children }),
      ...(b.notes !== undefined && { notes: b.notes }),
      ...(b.specialRequests !== undefined && { specialRequests: b.specialRequests }),
      ...(b.source !== undefined && { source: b.source }),
      fromDate:     from,
      toDate:       merged.toDate ? new Date(merged.toDate) : null,
      months:       merged.stayType === 'monthly' ? merged.months : null,
      roomRate:     merged.roomRate,
      discount:     merged.discount,
      taxRate:      merged.taxRate,
      extraCharges: merged.extraCharges,
      advance:      merged.advance,
      nights:       priced.nights,
      subtotal:     priced.subtotal,
      taxAmount:    priced.taxAmount,
      amount:       priced.amount,
      balance:      priced.balance,
      paymentStatus: priced.paymentStatus,
    }

    const booking = await prisma.booking.update({ where: { id }, data, include: bookingInclude })
    return res.status(200).json({ booking })
  } catch (err) {
    logger.error('updateBooking error', { error: err.message })
    if (err.code === 'P2025') return res.status(404).json({ message: 'Booking not found.' })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/confirm
export const confirmBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'Confirmed', confirmedAt: new Date() },
      include: bookingInclude,
    })
    return res.status(200).json({ booking })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Booking not found.' })
    logger.error('confirmBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/check-in — creates/links a Guest and marks the room occupied
export const checkInBooking = async (req, res) => {
  try {
    const { id } = req.params
    const booking = await prisma.booking.findUnique({ where: { id }, include: { room: true } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (booking.status === 'CheckedIn') return res.status(400).json({ message: 'Guest is already checked in.' })
    if (['Cancelled', 'CheckedOut', 'NoShow'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot check in a ${booking.status} booking.` })
    }

    const idType   = req.body.idType   ?? booking.idType   ?? 'Other'
    const idNumber = req.body.idNumber ?? booking.idNumber ?? `BKG-${booking.bookingNo}`
    const advance  = req.body.advance !== undefined ? req.body.advance : booking.advance

    const result = await prisma.$transaction(async (tx) => {
      // Auto-create the Guest record linked to this booking
      const guest = await tx.guest.create({
        data: {
          docId:          `G-${booking.bookingNo}`,
          name:           booking.guestName,
          phone:          booking.guestPhone || 'N/A',
          email:          booking.guestEmail,
          address:        booking.guestAddress,
          nationality:    booking.nationality,
          idType,
          idNumber,
          stayType:       booking.stayType,
          roomId:         booking.roomId,
          checkInDate:    new Date(),
          checkOutDate:   booking.toDate,
          months:         booking.months,
          roomRate:       booking.roomRate,
          deposit:        advance,
          occupants:      booking.adults + booking.children,
          specialRequests: booking.specialRequests,
          source:         booking.source,
          status:         'Active',
        },
      })

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: 'CheckedIn',
          checkedInAt: new Date(),
          guestId: guest.id,
          advance,
          balance: +(booking.amount - advance).toFixed(2),
          paymentStatus: advance <= 0 ? 'unpaid' : advance >= booking.amount ? 'paid' : 'partial',
        },
        include: bookingInclude,
      })

      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'occupied' } })
      return updated
    })

    logger.info('Booking checked in', { event: 'BOOKING', bookingNo: booking.bookingNo })
    return res.status(200).json({ booking: result })
  } catch (err) {
    logger.error('checkInBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/check-out — frees the room and closes the guest stay
export const checkOutBooking = async (req, res) => {
  try {
    const { id } = req.params
    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (booking.status !== 'CheckedIn') {
      return res.status(400).json({ message: 'Only a checked-in booking can be checked out.' })
    }

    const extraCharges = req.body.extraCharges !== undefined ? req.body.extraCharges : booking.extraCharges
    const addedExtra   = extraCharges - booking.extraCharges
    const amount       = +(booking.amount + addedExtra).toFixed(2)
    const advance      = +(booking.advance + (req.body.finalPayment || 0)).toFixed(2)
    const balance      = +(amount - advance).toFixed(2)

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: 'CheckedOut',
          checkedOutAt: new Date(),
          extraCharges, amount, advance, balance,
          paymentStatus: advance <= 0 ? 'unpaid' : advance >= amount ? 'paid' : 'partial',
        },
        include: bookingInclude,
      })
      if (booking.guestId) {
        await tx.guest.update({ where: { id: booking.guestId }, data: { status: 'CheckedOut', checkOutDate: new Date() } })
      }
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'available' } })
      return updated
    })

    logger.info('Booking checked out', { event: 'BOOKING', bookingNo: booking.bookingNo })
    return res.status(200).json({ booking: result })
  } catch (err) {
    logger.error('checkOutBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/:id/invoice?format=html|json&print=1
// Generates a GST tax invoice from a completed (checked-out) booking, pulling
// guest/room/hotel data from the tables and rendering the standard template.
export const getBookingInvoice = async (req, res) => {
  try {
    const { id } = req.params
    const format = (req.query.format || 'html').toLowerCase()
    const autoPrint = req.query.print === '1' || req.query.print === 'true'

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: { include: { type: true } } },
    })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })

    // Invoice/proforma is available once a booking is real (confirmed onward).
    if (!['Confirmed', 'CheckedIn', 'CheckedOut'].includes(booking.status)) {
      return res.status(400).json({
        message: 'An invoice can only be generated for a confirmed, checked-in or checked-out booking.',
        code: 'ERR_NOT_COMPLETE',
        status: booking.status,
      })
    }

    const hotel = (await prisma.hotel.findFirst()) || {}

    if (format === 'json') {
      return res.status(200).json({ invoice: buildInvoiceData(booking, hotel) })
    }

    const html = renderInvoiceHtml(booking, hotel, { autoPrint })

    // This response is a standalone HTML document, not part of the SPA — relax
    // the strict API CSP so its inline <style> (and optional auto-print script)
    // can run when opened directly in a browser tab.
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'${autoPrint ? "; script-src 'unsafe-inline'" : ''}`
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', `inline; filename="invoice-${booking.bookingNo}.html"`)
    return res.status(200).send(html)
  } catch (err) {
    logger.error('getBookingInvoice error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/cancel
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params
    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (['CheckedOut', 'Cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: `Booking is already ${booking.status}.` })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason: req.body.reason || null },
        include: bookingInclude,
      })
      // If it was checked in, free the room + close the guest stay
      if (booking.status === 'CheckedIn') {
        if (booking.guestId) await tx.guest.update({ where: { id: booking.guestId }, data: { status: 'Cancelled' } })
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'available' } })
      }
      return updated
    })

    logger.info('Booking cancelled', { event: 'BOOKING', bookingNo: booking.bookingNo })
    return res.status(200).json({ booking: result })
  } catch (err) {
    logger.error('cancelBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/no-show
export const noShowBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'NoShow' },
      include: bookingInclude,
    })
    return res.status(200).json({ booking })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Booking not found.' })
    logger.error('noShowBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /bookings/:id
export const deleteBooking = async (req, res) => {
  try {
    await prisma.booking.delete({ where: { id: req.params.id } })
    return res.status(200).json({ message: 'Booking deleted.' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Booking not found.' })
    logger.error('deleteBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
