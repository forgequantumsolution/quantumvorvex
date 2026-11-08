import cron from 'node-cron'
import prisma from './prisma.js'
import { runWithProperty } from './propertyContext.js'
import { runRentBilling } from './pgRent.js'

// Runs once per active property so every query is scoped and each notification
// lands in the property it concerns.
const checkOverdueGuests = async () => {
  const properties = await prisma.property.findMany({ where: { status: 'active' }, select: { id: true } })
  for (const { id } of properties) {
    await runWithProperty(id, () => checkPropertyOverdue(id))
  }
}

const checkPropertyOverdue = async (propertyId) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find active guests whose checkout date has passed
    const overdueGuests = await prisma.guest.findMany({
      where: {
        status: 'Active',
        checkOutDate: { lte: today },
        deletedAt: null,
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
        deletedAt: null,
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
      console.log(`[CRON] Property ${propertyId}: processed ${overdueGuests.length} overdue guests, ${unpaidInvoices.length} overdue invoices.`)
    }
  } catch (err) {
    console.error(`[CRON] Error during overdue check for property ${propertyId}:`, err.message)
  }
}

// PG tenancies: raise each tenant's rent invoice when their month starts.
const billPgRentAllProperties = async () => {
  const properties = await prisma.property.findMany({ where: { status: 'active' }, select: { id: true } })
  for (const { id } of properties) {
    try {
      const n = await runWithProperty(id, () => runRentBilling(new Date()))
      if (n) console.log(`[CRON] Property ${id}: ${n} PG rent invoice(s) created.`)
    } catch (err) {
      console.error(`[CRON] PG rent billing failed for property ${id}:`, err.message)
    }
  }
}

export const startCronJobs = () => {
  // Run at midnight every day: '0 0 * * *'
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running midnight overdue check...')
    await checkOverdueGuests()
  })

  // 00:10 daily (after the overdue check): bill PG rent for months starting today.
  cron.schedule('10 0 * * *', async () => {
    console.log('[CRON] Billing PG rent...')
    await billPgRentAllProperties()
  })
  // Catch up on start, in case the server was down at midnight.
  billPgRentAllProperties()

  console.log('[CRON] Scheduled jobs started.')
}
