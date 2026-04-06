import prisma from '../utils/prisma.js'

// GET /reports/dashboard
export const getDashboard = async (req, res) => {
  try {
    const [rooms, guests, invoices, notifications] = await Promise.all([
      prisma.room.findMany({ where: { status: { not: 'deleted' } } }),
      prisma.guest.findMany({
        where: { status: 'Active' },
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.invoice.findMany({ where: { status: 'Paid' } }),
      prisma.notification.findMany({ where: { dismissed: false }, orderBy: { createdAt: 'desc' } }),
    ])

    const total = rooms.length
    const available = rooms.filter((r) => r.status === 'available').length
    const occupied = rooms.filter((r) => r.status === 'occupied').length
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length
    const revenue = invoices.reduce((sum, inv) => sum + inv.total, 0)
    const occupancyRate = total > 0 ? parseFloat(((occupied / total) * 100).toFixed(1)) : 0

    return res.status(200).json({
      total,
      available,
      occupied,
      maintenance,
      revenue,
      occupancyRate,
      recentGuests: guests,
      notifications,
    })
  } catch (err) {
    console.error('getDashboard error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /reports/revenue?from=&to=
export const getRevenue = async (req, res) => {
  try {
    const { from, to } = req.query

    const where = { status: 'Paid' }
    if (from || to) {
      where.paidAt = {}
      if (from) where.paidAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.paidAt.lte = toDate
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { guest: { select: { name: true, docId: true } } },
      orderBy: { paidAt: 'asc' },
    })

    // Group by day
    const revenueByDay = {}
    for (const inv of invoices) {
      const day = inv.paidAt ? inv.paidAt.toISOString().split('T')[0] : 'unknown'
      if (!revenueByDay[day]) revenueByDay[day] = { date: day, revenue: 0, count: 0 }
      revenueByDay[day].revenue += inv.total
      revenueByDay[day].count += 1
    }

    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0)

    return res.status(200).json({
      totalRevenue,
      byDay: Object.values(revenueByDay),
      invoices,
    })
  } catch (err) {
    console.error('getRevenue error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /reports/gst?from=&to=
export const getGst = async (req, res) => {
  try {
    const { from, to } = req.query

    const where = {}
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { guest: { select: { name: true, docId: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const totalTaxable = invoices.reduce((sum, inv) => sum + (inv.rent + inv.food + inv.amenities), 0)
    const totalGst = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0)
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)

    // Group by GST rate
    const byRate = {}
    for (const inv of invoices) {
      const rate = inv.gstRate
      if (!byRate[rate]) byRate[rate] = { rate, taxable: 0, gst: 0, total: 0, count: 0 }
      byRate[rate].taxable += inv.rent + inv.food + inv.amenities
      byRate[rate].gst += inv.gstAmount
      byRate[rate].total += inv.total
      byRate[rate].count += 1
    }

    return res.status(200).json({
      totalTaxable,
      totalGst,
      totalAmount,
      byRate: Object.values(byRate),
      invoices,
    })
  } catch (err) {
    console.error('getGst error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /reports/export/csv?type=guests|billing|gst
export const exportCsv = async (req, res) => {
  try {
    const { type, from, to } = req.query

    let csvContent = ''
    let filename = 'export.csv'

    if (type === 'guests') {
      filename = 'guests-report.csv'
      const guests = await prisma.guest.findMany({
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
      })

      const headers = ['Doc ID', 'Name', 'Phone', 'Email', 'Room', 'Stay Type', 'Check In', 'Check Out', 'Status', 'Room Rate']
      const rows = guests.map((g) => [
        g.docId,
        g.name,
        g.phone,
        g.email || '',
        g.room?.number || '',
        g.stayType,
        g.checkInDate?.toISOString().split('T')[0] || '',
        g.checkOutDate?.toISOString().split('T')[0] || '',
        g.status,
        g.roomRate,
      ])
      csvContent = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    } else if (type === 'billing') {
      filename = 'billing-report.csv'
      const where = {}
      if (from || to) {
        where.createdAt = {}
        if (from) where.createdAt.gte = new Date(from)
        if (to) where.createdAt.lte = new Date(to)
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: { guest: { select: { name: true, docId: true } } },
        orderBy: { createdAt: 'desc' },
      })

      const headers = ['Invoice No', 'Guest', 'Doc ID', 'Period', 'Rent', 'Food', 'Amenities', 'GST Rate', 'GST Amount', 'Total', 'Status', 'Paid At']
      const rows = invoices.map((inv) => [
        inv.invoiceNo,
        inv.guest?.name || '',
        inv.guest?.docId || '',
        inv.period,
        inv.rent,
        inv.food,
        inv.amenities,
        inv.gstRate,
        inv.gstAmount,
        inv.total,
        inv.status,
        inv.paidAt?.toISOString().split('T')[0] || '',
      ])
      csvContent = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    } else if (type === 'gst') {
      filename = 'gst-report.csv'
      const where = {}
      if (from || to) {
        where.createdAt = {}
        if (from) where.createdAt.gte = new Date(from)
        if (to) where.createdAt.lte = new Date(to)
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: { guest: { select: { name: true, docId: true } } },
        orderBy: { createdAt: 'asc' },
      })

      const headers = ['Invoice No', 'Guest', 'Period', 'Taxable Amount', 'GST Rate (%)', 'CGST', 'SGST', 'Total GST', 'Total Amount']
      const rows = invoices.map((inv) => {
        const taxable = inv.rent + inv.food + inv.amenities
        const halfGst = parseFloat((inv.gstAmount / 2).toFixed(2))
        return [
          inv.invoiceNo,
          inv.guest?.name || '',
          inv.period,
          taxable,
          inv.gstRate,
          halfGst,
          halfGst,
          inv.gstAmount,
          inv.total,
        ]
      })
      csvContent = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    } else {
      return res.status(400).json({ message: 'Invalid export type. Use guests, billing, or gst.' })
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csvContent)
  } catch (err) {
    console.error('exportCsv error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
