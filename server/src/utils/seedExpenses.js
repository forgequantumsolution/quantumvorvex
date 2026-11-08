/**
 * Demo expenses for one property, taken from the owner's paper "Expenses" sheet
 * (MSEB, tanker, staff, Booking.com, deposit refunds…): this month's entries,
 * a few unpaid bills, two income rows, and last month's regular bills so the
 * trend has something to compare with.
 *
 *   npm run db:seed:expenses                 # property named "Test"
 *   npm run db:seed:expenses -- "Main"       # any property, by name or code
 *
 * Goes through the real controllers, so default categories are created the same
 * way the page creates them. Dates are relative to today.
 *
 * Safe to keep around: it refuses to run twice on the same property (seeded
 * entries are created by "seed"), and refuses a non-local database unless
 * --allow-remote is passed.
 */
import 'dotenv/config'
import prisma from './prisma.js'
import { runWithProperty, runUnscoped } from './propertyContext.js'
import { schemas } from '../middleware/validate.js'
import { getCategories, createExpense } from '../controllers/expensesController.js'

// Seeded rows are marked by their creator, so nothing extra shows in the list.
const SEED_BY = 'seed'

const args = process.argv.slice(2)
const allowRemote = args.includes('--allow-remote')
const target = args.find((a) => !a.startsWith('--')) || 'Test'

const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname } catch { return '' } })()
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && !allowRemote) {
  console.error(`Refusing to seed a non-local database (${host || 'unknown host'}). Pass --allow-remote to override.`)
  process.exit(1)
}

const CURRENT = { propertyId: null }

// Call a controller the way the router would: validated body, property scope.
const call = async (handler, { params = {}, body = {}, query = {}, schema } = {}) => {
  const res = {
    code: 200, data: null,
    status(c) { this.code = c; return this },
    json(d) { this.data = d; return this },
  }
  const parsed = schema ? schema.parse(body) : body
  await handler({ params, body: parsed, query, user: { userId: SEED_BY }, propertyId: CURRENT.propertyId, headers: {}, get: () => '' }, res)
  if (res.code >= 400) throw new Error(`${handler.name}: ${res.code} ${res.data?.message || ''}`)
  return res.data
}

const DAY = 24 * 60 * 60 * 1000
const ymd = (n) => {
  const d = new Date(Date.now() + n * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// This month's entries spread over the days so far (day 1 … today).
const dayOfMonth = new Date().getDate()
const thisMonth = (i, n) => -Math.floor(((dayOfMonth - 1) * i) / Math.max(1, n - 1))

// [payee, category, amount, paidFrom, paidByName, mode, extra]
// Rows the sheet left blank (paid by the owner) get a typical amount.
const SHEET = [
  ['MSEB', 'Electricity (MSEB)', 18450, 'owner', 'Ravi', 'bank', { status: 'unpaid', reference: 'Bill 0425-7781' }],
  ['Godrej', 'Appliance repair', 2400, 'reception', null, 'cash'],
  ['Airtel WiFi', 'Internet / WiFi', 1180, 'owner', 'Ravi', 'upi'],
  ['Fridge repair', 'Appliance repair', 5000, 'reception', null, 'cash'],
  ['Water tanker', 'Water tanker', 1600, 'reception', null, 'cash'],
  ['Newspaper', 'Newspaper', 840, 'reception', null, 'cash'],
  ['Garbage collection', 'Garbage collection', 600, 'owner', 'Ravi', 'cash'],
  ['Laundry', 'Laundry', 7350, 'owner', 'Ravi', 'upi'],
  ['Booking.com', 'OTA commission', 9820, 'owner', 'Ravi', 'bank', { status: 'unpaid', reference: 'Invoice BKG-2611' }],
  ['Scooty service', 'Vehicle maintenance', 840, 'reception', null, 'cash'],
  ['Gas', 'Gas', 2700, 'reception', null, 'cash'],
  ['Meter refund', 'Meter refund', 151, 'reception', null, 'cash'],
  ['Diesel', 'Diesel', 6000, 'reception', null, 'cash'],
  ['Towel & pillow', 'Linen (towels & pillows)', 4200, 'owner', 'Ravi', 'upi'],
  ['GST', 'GST', 12600, 'owner', 'Ravi', 'bank'],
  ['Cleaning material', 'Cleaning material', 370, 'reception', null, 'cash'],
  ['Petrol', 'Petrol', 1720, 'reception', null, 'cash'],
  ['Police', 'Police & local fees', 500, 'owner', 'Ravi', 'cash'],
  ['Water bottles', 'Drinking water', 2600, 'reception', null, 'cash'],
  ['Donation', 'Donation', 3000, 'reception', null, 'cash'],
  ['Electrician', 'Electrician', 3050, 'reception', null, 'cash'],
  ['Hardware', 'Hardware', 80, 'reception', null, 'cash'],
  ['Deposit refund', 'Deposit refund', 14000, 'reception', null, 'cash'],
  ['Deposit refund', 'Deposit refund', 28000, 'owner', 'Ravi', 'bank'],
  ['First aid', 'First aid', 8136, 'reception', null, 'cash'],
  ['Cleaning', 'Cleaning services', 95200, 'reception', null, 'cash'],
  ['Didi', 'Staff salary', 9000, 'owner', 'Ravi', 'cash'],
  ['Kamal Thapa', 'Staff salary', 16000, 'reception', null, 'cash'],
  ['Uttam', 'Staff salary', 10000, 'reception', null, 'cash'],
  ['Uttam', 'Staff advance', 5000, 'owner', 'Ravi', 'upi'],
  ['Vinay', 'Staff salary', 25000, 'reception', null, 'cash'],
  ['Plumber', 'Repairs & maintenance', 1450, 'reception', null, 'cash', { status: 'unpaid' }],
]

// Money in: scrap sale at the desk and cash the owner topped up.
const INCOME = [
  ['Scrap dealer', 'Other income', 1200, 'reception', null, 'cash'],
  ['Ravi (owner)', 'Other income', 20000, 'reception', 'Ravi', 'cash', { description: 'Cash added to reception' }],
]

// Last month's regular bills (a little lower than this month).
const LAST_MONTH = [
  ['MSEB', 'Electricity (MSEB)', 16900, 'owner', 'Ravi', 'bank'],
  ['Airtel WiFi', 'Internet / WiFi', 1180, 'owner', 'Ravi', 'upi'],
  ['Water tanker', 'Water tanker', 3200, 'reception', null, 'cash'],
  ['Gas', 'Gas', 2700, 'reception', null, 'cash'],
  ['Laundry', 'Laundry', 6400, 'owner', 'Ravi', 'upi'],
  ['Booking.com', 'OTA commission', 8150, 'owner', 'Ravi', 'bank'],
  ['Cleaning', 'Cleaning services', 88000, 'reception', null, 'cash'],
  ['Kamal Thapa', 'Staff salary', 16000, 'reception', null, 'cash'],
  ['Uttam', 'Staff salary', 10000, 'reception', null, 'cash'],
  ['Vinay', 'Staff salary', 25000, 'reception', null, 'cash'],
  ['Diesel', 'Diesel', 4500, 'reception', null, 'cash'],
  ['Petrol', 'Petrol', 1500, 'reception', null, 'cash'],
]

async function main() {
  const property = await runUnscoped(() => prisma.property.findFirst({
    where: { OR: [{ name: { equals: target, mode: 'insensitive' } }, { code: { equals: target, mode: 'insensitive' } }] },
  }))
  if (!property) throw new Error(`No property named or coded "${target}".`)
  CURRENT.propertyId = property.id

  await runWithProperty(property.id, async () => {
    if (await prisma.expense.count({ where: { createdById: SEED_BY, deletedAt: null } })) {
      console.log(`"${property.name}" already has seeded expenses — nothing to do.`)
      return
    }

    // Default categories (created on first list, like the page does).
    const { categories } = await call(getCategories)
    const byName = Object.fromEntries(categories.map((c) => [c.name, c.id]))

    const add = async ([payee, cat, amount, paidFrom, paidByName, paymentMode, extra = {}], type, date) => {
      const categoryId = byName[cat]
      if (!categoryId) throw new Error(`Category "${cat}" not found`)
      await call(createExpense, {
        schema: schemas.createExpense,
        body: {
          type, date, categoryId, payee, amount, paidFrom, paymentMode, status: 'paid',
          ...(paidByName && { paidByName }), ...extra,
        },
      })
    }

    for (const [i, row] of SHEET.entries()) await add(row, 'expense', ymd(thisMonth(i, SHEET.length)))
    for (const [i, row] of INCOME.entries()) await add(row, 'income', ymd(thisMonth(i * 10 + 5, SHEET.length)))
    for (const [i, row] of LAST_MONTH.entries()) await add(row, 'expense', ymd(-dayOfMonth - 2 - i * 2))

    // Example monthly budgets, so Analysis can show budget vs actual.
    const budgets = { 'Electricity (MSEB)': 18000, 'Staff salary': 60000, 'Cleaning services': 90000, 'Laundry': 7000, 'Diesel': 5000 }
    for (const [name, monthlyBudget] of Object.entries(budgets)) {
      const cat = categories.find((c) => c.name === name)
      if (cat && cat.monthlyBudget == null) await prisma.expenseCategory.update({ where: { id: cat.id }, data: { monthlyBudget } })
    }

    console.log(`Seeded ${SHEET.length + INCOME.length + LAST_MONTH.length} expenses in "${property.name}" `
      + `(${SHEET.length} this month, ${INCOME.length} income, ${LAST_MONTH.length} last month).`)
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1) })
