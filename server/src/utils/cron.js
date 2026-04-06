import cron from 'node-cron'
import prisma from './prisma.js'

const checkOverdueGuests = async () => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find active guests whose checkout date has passed
    const overdueGuests = await prisma.guest.findMany({
      where: {
        status: 'Active',
        checkOutDate: { lte: today },
      },
      include: { room: { select: { number: true } } },
    })

    for (const guest of overdueGuests) {
      // Mark as Due
      await prisma.guest.update({
        where: { id: guest.id },
        data: { status: 'Due' },
      })

      // Create notification if not already exists for this guest today
      await prisma.notification.create({
        data: {
          type: 'warning',
          message: `Guest ${guest.name} (${guest.docId}) in Room ${guest.room?.number || 'N/A'} is overdue for checkout.`,
        },
      })
    }

    // Find guests with pending invoices past due date
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: 'Pending',
        createdAt: { lte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) }, // 7 days old
      },
      include: { guest: { select: { name: true, docId: true } } },
    })

    for (const invoice of unpaidInvoices) {
      await prisma.notification.create({
        data: {
          type: 'alert',
          message: `Invoice ${invoice.invoiceNo} for ${invoice.guest?.name || 'Unknown'} (${invoice.guest?.docId || ''}) is overdue. Amount: ₹${invoice.total}.`,
        },
      })
    }

    if (overdueGuests.length > 0 || unpaidInvoices.length > 0) {
      console.log(`[CRON] Processed ${overdueGuests.length} overdue guests, ${unpaidInvoices.length} overdue invoices.`)
    }
  } catch (err) {
    console.error('[CRON] Error during overdue check:', err.message)
  }
}

export const startCronJobs = () => {
  // Run at midnight every day: '0 0 * * *'
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running midnight overdue check...')
    await checkOverdueGuests()
  })

  console.log('[CRON] Scheduled jobs started.')
}
