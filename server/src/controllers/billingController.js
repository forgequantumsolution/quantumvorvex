import prisma from '../utils/prisma.js'

// GET /billing?status=&search=
export const getInvoices = async (req, res) => {
  try {
    const { status, search } = req.query
    const where = {}

    if (status) where.status = status
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { guest: { name: { contains: search, mode: 'insensitive' } } },
        { guest: { docId: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        guest: {
          select: { id: true, name: true, phone: true, docId: true, roomId: true, room: { select: { number: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json({ invoices })
  } catch (err) {
    console.error('getInvoices error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /billing/generate
export const generateInvoice = async (req, res) => {
  try {
    const { guestId, period, rent, food, amenities: amenitiesCharge } = req.body

    if (!guestId || !period || rent === undefined) {
      return res.status(400).json({ message: 'guestId, period, and rent are required.' })
    }

    const guest = await prisma.guest.findUnique({ where: { id: guestId } })
    if (!guest) {
      return res.status(404).json({ message: 'Guest not found.' })
    }

    // Get GST settings
    const hotel = await prisma.hotel.findFirst()
    const gstRate = hotel?.gstRate || 12

    const subtotal = (rent || 0) + (food || 0) + (amenitiesCharge || 0)
    const gstAmount = parseFloat(((subtotal * gstRate) / 100).toFixed(2))
    const total = parseFloat((subtotal + gstAmount).toFixed(2))

    const invoiceCount = await prisma.invoice.count()
    const invoiceNo = `INV-${String(invoiceCount + 1).padStart(4, '0')}`

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        guestId,
        period,
        rent: rent || 0,
        food: food || 0,
        amenities: amenitiesCharge || 0,
        gstRate,
        gstAmount,
        total,
        status: 'Pending',
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, docId: true } },
      },
    })

    return res.status(201).json({ invoice })
  } catch (err) {
    console.error('generateInvoice error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /billing/:id/collect
export const collectPayment = async (req, res) => {
  try {
    const { id } = req.params

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'Paid',
        paidAt: new Date(),
      },
      include: {
        guest: { select: { id: true, name: true, docId: true } },
      },
    })

    return res.status(200).json({ invoice, message: 'Payment collected successfully.' })
  } catch (err) {
    console.error('collectPayment error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Invoice not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /billing/:id/pdf
export const getInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        guest: {
          include: {
            room: { include: { type: true } },
          },
        },
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found.' })
    }

    // Get hotel info for PDF header
    const hotel = await prisma.hotel.findFirst()

    return res.status(200).json({ invoice, hotel })
  } catch (err) {
    console.error('getInvoicePdf error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
