/**
 * Demo expenses for a property, taken from the owner's paper "Expenses" sheet
 * (MSEB, tanker, staff, Booking.com, deposit refunds…): six months of history.
 * This month is the sheet (with a few unpaid bills and two income rows); the
 * five months before it are the regular bills, varied ±10–20% month to month,
 * plus a couple of one-offs, so the dashboard trends have something to show.
 *
 *   npm run db:seed:expenses                 # property named "Test"
 *   npm run db:seed:expenses -- "Main"       # any property, by name or code
 *   npm run db:seed:expenses -- --all        # every property
 *
 * Goes through the real controllers, so default categories are created the same
 * way the page creates them. Dates are relative to today.
 *
 * Safe to re-run: seeded entries are created by "seed", and a month that already
 * has seeded entries is skipped (so a re-run only fills in missing months). It
 * refuses a non-local database unless --allow-remote is passed.
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
const all = args.includes('--all')
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

// Last month's regular bills (a little lower than this month); also the base
// the older months vary from.
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

// Bills that come every month on top of LAST_MONTH in older months.
const REGULAR = [
  ['Didi', 'Staff salary', 9000, 'owner', 'Ravi', 'cash'],
  ['Newspaper', 'Newspaper', 840, 'reception', null, 'cash'],
  ['Garbage collection', 'Garbage collection', 600, 'owner', 'Ravi', 'cash'],
  ['Water bottles', 'Drinking water', 2400, 'reception', null, 'cash'],
]

// One-offs, two per older month (picked by month), not varied.
const ONE_OFFS = [
  ['Painter', 'Repairs & maintenance', 14500, 'owner', 'Ravi', 'bank'],
  ['Deposit refund', 'Deposit refund', 12000, 'reception', null, 'cash'],
  ['Municipal licence', 'Licences', 7500, 'owner', 'Ravi', 'bank'],
  ['Godrej', 'Appliance repair', 3800, 'reception', null, 'cash'],
  ['Electrician', 'Electrician', 2600, 'reception', null, 'cash'],
  ['GST', 'GST', 11800, 'owner', 'Ravi', 'bank'],
  ['Towel & pillow', 'Linen (towels & pillows)', 5200, 'owner', 'Ravi', 'upi'],
  ['Scooty service', 'Vehicle maintenance', 1200, 'reception', null, 'cash'],
]

// Older bills still owed, so "unpaid by age" has more than the 0–7 day bucket.
const OLD_UNPAID = {
  2: ['Hardware store', 'Hardware', 3400, 'reception', null, 'cash', { status: 'unpaid', reference: 'Credit slip 118' }],
  3: ['Cleaning', 'Cleaning services', 6500, 'owner', 'Ravi', 'bank', { status: 'unpaid', reference: 'Balance due' }],
}
const OLDER_MONTHS = 5

// Deterministic 0…1 noise, so re-runs on other properties look alike but not equal.
const noise = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x) }
// ±10–20%, rounded to ₹10.
const vary = (amount, seed) => {
  const f = 0.1 + 0.1 * noise(seed)
  const sign = noise(seed + 7) < 0.5 ? -1 : 1
  return Math.max(10, Math.round((amount * (1 + sign * f)) / 10) * 10)
}

const pad = (n) => String(n).padStart(2, '0')
const monthStart = (k) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() - k, 1) }
// Day `day` of the month k months ago (clamped to its length).
const dayIn = (k, day) => {
  const m = monthStart(k)
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(Math.min(day, last))}`
}

async function seedProperty(property) {
  CURRENT.propertyId = property.id
  return runWithProperty(property.id, async () => {
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

    // Month k ago already seeded? (per-month idempotency)
    const seeded = async (k) => prisma.expense.count({
      where: { createdById: SEED_BY, deletedAt: null, date: { gte: monthStart(k), lt: monthStart(k - 1) } },
    })

    const added = []
    for (let k = 0; k <= OLDER_MONTHS; k++) {
      if (await seeded(k)) continue
      let n = 0
      if (k === 0) {
        for (const [i, row] of SHEET.entries()) { await add(row, 'expense', ymd(thisMonth(i, SHEET.length))); n++ }
        for (const [i, row] of INCOME.entries()) { await add(row, 'income', ymd(thisMonth(i * 10 + 5, SHEET.length))); n++ }
      } else if (k === 1) {
        for (const [i, row] of LAST_MONTH.entries()) { await add(row, 'expense', dayIn(1, 26 - i * 2)); n++ }
      } else {
        const regular = [...LAST_MONTH, ...REGULAR]
        for (const [i, row] of regular.entries()) {
          const [payee, cat, amount, ...rest] = row
          // Salaries and fixed plans stay put; the rest move with usage.
          const fixed = ['Staff salary', 'Internet / WiFi', 'Newspaper', 'Garbage collection'].includes(cat)
          await add([payee, cat, fixed ? amount : vary(amount, k * 100 + i), ...rest], 'expense', dayIn(k, 2 + i)); n++
        }
        for (const j of [0, 1]) { await add(ONE_OFFS[(k * 2 + j) % ONE_OFFS.length], 'expense', dayIn(k, 12 + j * 9)); n++ }
        if (OLD_UNPAID[k]) { await add(OLD_UNPAID[k], 'expense', dayIn(k, 20)); n++ }
        if (k % 2 === 0) { await add(['Scrap dealer', 'Other income', vary(1000, k), 'reception', null, 'cash'], 'income', dayIn(k, 15)); n++ }
      }
      const m = monthStart(k)
      added.push(`${m.getFullYear()}-${pad(m.getMonth() + 1)}: ${n}`)
    }

    // Example monthly budgets, so the dashboard can show budget vs actual.
    const budgets = { 'Electricity (MSEB)': 18000, 'Staff salary': 60000, 'Cleaning services': 90000, 'Laundry': 7000, 'Diesel': 5000 }
    for (const [name, monthlyBudget] of Object.entries(budgets)) {
      const cat = categories.find((c) => c.name === name)
      if (cat && cat.monthlyBudget == null) await prisma.expenseCategory.update({ where: { id: cat.id }, data: { monthlyBudget } })
    }

    console.log(added.length
      ? `"${property.name}": seeded ${added.join(', ')}.`
      : `"${property.name}": all ${OLDER_MONTHS + 1} months already seeded — nothing to do.`)
  })
}

async function main() {
  const properties = await runUnscoped(() => prisma.property.findMany({
    where: all ? {} : { OR: [{ name: { equals: target, mode: 'insensitive' } }, { code: { equals: target, mode: 'insensitive' } }] },
    orderBy: { createdAt: 'asc' },
  }))
  if (!properties.length) throw new Error(all ? 'No properties found.' : `No property named or coded "${target}".`)
  for (const p of properties) await seedProperty(p)
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1) })
