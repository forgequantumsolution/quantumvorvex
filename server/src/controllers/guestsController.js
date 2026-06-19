import path from 'path'
import prisma from '../utils/prisma.js'

// Generate a unique document ID: DOC-XXXX
const generateDocId = async () => {
  const count = await prisma.guest.count()
  const padded = String(count + 1).padStart(4, '0')
  return `DOC-${padded}`
}

// GET /guests?status=&stayType=&search=&page=&pageSize=
// Pagination is opt-in: pass page/pageSize for a single page, otherwise all
// matching rows are returned (kept for callers that need the full set, e.g.
// the Today panel and the billing guest pickers).
export const getGuests = async (req, res) => {
  try {
    const { status, stayType, search } = req.query

    const where = { deletedAt: null }

    if (status) where.status = status
    if (stayType) where.stayType = stayType
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { docId: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))

    const findArgs = {
      where,
      include: {
        room: { include: { type: true } },
        _count: { select: { documents: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    }
    if (hasPaging) {
      findArgs.skip = (page - 1) * pageSize
      findArgs.take = pageSize
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany(findArgs),
      prisma.guest.count({ where }),
    ])

    return res.status(200).json({ guests, total, ...(hasPaging ? { page, pageSize } : {}) })
  } catch (err) {
    console.error('getGuests error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /guests/stats — full-dataset counts for the summary cards, independent of
// the current search/filter/page so the totals always reflect every guest.
export const getGuestStats = async (req, res) => {
  try {
    const grouped = await prisma.guest.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })
    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))
    const total = grouped.reduce((s, g) => s + g._count._all, 0)

    return res.status(200).json({
      total,
      active: byStatus.Active || 0,
      due: byStatus.Due || 0,
      checkedOut: byStatus['Checked Out'] || 0,
    })
  } catch (err) {
    console.error('getGuestStats error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /guests/:id
export const getGuest = async (req, res) => {
  try {
    const { id } = req.params

    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        room: { include: { type: true } },
        documents: true,
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!guest) {
      return res.status(404).json({ message: 'Guest not found.' })
    }

    return res.status(200).json({ guest })
  } catch (err) {
    console.error('getGuest error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /guests
export const createGuest = async (req, res) => {
  try {
    const {
      name, phone, email, gender, dob, nationality,
      idType, idNumber, tags, notes, address,
      emergencyName, emergencyPhone,
      stayType, roomId, checkInDate, checkOutDate,
      months, roomRate, deposit, occupants,
      specialRequests, foodPlan, amenities, facilities,
    } = req.body

    if (!name || !phone || !idType || !idNumber || !roomId || !checkInDate || !roomRate) {
      return res.status(400).json({ message: 'Missing required guest fields.' })
    }

    // Verify room exists and is available
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' })
    }
    if (room.status === 'occupied') {
      return res.status(409).json({ message: 'Room is already occupied.' })
    }

    const docId = await generateDocId()

    const guest = await prisma.$transaction(async (tx) => {
      const newGuest = await tx.guest.create({
        data: {
          docId,
          name,
          phone,
          email,
          gender,
          dob: dob ? new Date(dob) : undefined,
          nationality,
          idType,
          idNumber,
          tags: JSON.stringify(tags || []),
          notes,
          address,
          emergencyName,
          emergencyPhone,
          stayType: stayType || 'daily',
          roomId,
          checkInDate: new Date(checkInDate),
          checkOutDate: checkOutDate ? new Date(checkOutDate) : undefined,
          months,
          roomRate,
          deposit,
          occupants: occupants || 1,
          specialRequests,
          foodPlan,
          amenities: JSON.stringify(amenities || []),
          facilities: JSON.stringify(facilities || []),
          status: 'Active',
        },
        include: { room: { include: { type: true } } },
      })

      // Mark room as occupied
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'occupied' },
      })

      return newGuest
    })

    return res.status(201).json({ guest })
  } catch (err) {
    console.error('createGuest error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /guests/:id
export const updateGuest = async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    // Sanitize date fields
    if (data.dob) data.dob = new Date(data.dob)
    if (data.checkInDate) data.checkInDate = new Date(data.checkInDate)
    if (data.checkOutDate) data.checkOutDate = new Date(data.checkOutDate)

    // tags/amenities/facilities are JSON-string columns — stringify arrays
    if (Array.isArray(data.tags)) data.tags = JSON.stringify(data.tags)
    if (Array.isArray(data.amenities)) data.amenities = JSON.stringify(data.amenities)
    if (Array.isArray(data.facilities)) data.facilities = JSON.stringify(data.facilities)

    // Remove relation fields that shouldn't be set directly
    delete data.room
    delete data.documents
    delete data.invoices
    delete data.id

    const guest = await prisma.guest.update({
      where: { id },
      data,
      include: { room: { include: { type: true } } },
    })

    return res.status(200).json({ guest })
  } catch (err) {
    console.error('updateGuest error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Guest not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /guests/:id/renew — extend an active stay (new period / checkout date)
export const renewGuestStay = async (req, res) => {
  try {
    const { id } = req.params
    const { months, checkOutDate, roomRate } = req.body

    const guest = await prisma.guest.findUnique({ where: { id } })
    if (!guest) return res.status(404).json({ message: 'Guest not found.' })
    if (guest.status === 'Checked Out') {
      return res.status(400).json({ message: 'Cannot renew a checked-out guest.' })
    }

    const data = {
      stayCount: (guest.stayCount || 1) + 1,
      status: 'Active',
    }

    if (guest.stayType === 'monthly') {
      const addMonths = months ? parseInt(months, 10) : 1
      // Anchor the new period on the current checkout (or now) and push it out.
      const base = guest.checkOutDate ? new Date(guest.checkOutDate) : new Date()
      const next = new Date(base)
      next.setMonth(next.getMonth() + addMonths)
      data.months = (guest.months || 1) + addMonths
      data.checkOutDate = next
    } else if (checkOutDate) {
      data.checkOutDate = new Date(checkOutDate)
    }

    if (roomRate !== undefined) data.roomRate = parseFloat(roomRate)

    const updated = await prisma.guest.update({
      where: { id },
      data,
      include: { room: { include: { type: true } } },
    })

    return res.status(200).json({ guest: updated, message: 'Stay renewed successfully.' })
  } catch (err) {
    console.error('renewGuestStay error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /guests/:id/communications — communication log for a guest
export const getGuestCommunications = async (req, res) => {
  try {
    const { id } = req.params
    const communications = await prisma.guestCommunication.findMany({
      where: { guestId: id },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json({ communications })
  } catch (err) {
    console.error('getGuestCommunications error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /guests/:id/communications — log a communication entry
export const createGuestCommunication = async (req, res) => {
  try {
    const { id } = req.params
    const { channel, direction, subject, content, staff } = req.body

    if (!content) return res.status(400).json({ message: 'content is required.' })

    const guest = await prisma.guest.findUnique({ where: { id } })
    if (!guest) return res.status(404).json({ message: 'Guest not found.' })

    const communication = await prisma.guestCommunication.create({
      data: {
        guestId: id,
        channel: channel || 'note',
        direction: direction || 'outbound',
        subject: subject || null,
        content,
        staff: staff || req.user?.name || null,
      },
    })
    return res.status(201).json({ communication })
  } catch (err) {
    console.error('createGuestCommunication error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /guests/:id/documents — attach files to a guest (ID proofs, payment
// receipts, etc.). Multipart; reuses the same multer config as bookings.
export const uploadGuestDocuments = async (req, res) => {
  try {
    const { id } = req.params
    const files = req.files || []
    if (!files.length) return res.status(400).json({ message: 'No files uploaded.' })

    const guest = await prisma.guest.findUnique({ where: { id }, select: { id: true } })
    if (!guest) return res.status(404).json({ message: 'Guest not found.' })

    // Normalise docTypes into an array aligned with files
    let labels = req.body.docTypes
    if (typeof labels === 'string') {
      try { labels = JSON.parse(labels) } catch { labels = [labels] }
    }
    if (!Array.isArray(labels)) labels = labels ? [labels] : []

    const created = await prisma.$transaction(
      files.map((file, i) =>
        prisma.document.create({
          data: {
            guestId: id,
            docType: (labels[i] || path.basename(file.originalname)).toString().slice(0, 80),
            url: `/uploads/documents/${file.filename}`,
          },
        })
      )
    )

    return res.status(201).json({ documents: created })
  } catch (err) {
    console.error('uploadGuestDocuments error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Base check-out bill for a guest, shared by the preview and the check-out so the
// figures shown in the modal match what is actually charged. Uses the open pending
// invoice when one exists, otherwise a fresh room-only invoice from the room rate.
// The security deposit is treated as advance already paid toward the stay.
function computeGuestBill(guest, gstRate) {
  const pending = guest.invoices?.find((inv) => inv.status === 'Pending')

  let rent, food, amenities, gst, total, amountPaid
  if (pending) {
    rent = pending.rent
    food = pending.food
    amenities = pending.amenities
    gst = pending.gstAmount
    total = pending.total
    amountPaid = pending.amountPaid
  } else {
    rent = guest.roomRate
    food = 0
    amenities = 0
    gst = parseFloat(((rent * gstRate) / 100).toFixed(2))
    total = parseFloat((rent + gst).toFixed(2))
    amountPaid = 0
  }

  const advance = guest.deposit || 0
  const balanceDue = parseFloat((total - amountPaid - advance).toFixed(2))
  return { rent, food, amenities, gst, gstRate, total, amountPaid, advance, balanceDue }
}

// GET /guests/:id/checkout-preview — the bill the check-out modal renders.
export const getCheckoutPreview = async (req, res) => {
  try {
    const { id } = req.params
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: { invoices: true },
    })
    if (!guest) return res.status(404).json({ message: 'Guest not found.' })

    const hotel = await prisma.hotel.findFirst()
    const gstRate = hotel?.gstRate || 12

    return res.status(200).json({ bill: computeGuestBill(guest, gstRate) })
  } catch (err) {
    console.error('getCheckoutPreview error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /guests/:id/checkout
export const checkoutGuest = async (req, res) => {
  try {
    const { id } = req.params

    const guest = await prisma.guest.findUnique({
      where: { id },
      include: { invoices: true },
    })

    if (!guest) {
      return res.status(404).json({ message: 'Guest not found.' })
    }

    if (guest.status === 'Checked Out') {
      return res.status(400).json({ message: 'Guest is already checked out.' })
    }

    // Get hotel settings for GST
    const hotel = await prisma.hotel.findFirst()
    const gstRate = hotel?.gstRate || 12

    // Settlement inputs from the check-out modal (same shape the bookings flow uses).
    const extraCharges     = Number(req.body.extraCharges) || 0
    const finalPayment     = Number(req.body.finalPayment) || 0
    const paymentMethod    = req.body.paymentMethod || 'cash'
    const paymentReference = req.body.paymentReference || null

    const result = await prisma.$transaction(async (tx) => {
      // Check if a pending invoice exists; if not, create final invoice
      const pendingInvoice = guest.invoices.find((inv) => inv.status === 'Pending')
      let finalInvoice = pendingInvoice

      if (!pendingInvoice) {
        const invoiceCount = await tx.invoice.count()
        const invoiceNo = `INV-${String(invoiceCount + 1).padStart(4, '0')}`
        const rent = guest.roomRate
        const food = 0
        // Extra charges sit on the amenities line and are added after tax —
        // GST is only charged on the room (matches the bookings checkout).
        const amenitiesCharge = extraCharges
        const subtotal = rent + food
        const gstAmount = parseFloat(((subtotal * gstRate) / 100).toFixed(2))
        const total = parseFloat((subtotal + gstAmount + extraCharges).toFixed(2))

        finalInvoice = await tx.invoice.create({
          data: {
            invoiceNo,
            guestId: id,
            period: `Checkout - ${new Date().toLocaleDateString()}`,
            rent,
            food,
            amenities: amenitiesCharge,
            gstRate,
            gstAmount,
            total,
            status: 'Pending',
          },
        })
      } else if (extraCharges > 0) {
        // Append extra charges (untaxed) to the existing pending invoice.
        finalInvoice = await tx.invoice.update({
          where: { id: pendingInvoice.id },
          data: {
            amenities: pendingInvoice.amenities + extraCharges,
            total: parseFloat((pendingInvoice.total + extraCharges).toFixed(2)),
          },
        })
      }

      // Record the amount collected at check-out and settle the invoice. The
      // Payment row feeds the same payments ledger the bookings flow writes to.
      if (finalPayment > 0 && finalInvoice) {
        const amountPaid = parseFloat((finalInvoice.amountPaid + finalPayment).toFixed(2))
        // The deposit counts toward the bill (same as the preview's balance).
        const fullySettled = amountPaid + (guest.deposit || 0) >= finalInvoice.total
        finalInvoice = await tx.invoice.update({
          where: { id: finalInvoice.id },
          data: {
            amountPaid,
            status: fullySettled ? 'Paid' : finalInvoice.status,
            paidAt: fullySettled ? new Date() : finalInvoice.paidAt,
          },
        })
        await tx.payment.create({
          data: {
            guestId: id,
            invoiceId: finalInvoice.id,
            amount: finalPayment,
            method: paymentMethod,
            reference: paymentReference,
            type: 'collection',
          },
        })
      }

      // Update guest status
      const updatedGuest = await tx.guest.update({
        where: { id },
        data: {
          status: 'Checked Out',
          checkOutDate: new Date(),
        },
      })

      // Free the room
      await tx.room.update({
        where: { id: guest.roomId },
        data: { status: 'available' },
      })

      return { guest: updatedGuest, invoice: finalInvoice }
    })

    return res.status(200).json({
      message: 'Guest checked out successfully.',
      guest: result.guest,
      invoice: result.invoice,
    })
  } catch (err) {
    console.error('checkoutGuest error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /guests/:id — soft delete. Stamps deletedAt so the guest disappears from
// every list/stat/report while their invoices/payments/documents are preserved.
// If the guest was still occupying a room, the room is freed.
export const deleteGuest = async (req, res) => {
  try {
    const { id } = req.params

    const guest = await prisma.guest.findUnique({
      where: { id },
      select: { id: true, roomId: true, status: true, deletedAt: true },
    })
    if (!guest || guest.deletedAt) return res.status(404).json({ message: 'Guest not found.' })

    const wasOccupying = guest.status === 'Active' || guest.status === 'Due'

    await prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id }, data: { deletedAt: new Date() } })
      if (wasOccupying && guest.roomId) {
        await tx.room.update({ where: { id: guest.roomId }, data: { status: 'available' } })
      }
    })

    return res.status(200).json({ message: 'Guest deleted.' })
  } catch (err) {
    console.error('deleteGuest error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
