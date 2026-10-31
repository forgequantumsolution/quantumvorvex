import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import multer from 'multer'
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { renderInvoiceHtml, buildInvoiceData, hotelLogo, inlineUploadAsset } from '../utils/invoiceTemplate.js'
import { htmlToPdf } from '../utils/pdf.js'
import {
  isTenancy, OPEN_END, tenancyTotals, billDueRent, invoiceTenancy, payTenancyInvoices,
} from '../utils/pgRent.js'

const DAY_MS = 86400000

// Demo "today" — mirrors client/src/utils/booking.js TODAY so the server-side
// "Upcoming" filter and count match the UI exactly.
const DEMO_TODAY = new Date('2026-06-02')

// Statuses that count as a live/active stay (not cancelled, checked out or no-show).
// Used for the "Active value" / "Outstanding dues" stat aggregates.
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'CheckedIn']

// WHERE clause for the "Upcoming" tab: a future-or-today arrival still pending/confirmed.
const upcomingWhere = {
  fromDate: { gte: DEMO_TODAY },
  status: { in: ['Confirmed', 'Pending'] },
}

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
 * The room rate is GST-INCLUSIVE: (subtotal − discount) already contains the tax,
 * so GST is *extracted* from it rather than added on top. Extra charges are added
 * after (outside the GST breakdown).
 */
const computePricing = ({ stayType, fromDate, toDate, months, roomRate, discount = 0, taxRate = 0, extraCharges = 0, advance = 0 }) => {
  const nights    = stayType === 'daily' ? nightsBetween(fromDate, toDate) : null
  const units     = stayType === 'daily' ? nights : (months || 1)
  const subtotal  = +(roomRate * units).toFixed(2)             // GST-inclusive gross
  const gross     = Math.max(0, subtotal - discount)           // tax sits inside this
  const taxable   = +(gross / (1 + taxRate / 100)).toFixed(2)  // base value (ex-GST)
  const taxAmount = +(gross - taxable).toFixed(2)              // GST extracted from gross
  const amount    = +(gross + extraCharges).toFixed(2)         // total = entered (+ extras)
  const balance   = +(amount - advance).toFixed(2)
  const paymentStatus = advance <= 0 ? 'unpaid' : advance >= amount ? 'paid' : 'partial'
  return { nights, subtotal, taxAmount, amount, balance, paymentStatus }
}

// Default tax rate from hotel settings (falls back to 0).
const defaultTaxRate = async () => {
  const hotel = await prisma.hotel.findFirst({ select: { gstRate: true } })
  return hotel?.gstRate ?? 0
}

const LIVE_STATUSES = ['Pending', 'Confirmed', 'CheckedIn']

// Overlap filter for live bookings: existing.from < newEnd AND existing.end > newFrom.
// An open-ended stay (no toDate) blocks everything after its start.
const bookingOverlap = (from, end) => ({
  status: { in: LIVE_STATUSES },
  deletedAt: null,
  fromDate: { lt: end },
  OR: [{ toDate: null }, { toDate: { gt: from } }],
})

const guestOverlap = (from, end) => ({
  status: 'Active',
  deletedAt: null,
  checkInDate: { lt: end },
  OR: [{ checkOutDate: null }, { checkOutDate: { gt: from } }],
})

/**
 * Is `roomId` (or one bed of it) free for [from, end)? Conflicts with other live
 * bookings and with currently-active guests in that room. With `bedNo` only that
 * bed — or a whole-room stay — clashes; without it any stay in the room does.
 * `ignoreBookingId` skips the booking being edited. Returns the conflicting
 * record (or null if free).
 */
const findConflict = async (roomId, from, end, ignoreBookingId = null, ignoreGuestId = null, bedNo = null) => {
  const sameBed = bedNo != null ? { OR: [{ bedNo }, { bedNo: null }] } : {}

  const bookingConflict = await prisma.booking.findFirst({
    where: {
      roomId,
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      AND: [bookingOverlap(from, end), sameBed],
    },
    select: { id: true, bookingNo: true, fromDate: true, toDate: true, bedNo: true },
  })
  if (bookingConflict) return { type: 'booking', ...bookingConflict }

  const guestConflict = await prisma.guest.findFirst({
    where: {
      roomId,
      // A checked-in booking owns the Active guest sitting in its room — it must
      // not block its own edit/extension.
      ...(ignoreGuestId ? { id: { not: ignoreGuestId } } : {}),
      AND: [guestOverlap(from, end), sameBed],
    },
    select: { id: true, name: true },
  })
  if (guestConflict) return { type: 'guest', ...guestConflict }

  return null
}

// Bed 1 → "A", 2 → "B" … (matches client/src/utils/beds.js).
const bedLabel = (n) => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : String(n))

// Human message for a findConflict hit, naming the bed when there is one.
const conflictMessage = (room, conflict, bedNo) => {
  const where = bedNo != null ? `Bed ${bedLabel(bedNo)} in Room ${room.number}` : `Room ${room.number}`
  const who = conflict.type === 'booking' ? conflict.bookingNo : conflict.name
  return `${where} is not available for these dates (conflicts with ${who}).`
}

// A room with 2+ beds can be booked whole or bed by bed — chosen per booking.
const hasBeds = (room) => (room?.bedCount || 1) > 1

// A bed number only makes sense on a room with several beds, and must exist in it.
// Returns an error message, or null when the (room, bedNo) pair is valid.
const bedError = (room, bedNo) => {
  if (bedNo == null) return null
  if (!hasBeds(room)) return `Room ${room.number} has a single bed — book it whole.`
  if (bedNo < 1 || bedNo > room.bedCount) return `Room ${room.number} has no Bed ${bedLabel(bedNo)}.`
  return null
}

// Default per-unit rate for a booking: the bed rate for one bed; for the whole
// of a multi-bed room with a bed rate, beds × bed rate; else the room rate.
const defaultRate = (room, stayType, bedNo) => {
  const bedRate = stayType === 'daily' ? room.bedDailyRate : room.bedMonthlyRate
  if (bedRate && bedNo != null) return bedRate
  if (bedRate && hasBeds(room)) return bedRate * room.bedCount
  return stayType === 'daily' ? room.dailyRate : room.monthlyRate
}

/**
 * Re-derive a room's status after a stay starts or ends. A room with beds is
 * "occupied" only once every bed (or the whole room) is checked in, so a PG room
 * with a free bed stays bookable; it drops back to "available" when that is no
 * longer true. Whole-room rooms keep their fixed transition (`fallback`).
 */
const syncRoomStatus = async (tx, roomId, fallback) => {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { bedCount: true, status: true },
  })
  if (!room) return
  if (!hasBeds(room)) {
    await tx.room.update({ where: { id: roomId }, data: { status: fallback } })
    return
  }
  const inHouse = await tx.booking.findMany({
    where: { roomId, status: 'CheckedIn', deletedAt: null },
    select: { bedNo: true },
  })
  const full = inHouse.some((b) => b.bedNo == null)
    || new Set(inHouse.map((b) => b.bedNo)).size >= room.bedCount
  const next = full ? 'occupied' : room.status === 'occupied' ? 'available' : room.status
  if (next !== room.status) await tx.room.update({ where: { id: roomId }, data: { status: next } })
}

const bookingInclude = {
  room: { include: { type: true } },
  // Overdue rent months of a tenancy, so lists can flag late payers.
  invoices: {
    where: { status: 'Overdue', deletedAt: null },
    select: { total: true, amountPaid: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
  guest: { select: { id: true, name: true, phone: true, status: true } },
  documents: { orderBy: { uploadedAt: 'asc' } },
}

// ── Handlers ───────────────────────────────────────────────────────────────────

// GET /bookings?status=&source=&q=&roomId=&page=&pageSize=
// `status=Upcoming` is a derived filter (future arrival, still confirmed/pending).
// Pagination is opt-in: pass page/pageSize to get a single page, otherwise all
// matching rows are returned (kept for callers that need the full set).
export const getBookings = async (req, res) => {
  try {
    const { status, source, q, roomId } = req.query
    const where = { deletedAt: null }
    if (status === 'Upcoming') {
      Object.assign(where, upcomingWhere)
    } else if (status && status !== 'all') {
      where.status = status
    }
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

    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))

    const findArgs = { where, include: bookingInclude, orderBy: { createdAt: 'desc' } }
    if (hasPaging) {
      findArgs.skip = (page - 1) * pageSize
      findArgs.take = pageSize
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany(findArgs),
      prisma.booking.count({ where }),
    ])
    return res.status(200).json({ bookings, total, ...(hasPaging ? { page, pageSize } : {}) })
  } catch (err) {
    logger.error('getBookings error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/stats — full-dataset aggregates for the page's stat cards and
// per-tab counts. Kept separate from the (searchable, paginated) list so the UI
// never has to load every row just to show totals.
export const getBookingStats = async (req, res) => {
  try {
    const [grouped, active, upcoming] = await Promise.all([
      prisma.booking.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.booking.aggregate({
        where: { status: { in: ACTIVE_STATUSES }, deletedAt: null },
        _sum: { amount: true, balance: true },
      }),
      prisma.booking.count({ where: { ...upcomingWhere, deletedAt: null } }),
    ])

    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))
    const total = grouped.reduce((s, g) => s + g._count._all, 0)

    return res.status(200).json({
      stats: {
        total,
        confirmed: byStatus.Confirmed || 0,
        checkedIn: byStatus.CheckedIn || 0,
        revenue: active._sum.amount || 0,
        dues: active._sum.balance || 0,
      },
      counts: {
        all: total,
        Upcoming: upcoming,
        Confirmed: byStatus.Confirmed || 0,
        CheckedIn: byStatus.CheckedIn || 0,
        CheckedOut: byStatus.CheckedOut || 0,
        Cancelled: byStatus.Cancelled || 0,
      },
    })
  } catch (err) {
    logger.error('getBookingStats error', { error: err.message })
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

// GET /bookings/guest-lookup?phone=9876543210
// Returning-guest lookup for the booking form: one number in, the details from
// that guest's most recent stay out, so staff don't retype what we already hold.
// The number is matched with `contains` because a booking's guestPhone can list
// several comma-separated numbers.
export const lookupGuestByPhone = async (req, res) => {
  try {
    const phone = String(req.query.phone || '').replace(/\D/g, '')
    if (phone.length !== 10) return res.status(400).json({ message: 'Enter a 10-digit phone number.' })

    const match = { deletedAt: null, guestPhone: { contains: phone } }
    const [booking, guest, visits] = await Promise.all([
      prisma.booking.findFirst({
        where: match,
        orderBy: { createdAt: 'desc' },
        include: { room: { select: { number: true } } },
      }),
      prisma.guest.findFirst({
        where: { deletedAt: null, phone: { contains: phone } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where: match }),
    ])

    if (!booking && !guest) return res.status(200).json({ found: false })

    // Prefer the booking (it carries occupancy + source); fall back to the guest
    // record for walk-ins that were checked in without one.
    return res.status(200).json({
      found: true,
      visits,
      guest: {
        guestName:    booking?.guestName    || guest?.name        || '',
        guestPhone:   booking?.guestPhone   || guest?.phone       || phone,
        guestEmail:   booking?.guestEmail   || guest?.email       || '',
        guestAddress: booking?.guestAddress || guest?.address     || '',
        nationality:  booking?.nationality  || guest?.nationality || '',
        idType:       booking?.idType       || guest?.idType      || '',
        // Check-in falls back to the booking number when no ID was given — that
        // is not a real ID, so don't carry it into a new booking.
        idNumber:     [booking?.idNumber, guest?.idNumber].find((x) => x && !/^BKG-/i.test(x)) || '',
        adults:       booking?.adults   ?? guest?.occupants ?? 1,
        children:     booking?.children ?? 0,
        source:       booking?.source   || guest?.source || null,
      },
      lastStay: booking
        ? {
            bookingNo:  booking.bookingNo,
            fromDate:   booking.fromDate,
            toDate:     booking.toDate,
            status:     booking.status,
            roomNumber: booking.room?.number || null,
          }
        : null,
    })
  } catch (err) {
    logger.error('lookupGuestByPhone error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Check the stay shape shared by single and group creates. Returns
// { from, end } or { error } (a 400 message).
const resolveStay = (b) => {
  const from = new Date(b.fromDate)
  // A PG tenancy has no fixed end: it runs, billed monthly, until move-out.
  if (isTenancy(b)) return { from, end: OPEN_END }
  if (b.stayType === 'daily' && !b.toDate) return { error: 'Check-out date is required for a daily stay.' }
  if (b.stayType === 'monthly' && !b.months) return { error: 'Number of months is required for a monthly stay.' }
  const end  = stayEnd(b.stayType, from, b.toDate, b.months)
  if (end <= from) return { error: 'Check-out must be after check-in.', code: 'ERR_DATE_RANGE' }
  return { from, end }
}

// Row data for one booking from validated input `b` (stay fields + one guest).
const buildBookingData = (b, room, from, taxRate) => {
  const bedNo    = b.bedNo ?? null
  const roomRate = b.roomRate ?? defaultRate(room, b.stayType, bedNo)
  const tenancy  = isTenancy(b)
  // A tenancy bills nothing up front — rent is invoiced month by month from
  // move-in — so its account starts at zero with the advance held as credit.
  const priced   = tenancy
    ? { nights: null, subtotal: 0, taxAmount: 0, ...tenancyTotals({ amount: 0, advance: b.advance ?? 0 }) }
    : computePricing({ ...b, roomRate, taxRate })
  return {
    guestName:    b.guestName,
    guestPhone:   b.guestPhone ?? null,
    guestEmail:   b.guestEmail ?? null,
    guestAddress: b.guestAddress ?? null,
    nationality:  b.nationality ?? null,
    idType:       b.idType ?? null,
    idNumber:     b.idNumber ?? null,
    adults:       b.adults ?? 1,
    children:     b.children ?? 0,
    roomId:       room.id,
    bedNo,
    groupId:      b.groupId ?? null,
    stayType:     b.stayType,
    fromDate:     from,
    toDate:       !tenancy && b.toDate ? new Date(b.toDate) : null,
    months:       !tenancy && b.stayType === 'monthly' ? b.months : null,
    nights:       priced.nights,
    roomRate,
    subtotal:     priced.subtotal,
    discount:     tenancy ? 0 : b.discount ?? 0,
    taxRate,
    taxAmount:    priced.taxAmount,
    extraCharges: tenancy ? 0 : b.extraCharges ?? 0,
    amount:       priced.amount,
    advance:      b.advance ?? 0,
    balance:      priced.balance,
    paymentStatus: priced.paymentStatus,
    securityDeposit: b.securityDeposit ?? 0,
    notes:           b.notes ?? null,
    specialRequests: b.specialRequests ?? null,
    source:       b.source,
    status:       'Confirmed',
    confirmedAt:  new Date(),
  }
}

// Insert a booking with a fresh booking number and a tax-invoice serial: the
// user's `userInvoiceNo` as-is, else the next auto serial (retried on a clash).
// Throws { code: 'ERR_DUP_INVOICE_NO' } when a manual number is already taken.
const insertBooking = async (data, hotel, userInvoiceNo = null) => {
  const bookingNo = await generateBookingNo()
  for (let attempt = 0; attempt < 20; attempt++) {
    const invoiceNo = userInvoiceNo
      ?? (hotel?.id ? await reserveSerial(hotel, new Date()) : null)
    try {
      return await prisma.booking.create({ data: { ...data, bookingNo, invoiceNo }, include: bookingInclude })
    } catch (e) {
      if (isInvoiceNoConflict(e)) {
        // A manual number that's already taken is a user error; auto-numbers
        // just retry with the next value.
        if (userInvoiceNo) throw Object.assign(new Error('dup invoice'), { code: 'ERR_DUP_INVOICE_NO' })
        continue
      }
      throw e
    }
  }
  throw new Error('Could not assign a unique invoice number')
}

// POST /bookings
export const createBooking = async (req, res) => {
  try {
    const b = req.body   // validated + coerced by Zod
    const room = await prisma.room.findUnique({ where: { id: b.roomId }, include: { type: true } })
    if (!room) return res.status(404).json({ message: 'Room not found.', code: 'ERR_ROOM_NOT_FOUND' })

    const stay = resolveStay(b)
    if (stay.error) return res.status(400).json({ message: stay.error, code: stay.code || 'ERR_VALIDATION' })
    const bedMsg = bedError(room, b.bedNo)
    if (bedMsg) return res.status(400).json({ message: bedMsg, code: 'ERR_VALIDATION' })

    // Double-booking prevention
    const conflict = await findConflict(b.roomId, stay.from, stay.end, null, null, b.bedNo ?? null)
    if (conflict) {
      return res.status(409).json({
        message: conflictMessage(room, conflict, b.bedNo ?? null),
        code: 'ERR_ROOM_UNAVAILABLE',
        conflict,
      })
    }

    const taxRate = b.taxRate ?? (await defaultTaxRate())
    const hotel = await prisma.hotel.findFirst()
    // The tax-invoice serial is assigned now, at booking creation: auto-numbered
    // from the day counter unless the user supplied one (editable in the form).
    const userInvoiceNo =
      typeof b.invoiceNo === 'string' && b.invoiceNo.trim() ? b.invoiceNo.trim() : null
    // A tenancy has no stay invoice: its rent invoices come from Billing monthly.
    const tenancy = isTenancy(b)

    let booking
    try {
      booking = await insertBooking(
        buildBookingData(b, room, stay.from, taxRate),
        tenancy ? null : hotel,
        tenancy ? null : userInvoiceNo,
      )
    } catch (e) {
      if (e.code === 'ERR_DUP_INVOICE_NO') {
        return res.status(409).json({ message: 'That invoice number is already used by another booking.', code: e.code })
      }
      throw e
    }

    logger.info('Booking created', { event: 'BOOKING', bookingNo: booking.bookingNo, invoiceNo: booking.invoiceNo, roomId: b.roomId })
    return res.status(201).json({ booking })
  } catch (err) {
    logger.error('createBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/group — several people into one room let by bed (PG). Shared
// stay fields come once; each occupant brings their own bed, guest details,
// rent, advance and security deposit and becomes their own booking (own
// invoice, dues, check-in/out), linked by a common groupId. All or nothing.
export const createBookingGroup = async (req, res) => {
  try {
    const { occupants, ...shared } = req.body   // validated + coerced by Zod
    const room = await prisma.room.findUnique({ where: { id: shared.roomId }, include: { type: true } })
    if (!room) return res.status(404).json({ message: 'Room not found.', code: 'ERR_ROOM_NOT_FOUND' })
    if (!hasBeds(room)) {
      return res.status(400).json({ message: `Room ${room.number} has a single bed — book it whole.`, code: 'ERR_VALIDATION' })
    }

    // Every occupant is on a bed, so a monthly group is a set of tenancies.
    const tenancy = isTenancy(shared)
    const stay = resolveStay({ ...shared, bedNo: occupants[0].bedNo })
    if (stay.error) return res.status(400).json({ message: stay.error, code: stay.code || 'ERR_VALIDATION' })

    const beds = occupants.map((o) => o.bedNo)
    if (new Set(beds).size !== beds.length) {
      return res.status(400).json({ message: 'Each occupant needs a different bed.', code: 'ERR_VALIDATION' })
    }
    for (const bedNo of beds) {
      const bedMsg = bedError(room, bedNo)
      if (bedMsg) return res.status(400).json({ message: bedMsg, code: 'ERR_VALIDATION' })
      const conflict = await findConflict(room.id, stay.from, stay.end, null, null, bedNo)
      if (conflict) {
        return res.status(409).json({ message: conflictMessage(room, conflict, bedNo), code: 'ERR_ROOM_UNAVAILABLE', conflict })
      }
    }

    const taxRate = shared.taxRate ?? (await defaultTaxRate())
    const hotel   = await prisma.hotel.findFirst()
    const groupId = crypto.randomUUID()

    // Sequential: booking numbers derive from the latest row. Booking creation
    // reserves invoice serials outside a transaction, so a failure part-way is
    // rolled back by removing the rows already written.
    const created = []
    try {
      for (const o of occupants) {
        const data = buildBookingData({ ...shared, ...o, groupId, adults: 1, children: 0 }, room, stay.from, taxRate)
        created.push(await insertBooking(data, tenancy ? null : hotel))
      }
    } catch (e) {
      if (created.length) await prisma.booking.deleteMany({ where: { id: { in: created.map((c) => c.id) } } })
      throw e
    }

    logger.info('Booking group created', { event: 'BOOKING', groupId, roomId: room.id, count: created.length })
    return res.status(201).json({ groupId, bookings: created })
  } catch (err) {
    logger.error('createBookingGroup error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/bed-availability?roomId=&from=&to=
// Per-bed status of a room let by bed over [from, to): free, or who holds it.
// Drives the bed picker on the booking form.
export const getBedAvailability = async (req, res) => {
  try {
    const { roomId } = req.query
    const from = new Date(req.query.from)
    // No `to` = an open-ended tenancy: the bed must be free from `from` onward.
    const end  = req.query.to ? new Date(req.query.to) : OPEN_END
    if (!roomId || isNaN(from) || isNaN(end) || end <= from) {
      return res.status(400).json({ message: 'roomId and from (and to after it, if given) are required.' })
    }
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return res.status(404).json({ message: 'Room not found.' })

    const [bookings, guests] = await Promise.all([
      prisma.booking.findMany({
        where: { roomId, ...bookingOverlap(from, end) },
        select: { id: true, bookingNo: true, bedNo: true, guestName: true, status: true, fromDate: true, toDate: true },
        orderBy: { fromDate: 'asc' },
      }),
      prisma.guest.findMany({
        where: { roomId, ...guestOverlap(from, end) },
        select: { id: true, name: true, bedNo: true, checkOutDate: true },
      }),
    ])

    const count = hasBeds(room) ? room.bedCount : 1
    const beds = Array.from({ length: count }, (_, i) => {
      const bedNo = i + 1
      const holds = (x) => x.bedNo == null || x.bedNo === bedNo
      const bk = bookings.find(holds)
      // Guests that came from a booking are already covered by it.
      const gs = !bk && guests.find(holds)
      const heldBy = bk
        ? { type: 'booking', bookingNo: bk.bookingNo, name: bk.guestName.split(',')[0].trim(), status: bk.status, until: bk.toDate }
        : gs ? { type: 'guest', name: gs.name, until: gs.checkOutDate } : null
      return { bedNo, label: bedLabel(bedNo), free: !heldBy, heldBy }
    })
    return res.status(200).json({
      room: { id: room.id, number: room.number, bedCount: room.bedCount },
      beds,
      freeCount: beds.filter((x) => x.free).length,
    })
  } catch (err) {
    logger.error('getBedAvailability error', { error: err.message })
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

    const tenancy = isTenancy(existing)
    if (tenancy && merged.advance < existing.advanceApplied) {
      return res.status(400).json({
        message: `₹${existing.advanceApplied} of the advance is already set against rent invoices — it can't go below that.`,
        code: 'ERR_VALIDATION',
      })
    }

    const from = new Date(merged.fromDate)
    const end  = tenancy ? OPEN_END : stayEnd(merged.stayType, from, merged.toDate, merged.months)

    // Moving to another bed of the same room (PG).
    const bedNo = b.bedNo !== undefined ? b.bedNo : existing.bedNo
    const bedMsg = b.bedNo !== undefined ? bedError(existing.room, bedNo) : null
    if (bedMsg) return res.status(400).json({ message: bedMsg, code: 'ERR_VALIDATION' })

    // If dates or bed changed, re-check availability
    if (b.fromDate || b.toDate !== undefined || b.months || bedNo !== existing.bedNo) {
      const conflict = await findConflict(existing.roomId, from, end, id, existing.guestId, bedNo)
      if (conflict) {
        const what = bedNo != null ? `Bed ${bedLabel(bedNo)}` : 'Room'
        return res.status(409).json({ message: `${what} is no longer available for these dates.`, code: 'ERR_ROOM_UNAVAILABLE', conflict })
      }
    }

    // A tenancy's amount is the rent already invoiced; a new rate applies from the
    // next month's invoice, and a changed advance only changes the credit.
    const priced = tenancy
      ? { nights: null, subtotal: existing.subtotal, taxAmount: existing.taxAmount,
          ...tenancyTotals({ amount: existing.amount, advance: merged.advance }) }
      : computePricing(merged)
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
      ...(b.securityDeposit !== undefined && { securityDeposit: b.securityDeposit }),
      bedNo,
      fromDate:     from,
      toDate:       !tenancy && merged.toDate ? new Date(merged.toDate) : null,
      months:       !tenancy && merged.stayType === 'monthly' ? merged.months : null,
      roomRate:     merged.roomRate,
      discount:     tenancy ? existing.discount : merged.discount,
      taxRate:      merged.taxRate,
      extraCharges: tenancy ? existing.extraCharges : merged.extraCharges,
      advance:      merged.advance,
      nights:       priced.nights,
      subtotal:     priced.subtotal,
      taxAmount:    priced.taxAmount,
      amount:       priced.amount,
      balance:      priced.balance,
      paymentStatus: priced.paymentStatus,
    }

    // Once checked in, the booking is mirrored by a Guest record — correct both
    // together so the Guests page doesn't keep showing the old details.
    const guestData = existing.guestId ? {
      ...(b.guestName    !== undefined && { name: b.guestName }),
      ...(b.guestPhone   !== undefined && { phone: b.guestPhone || 'N/A' }),
      ...(b.guestEmail   !== undefined && { email: b.guestEmail }),
      ...(b.guestAddress !== undefined && { address: b.guestAddress }),
      ...(b.nationality  !== undefined && { nationality: b.nationality }),
      ...(b.idType       && { idType: b.idType }),
      ...(b.idNumber     && { idNumber: b.idNumber }),
      ...(b.adults !== undefined || b.children !== undefined
        ? { occupants: (b.adults ?? existing.adults) + (b.children ?? existing.children) }
        : {}),
      checkOutDate: data.toDate,
      months:       data.months,
      roomRate:     data.roomRate,
      bedNo,
    } : null

    const booking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id }, data, include: bookingInclude })
      if (guestData) await tx.guest.update({ where: { id: existing.guestId }, data: guestData })
      return updated
    })
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
    // bookingNo is already "BKG-1015" — prefixing it again produced "BKG-BKG-1015".
    const idNumber = req.body.idNumber ?? booking.idNumber ?? booking.bookingNo
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
          bedNo:          booking.bedNo,
          occupants:      booking.adults + booking.children,
          specialRequests: booking.specialRequests,
          source:         booking.source,
          status:         'Active',
        },
      })

      const now = new Date()
      const tenancy = isTenancy(booking)
      // Move-in starts a tenancy's first rent month: bill it now (the advance
      // is credited against it), later months come from the daily job.
      const moveIn = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: 'CheckedIn',
          checkedInAt: now,
          guestId: guest.id,
          advance,
          ...(tenancy
            ? { ...tenancyTotals({ amount: booking.amount, advance }), rentBilledUntil: moveIn }
            : {
                balance: +(booking.amount - advance).toFixed(2),
                paymentStatus: advance <= 0 ? 'unpaid' : advance >= booking.amount ? 'paid' : 'partial',
              }),
        },
      })
      if (tenancy) await billDueRent(tx, updated, now)

      await syncRoomStatus(tx, booking.roomId, 'occupied')
      return tx.booking.findUnique({ where: { id }, include: bookingInclude })
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

    if (isTenancy(booking)) return checkOutTenancy(req, res, booking)

    const extraCharges = req.body.extraCharges !== undefined ? req.body.extraCharges : booking.extraCharges
    const addedExtra   = extraCharges - booking.extraCharges
    const amount       = +(booking.amount + addedExtra).toFixed(2)
    const finalPayment = req.body.finalPayment || 0
    const advance      = +(booking.advance + finalPayment).toFixed(2)
    const balance      = +(amount - advance).toFixed(2)
    const paymentMethod = req.body.paymentMethod || 'cash'

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
        // Log the settlement collected at check-out so it shows in the payments ledger.
        if (finalPayment > 0) {
          await tx.payment.create({
            data: {
              guestId:   booking.guestId,
              amount:    finalPayment,
              method:    paymentMethod,
              reference: req.body.paymentReference || null,
              type:      'collection',
            },
          })
        }
      }
      await syncRoomStatus(tx, booking.roomId, 'available')
      return updated
    })

    logger.info('Booking checked out', { event: 'BOOKING', bookingNo: booking.bookingNo })
    return res.status(200).json({ booking: result })
  } catch (err) {
    logger.error('checkOutBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/:id/rent — a tenancy's rent account: each month's invoice, what
// is due now, unapplied credit and when the next month is billed.
export const getRentAccount = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (!isTenancy(booking)) return res.status(400).json({ message: 'Not a monthly tenancy.' })
    const invoices = await prisma.invoice.findMany({
      where: { bookingId: booking.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, invoiceNo: true, period: true, total: true, amountPaid: true, status: true, createdAt: true, paidAt: true },
    })
    return res.status(200).json({
      invoices,
      rent: booking.roomRate,
      due: booking.balance,
      credit: Math.max(0, +(booking.advance - booking.advanceApplied).toFixed(2)),
      nextBillOn: booking.status === 'CheckedIn' ? booking.rentBilledUntil : null,
    })
  } catch (err) {
    logger.error('getRentAccount error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings/:id/collect-rent { amount, method, reference } — take a rent
// payment on the booking itself: it settles open months oldest first, and any
// extra is kept as credit for the next month. No re-entry of the tenancy.
export const collectRent = async (req, res) => {
  try {
    const amount = Number(req.body.amount)
    if (!(amount > 0)) return res.status(400).json({ message: 'Enter the amount received.' })
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    if (!isTenancy(booking)) return res.status(400).json({ message: 'Not a monthly tenancy.' })
    if (!booking.guestId) return res.status(400).json({ message: 'Check the tenant in first.' })
    const method = req.body.method || 'cash'
    const reference = req.body.reference || null

    const updated = await prisma.$transaction(async (tx) => {
      const applied = await payTenancyInvoices(tx, booking, amount, method, reference)
      if (amount > applied) {
        await tx.payment.create({
          data: { guestId: booking.guestId, amount: +(amount - applied).toFixed(2), method, reference, type: 'advance' },
        })
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          advanceApplied: +(booking.advanceApplied + applied).toFixed(2),
          ...tenancyTotals({ amount: booking.amount, advance: booking.advance + amount }),
        },
        include: bookingInclude,
      })
    })
    logger.info('Rent collected', { event: 'BOOKING', bookingNo: booking.bookingNo, amount })
    return res.status(200).json({ booking: updated })
  } catch (err) {
    logger.error('collectRent error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Move-out of a PG tenancy. Extra charges become a final invoice; the payment
// collected settles open rent invoices oldest first, and anything over is kept
// as a recorded collection. The security deposit is refunded at the desk.
const checkOutTenancy = async (req, res, booking) => {
  try {
    const extra         = Number(req.body.extraCharges) > booking.extraCharges ? req.body.extraCharges - booking.extraCharges : 0
    const finalPayment  = Number(req.body.finalPayment) || 0
    const paymentMethod = req.body.paymentMethod || 'cash'
    const reference     = req.body.paymentReference || null

    const result = await prisma.$transaction(async (tx) => {
      const b = { ...booking }
      if (extra > 0 && b.guestId) {
        await invoiceTenancy(tx, b, { period: 'Move-out charges', rent: extra })
      }
      let applied = 0
      if (finalPayment > 0 && b.guestId) {
        applied = await payTenancyInvoices(tx, b, finalPayment, paymentMethod, reference)
        if (finalPayment > applied) {
          await tx.payment.create({
            data: { guestId: b.guestId, amount: +(finalPayment - applied).toFixed(2), method: paymentMethod, reference, type: 'collection' },
          })
        }
      }
      const advance = b.advance + finalPayment
      const updated = await tx.booking.update({
        where: { id: b.id },
        data: {
          status: 'CheckedOut',
          checkedOutAt: new Date(),
          extraCharges: b.extraCharges + extra,
          advanceApplied: +(b.advanceApplied + applied).toFixed(2),
          ...tenancyTotals({ amount: b.amount, advance }),
        },
        include: bookingInclude,
      })
      if (b.guestId) {
        await tx.guest.update({ where: { id: b.guestId }, data: { status: 'CheckedOut', checkOutDate: new Date() } })
      }
      await syncRoomStatus(tx, b.roomId, 'available')
      return updated
    })

    logger.info('Tenancy checked out', { event: 'BOOKING', bookingNo: booking.bookingNo })
    return res.status(200).json({ booking: result })
  } catch (err) {
    logger.error('checkOutTenancy error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /bookings/:id/invoice?format=html|json&print=1
// Generates a GST tax invoice from a completed (checked-out) booking, pulling
// guest/room/hotel data from the tables and rendering the standard template.
// The tax-invoice serial is "<prefix><year>-<DD>/<MM>/<NN>":
//   prefix + year are configured by the hotel (e.g. "RA/" + "2026"); DD/MM come
//   from the BOOKING DATE; NN is the running count for that day (2 digits).
//   e.g. prefix "RA/", year "2026", booking 27 Jun → "RA/2026-27/06/01".
const SEQ_PAD = 2

// The fixed left part "<prefix><year>-<DD>/<MM>/" — also the per-day reset bucket
// (everything except the running number), so NN restarts at 1 each booking day.
const serialBucket = (hotel, date) => {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const year = hotel.invoiceYear || String(date.getFullYear())
  return `${hotel.invoicePrefix ?? ''}${year}-${dd}/${mm}/`
}

const buildSerial = (hotel, seq, date) =>
  `${serialBucket(hotel, date)}${String(seq).padStart(SEQ_PAD, '0')}`

// True when a P2002 (unique constraint) error is on Booking.invoiceNo.
const isInvoiceNoConflict = (e) =>
  e.code === 'P2002' && String(e.meta?.target ?? '').includes('invoiceNo')

// Reserve the next serial for `date` by atomically advancing that day's counter,
// and return the serial. On create the first serial is 1 (next stored as 2); on
// update we take the pre-increment value (reserved = counter.next - 1). Retries
// the counter create on a rare concurrent first-insert race.
const reserveSerial = async (hotel, date) => {
  const period = serialBucket(hotel, date)
  for (let i = 0; i < 10; i++) {
    try {
      const counter = await prisma.invoiceCounter.upsert({
        where:  { hotelId_period: { hotelId: hotel.id, period } },
        create: { hotelId: hotel.id, period, next: 2 },
        update: { next: { increment: 1 } },
      })
      return buildSerial(hotel, counter.next - 1, date)
    } catch (e) {
      if (e.code === 'P2002') continue
      throw e
    }
  }
  throw new Error('Could not reserve an invoice number')
}

// Peek the next auto serial for `date` WITHOUT reserving it (booking-form preview).
const peekSerial = async (hotel, date) => {
  const period = serialBucket(hotel, date)
  const counter = await prisma.invoiceCounter.findUnique({
    where: { hotelId_period: { hotelId: hotel.id, period } },
  })
  return buildSerial(hotel, counter?.next ?? 1, date)
}

// Assign the next tax-invoice serial to a booking that has none (fallback used by
// invoice generation for legacy bookings). New bookings get their number at
// creation; see createBooking.
const assignInvoiceNo = async (booking, hotel) => {
  const date = booking.createdAt ? new Date(booking.createdAt) : new Date()
  for (let attempt = 0; attempt < 20; attempt++) {
    const serial = await reserveSerial(hotel, date)
    try {
      await prisma.booking.update({ where: { id: booking.id }, data: { invoiceNo: serial } })
      return serial
    } catch (e) {
      if (isInvoiceNoConflict(e)) continue // serial taken by a manual edit — reserve the next
      throw e
    }
  }
  throw new Error('Could not assign a unique invoice number')
}

// GET /bookings/next-invoice-no — the next auto invoice serial for today, for the
// booking form preview. Does not reserve it (the real number is assigned on create).
export const getNextInvoiceNo = async (req, res) => {
  try {
    const hotel = await prisma.hotel.findFirst()
    const invoiceNo = hotel?.id ? await peekSerial(hotel, new Date()) : ''
    return res.status(200).json({ invoiceNo })
  } catch (err) {
    logger.error('getNextInvoiceNo error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

export const getBookingInvoice = async (req, res) => {
  try {
    const { id } = req.params
    const format = (req.query.format || 'html').toLowerCase()
    const autoPrint = req.query.print === '1' || req.query.print === 'true'

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: { include: { type: true } },
        guest: { include: { payments: { orderBy: { createdAt: 'asc' } } } },
      },
    })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    // A monthly tenancy's invoice lists every rent month billed (and any move-out
    // charges) as its own line, from the monthly invoices raised on it.
    if (isTenancy(booking)) {
      booking.rentInvoices = await prisma.invoice.findMany({
        where: { bookingId: booking.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    }

    // Invoice/proforma is available once a booking is real (confirmed onward).
    if (!['Confirmed', 'CheckedIn', 'CheckedOut'].includes(booking.status)) {
      return res.status(400).json({
        message: 'An invoice can only be generated for a confirmed, checked-in or checked-out booking.',
        code: 'ERR_NOT_COMPLETE',
        status: booking.status,
      })
    }

    const hotel = (await prisma.hotel.findFirst()) || {}

    // Assign a stable serial on first generation (prefix + running counter from
    // the hotel's invoice config). Once set it stays put; it can be overridden
    // via PATCH /bookings/:id/invoice-no. Falls back to bookingNo if assignment
    // fails or there's no hotel record to read the config from.
    if (!booking.invoiceNo && hotel.id) {
      try {
        booking.invoiceNo = await assignInvoiceNo(booking, hotel)
      } catch (err) {
        logger.warn('Invoice serial assignment failed', { error: err.message, bookingId: booking.id })
      }
    }

    if (format === 'json') {
      return res.status(200).json({ invoice: buildInvoiceData(booking, hotel) })
    }

    // Inline the logo/stamp as data URIs so they render regardless of how the
    // document is loaded (blob: preview, PDF renderer, direct tab).
    const renderHotel = {
      ...hotel,
      logoUrl: inlineUploadAsset(hotelLogo(hotel)),
      stampUrl: inlineUploadAsset(hotel.stampUrl),
    }

    if (format === 'pdf') {
      const html = renderInvoiceHtml(booking, renderHotel)
      try {
        const pdf = await htmlToPdf(html)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="invoice-${booking.bookingNo}.pdf"`)
        return res.status(200).send(pdf)
      } catch (err) {
        logger.error('Invoice PDF render failed', { error: err.message })
        return res.status(500).json({
          message: 'Could not render the invoice PDF. Ensure Chrome is installed on the server.',
          code: 'ERR_PDF_RENDER',
        })
      }
    }

    const html = renderInvoiceHtml(booking, renderHotel, { autoPrint })

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

// PATCH /bookings/:id/invoice-no — set/override the tax-invoice serial for a
// booking (the editable serial in the invoice preview).
export const updateInvoiceNo = async (req, res) => {
  try {
    const { id } = req.params
    const invoiceNo = typeof req.body?.invoiceNo === 'string' ? req.body.invoiceNo.trim() : ''
    if (!invoiceNo) return res.status(400).json({ message: 'Invoice number is required.' })
    if (invoiceNo.length > 60) return res.status(400).json({ message: 'Invoice number is too long (max 60 characters).' })

    const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })

    try {
      const updated = await prisma.booking.update({ where: { id }, data: { invoiceNo } })
      return res.status(200).json({ invoiceNo: updated.invoiceNo })
    } catch (e) {
      if (e.code === 'P2002') {
        return res.status(409).json({ message: 'That invoice number is already used by another booking.' })
      }
      throw e
    }
  } catch (err) {
    logger.error('updateInvoiceNo error', { error: err.message })
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
        await syncRoomStatus(tx, booking.roomId, 'available')
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
// Soft delete: stamp deletedAt so the booking disappears from every list/stat
// and stops blocking its room, while its payment/invoice history is preserved.
export const deleteBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
    if (!booking) return res.status(404).json({ message: 'Booking not found.' })
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { deletedAt: new Date() } })
      // A deleted in-house stay must release its room/bed too: its Guest record
      // would otherwise stay Active and keep blocking it.
      if (booking.guestId) {
        await tx.guest.updateMany({
          where: { id: booking.guestId, status: 'Active' },
          data: { deletedAt: new Date() },
        })
      }
      if (booking.status === 'CheckedIn') await syncRoomStatus(tx, booking.roomId, 'available')
    })
    return res.status(200).json({ message: 'Booking deleted.' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Booking not found.' })
    logger.error('deleteBooking error', { error: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
