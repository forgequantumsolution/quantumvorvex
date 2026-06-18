import prisma from '../utils/prisma.js'
import htmlToPdf from '../utils/pdf.js'

// GET /reports/dashboard
export const getDashboard = async (req, res) => {
  try {
    const [rooms, guests, invoices, notifications] = await Promise.all([
      prisma.room.findMany({ where: { deletedAt: null } }),
      prisma.guest.findMany({
        where: { status: 'Active', deletedAt: null },
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.invoice.findMany({ where: { status: 'Paid', deletedAt: null } }),
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

    const where = { status: 'Paid', deletedAt: null }
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

    const where = { deletedAt: null }
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
        where: { deletedAt: null },
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
      const where = { deletedAt: null }
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
      const where = { deletedAt: null }
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

// GET /reports/occupancy?from=&to=  — daily occupancy series + by-room-type snapshot
export const getOccupancy = async (req, res) => {
  try {
    const { from, to } = req.query
    const end = to ? new Date(to) : new Date()
    const start = from ? new Date(from) : new Date(end.getTime() - 29 * 86400000)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    const [rooms, bookings] = await Promise.all([
      prisma.room.findMany({ where: { deletedAt: null }, include: { type: true } }),
      prisma.booking.findMany({
        where: {
          status: { in: ['Confirmed', 'CheckedIn', 'CheckedOut'] },
          fromDate: { lte: end },
          deletedAt: null,
        },
        select: { fromDate: true, toDate: true, checkedOutAt: true },
      }),
    ])

    const totalRooms = rooms.length

    // Build a per-day occupancy count: a booking occupies a room from fromDate
    // through toDate (or checkout). Counts overlapping bookings per calendar day.
    const byDay = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d)
      day.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)

      const occupied = bookings.filter((b) => {
        const bStart = new Date(b.fromDate)
        const bEnd = b.toDate ? new Date(b.toDate) : (b.checkedOutAt ? new Date(b.checkedOutAt) : dayEnd)
        return bStart <= dayEnd && bEnd >= day
      }).length

      byDay.push({
        date: day.toISOString().split('T')[0],
        occupied,
        total: totalRooms,
        rate: totalRooms > 0 ? parseFloat(((occupied / totalRooms) * 100).toFixed(1)) : 0,
      })
    }

    // Current occupancy snapshot grouped by room type
    const typeMap = {}
    for (const r of rooms) {
      const name = r.type?.name || 'Unspecified'
      if (!typeMap[name]) typeMap[name] = { roomType: name, total: 0, occupied: 0 }
      typeMap[name].total += 1
      if (r.status === 'occupied') typeMap[name].occupied += 1
    }
    const byRoomType = Object.values(typeMap).map((t) => ({
      ...t,
      rate: t.total > 0 ? parseFloat(((t.occupied / t.total) * 100).toFixed(1)) : 0,
    }))

    const avgRate = byDay.length > 0
      ? parseFloat((byDay.reduce((s, d) => s + d.rate, 0) / byDay.length).toFixed(1))
      : 0

    return res.status(200).json({ byDay, byRoomType, totalRooms, avgRate })
  } catch (err) {
    console.error('getOccupancy error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /reports/export/pdf?type=guests|billing|gst&from=&to=
export const exportPdf = async (req, res) => {
  try {
    const { type, from, to } = req.query
    const hotel = await prisma.hotel.findFirst()
    const hotelName = hotel?.name || 'Quantum Vorvex'

    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

    let title = ''
    let headers = []
    let rows = []
    let filename = 'report.pdf'

    if (type === 'guests') {
      title = 'Guests Report'
      filename = 'guests-report.pdf'
      const guests = await prisma.guest.findMany({
        where: { deletedAt: null },
        include: { room: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
      })
      headers = ['Doc ID', 'Name', 'Phone', 'Room', 'Stay', 'Check In', 'Status', 'Rate']
      rows = guests.map((g) => [
        g.docId, g.name, g.phone, g.room?.number || '—', g.stayType,
        g.checkInDate?.toISOString().split('T')[0] || '—', g.status, fmt(g.roomRate),
      ])
    } else if (type === 'billing' || type === 'gst') {
      const where = { deletedAt: null }
      if (from || to) {
        where.createdAt = {}
        if (from) where.createdAt.gte = new Date(from)
        if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.createdAt.lte = t }
      }
      const invoices = await prisma.invoice.findMany({
        where, include: { guest: { select: { name: true, docId: true } } }, orderBy: { createdAt: 'desc' },
      })
      if (type === 'billing') {
        title = 'Billing Report'
        filename = 'billing-report.pdf'
        headers = ['Invoice', 'Guest', 'Period', 'Rent', 'Food', 'GST', 'Total', 'Status']
        rows = invoices.map((inv) => [
          inv.invoiceNo, inv.guest?.name || '—', inv.period,
          fmt(inv.rent), fmt(inv.food), fmt(inv.gstAmount), fmt(inv.total), inv.status,
        ])
      } else {
        title = 'GST Report'
        filename = 'gst-report.pdf'
        headers = ['Invoice', 'Guest', 'Taxable', 'Rate %', 'CGST', 'SGST', 'Total GST', 'Total']
        rows = invoices.map((inv) => {
          const taxable = inv.rent + inv.food + inv.amenities
          const half = parseFloat((inv.gstAmount / 2).toFixed(2))
          return [inv.invoiceNo, inv.guest?.name || '—', fmt(taxable), inv.gstRate, fmt(half), fmt(half), fmt(inv.gstAmount), fmt(inv.total)]
        })
      }
    } else {
      return res.status(400).json({ message: 'Invalid export type. Use guests, billing, or gst.' })
    }

    const generatedAt = new Date().toLocaleString('en-IN')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11px; }
        h1 { font-size: 20px; margin: 0; color: #b8860b; }
        .meta { color: #666; font-size: 10px; margin: 2px 0 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; background: #f4f1e8; padding: 6px 8px; border-bottom: 2px solid #b8860b; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #fafafa; }
      </style></head><body>
      <h1>${esc(hotelName)}</h1>
      <div class="meta">${esc(title)} · Generated ${esc(generatedAt)}${rows.length ? ` · ${rows.length} records` : ''}</div>
      <table>
        <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody>
      </table>
    </body></html>`

    const baseUrl = `${req.protocol}://${req.get('host')}`
    const pdf = await htmlToPdf(html, { baseUrl })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).end(pdf)
  } catch (err) {
    console.error('exportPdf error:', err)
    return res.status(500).json({ message: 'Failed to generate PDF.' })
  }
}
