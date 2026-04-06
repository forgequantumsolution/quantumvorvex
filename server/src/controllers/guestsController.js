import prisma from '../utils/prisma.js'

// Generate a unique document ID: DOC-XXXX
const generateDocId = async () => {
  const count = await prisma.guest.count()
  const padded = String(count + 1).padStart(4, '0')
  return `DOC-${padded}`
}

// GET /guests?status=&stayType=&search=
export const getGuests = async (req, res) => {
  try {
    const { status, stayType, search } = req.query

    const where = {}

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

    const guests = await prisma.guest.findMany({
      where,
      include: {
        room: { include: { type: true } },
        _count: { select: { documents: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json({ guests })
  } catch (err) {
    console.error('getGuests error:', err)
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
          tags: tags || [],
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
          amenities: amenities || [],
          facilities: facilities || [],
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

    const result = await prisma.$transaction(async (tx) => {
      // Check if a pending invoice exists; if not, create final invoice
      const pendingInvoice = guest.invoices.find((inv) => inv.status === 'Pending')
      let finalInvoice = pendingInvoice

      if (!pendingInvoice) {
        const invoiceCount = await tx.invoice.count()
        const invoiceNo = `INV-${String(invoiceCount + 1).padStart(4, '0')}`
        const rent = guest.roomRate
        const food = 0
        const amenitiesCharge = 0
        const subtotal = rent + food + amenitiesCharge
        const gstAmount = parseFloat(((subtotal * gstRate) / 100).toFixed(2))
        const total = parseFloat((subtotal + gstAmount).toFixed(2))

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
