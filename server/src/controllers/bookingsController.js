import prisma from '../utils/prisma.js'

// Generate booking number: BKG-XXXX
const generateBookingNo = async () => {
  const count = await prisma.booking.count()
  return `BKG-${String(count + 1).padStart(4, '0')}`
}

// GET /bookings?status=
export const getBookings = async (req, res) => {
  try {
    const { status } = req.query
    const where = {}
    if (status) where.status = status

    const bookings = await prisma.booking.findMany({
      where,
      include: { room: { include: { type: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json({ bookings })
  } catch (err) {
    console.error('getBookings error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /bookings
export const createBooking = async (req, res) => {
  try {
    const {
      guestName, roomId, stayType, fromDate,
      toDate, months, amount, advance, notes,
    } = req.body

    if (!guestName || !roomId || !fromDate || amount === undefined) {
      return res.status(400).json({ message: 'guestName, roomId, fromDate, and amount are required.' })
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' })
    }

    const bookingNo = await generateBookingNo()

    const booking = await prisma.booking.create({
      data: {
        bookingNo,
        guestName,
        roomId,
        stayType: stayType || 'daily',
        fromDate: new Date(fromDate),
        toDate: toDate ? new Date(toDate) : undefined,
        months,
        amount,
        advance: advance || 0,
        notes,
        status: 'Pending',
      },
      include: { room: { include: { type: true } } },
    })

    return res.status(201).json({ booking })
  } catch (err) {
    console.error('createBooking error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /bookings/:id
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params
    const { status, notes, advance, fromDate, toDate } = req.body

    const updateData = {}
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (advance !== undefined) updateData.advance = advance
    if (fromDate) updateData.fromDate = new Date(fromDate)
    if (toDate) updateData.toDate = new Date(toDate)

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: { room: { include: { type: true } } },
    })

    return res.status(200).json({ booking })
  } catch (err) {
    console.error('updateBooking error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Booking not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
