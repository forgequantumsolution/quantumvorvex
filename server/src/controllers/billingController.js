import prisma from '../utils/prisma.js'

// GET /billing?status=&search=&page=&pageSize=
// Pagination is opt-in: with no page/pageSize the full matching set is returned.
export const getInvoices = async (req, res) => {
  try {
    const { status, search } = req.query
    const where = { deletedAt: null }

    if (status) where.status = status
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { guest: { name: { contains: search, mode: 'insensitive' } } },
        { guest: { docId: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))

    const findArgs = {
      where,
      include: {
        guest: {
          select: { id: true, name: true, phone: true, docId: true, roomId: true, room: { select: { number: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }
    if (hasPaging) {
      findArgs.skip = (page - 1) * pageSize
      findArgs.take = pageSize
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany(findArgs),
      prisma.invoice.count({ where }),
    ])

    return res.status(200).json({ invoices, total, ...(hasPaging ? { page, pageSize } : {}) })
  } catch (err) {
    console.error('getInvoices error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /billing/stats — full-dataset aggregates for the stat cards (collected /
// pending / overdue totals + GST), independent of the current search/filter/page.
export const getInvoiceStats = async (req, res) => {
  try {
    const [grouped, paid, pending, overdue] = await Promise.all([
      prisma.invoice.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.invoice.aggregate({ where: { status: 'Paid', deletedAt: null }, _sum: { total: true, gstAmount: true } }),
      prisma.invoice.aggregate({ where: { status: 'Pending', deletedAt: null }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { status: 'Overdue', deletedAt: null }, _sum: { total: true } }),
    ])

    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]))

    return res.status(200).json({
      collected: paid._sum.total || 0,
      gstCollected: paid._sum.gstAmount || 0,
      paidCount: byStatus.Paid || 0,
      pendingTotal: pending._sum.total || 0,
      pendingCount: byStatus.Pending || 0,
      overdueTotal: overdue._sum.total || 0,
      overdueCount: byStatus.Overdue || 0,
    })
  } catch (err) {
    console.error('getInvoiceStats error:', err)
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

// GET /billing/ledger?guestId=  — per-guest debit/credit entries + running balance
export const getLedger = async (req, res) => {
  try {
    const { guestId } = req.query
    if (!guestId) return res.status(400).json({ message: 'guestId is required.' })

    const guest = await prisma.guest.findUnique({ where: { id: guestId } })
    if (!guest) return res.status(404).json({ message: 'Guest not found.' })

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({ where: { guestId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      // Exclude payments belonging to a soft-deleted invoice (advances have no invoiceId).
      prisma.payment.findMany({
        where: { guestId, OR: [{ invoiceId: null }, { invoice: { deletedAt: null } }] },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // Build raw entries: invoice charges are debits, payments are credits.
    const entries = []
    for (const inv of invoices) {
      const at = inv.createdAt
      if (inv.rent) entries.push({ at, type: 'Debit', desc: `Room Rent — ${inv.period} (${inv.invoiceNo})`, amount: inv.rent })
      if (inv.food) entries.push({ at, type: 'Debit', desc: `Food Plan — ${inv.period}`, amount: inv.food })
      if (inv.amenities) entries.push({ at, type: 'Debit', desc: `Amenities — ${inv.period}`, amount: inv.amenities })
      if (inv.gstAmount) entries.push({ at, type: 'Debit', desc: `GST (${inv.gstRate}%)`, amount: inv.gstAmount })
    }
    for (const p of payments) {
      const label = p.type === 'advance' ? 'Advance' : p.type === 'refund' ? 'Refund' : 'Payment Received'
      const sign = p.type === 'refund' ? -1 : 1
      entries.push({
        at: p.createdAt,
        type: p.type === 'refund' ? 'Debit' : 'Credit',
        desc: `${label}${p.method ? ` — ${p.method}` : ''}${p.reference ? ` (${p.reference})` : ''}`,
        amount: Math.abs(p.amount),
        _credit: sign,
      })
    }

    entries.sort((a, b) => new Date(a.at) - new Date(b.at))

    // Running balance: debits decrease (guest owes), credits increase toward zero.
    let balance = 0
    const rows = entries.map((e) => {
      const delta = e.type === 'Credit' ? e.amount : -e.amount
      balance += delta
      return {
        date: new Date(e.at).toISOString().split('T')[0],
        type: e.type,
        desc: e.desc,
        amount: e.amount,
        balance: parseFloat(balance.toFixed(2)),
      }
    })

    return res.status(200).json({
      guest: { id: guest.id, name: guest.name, docId: guest.docId },
      entries: rows,
      closingBalance: rows.length ? rows[rows.length - 1].balance : 0,
    })
  } catch (err) {
    console.error('getLedger error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /billing/cash-register?date=YYYY-MM-DD  — cash movements for a single day
export const getCashRegister = async (req, res) => {
  try {
    const { date } = req.query
    const day = date ? new Date(date) : new Date()
    const start = new Date(day); start.setHours(0, 0, 0, 0)
    const end = new Date(day); end.setHours(23, 59, 59, 999)

    const payments = await prisma.payment.findMany({
      // Skip payments tied to a soft-deleted invoice (advances have no invoiceId).
      where: { createdAt: { gte: start, lte: end }, OR: [{ invoiceId: null }, { invoice: { deletedAt: null } }] },
      include: { guest: { select: { name: true, docId: true } }, invoice: { select: { invoiceNo: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const transactions = payments.map((p) => {
      const isOut = p.type === 'refund'
      const who = p.invoice?.invoiceNo
        ? `${p.invoice.invoiceNo} — ${p.guest?.name || ''}`.trim()
        : (p.guest?.name || p.guest?.docId || 'Walk-in')
      return {
        time: new Date(p.createdAt).toTimeString().slice(0, 5),
        type: p.type || 'collection',
        method: p.method,
        desc: `${p.type === 'advance' ? 'Advance' : p.type === 'refund' ? 'Refund' : 'Collection'} — ${who}`,
        cashIn: isOut ? 0 : p.amount,
        cashOut: isOut ? p.amount : 0,
      }
    })

    const totalIn = transactions.reduce((s, t) => s + t.cashIn, 0)
    const totalOut = transactions.reduce((s, t) => s + t.cashOut, 0)

    return res.status(200).json({
      date: start.toISOString().split('T')[0],
      transactions,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    })
  } catch (err) {
    console.error('getCashRegister error:', err)
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

// DELETE /billing/:id — soft delete. Stamps deletedAt so the invoice (and its
// collected payments) disappears from billing, the ledger, the cash register and
// revenue/GST reports, while the row is preserved for audit.
export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params
    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true, deletedAt: true } })
    if (!invoice || invoice.deletedAt) return res.status(404).json({ message: 'Invoice not found.' })

    await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } })
    return res.status(200).json({ message: 'Invoice deleted.' })
  } catch (err) {
    console.error('deleteInvoice error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
