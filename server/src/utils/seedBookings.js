/**
 * Demo bookings for one property: 6 hotel rooms and 20 bookings in every state
 * (pending, confirmed, in-house daily stays and PG tenancies, checked out,
 * cancelled, no-show), with some dues left open.
 *
 *   npm run db:seed:bookings                 # property named "Test"
 *   npm run db:seed:bookings -- "Main"       # any property, by name or code
 *
 * Goes through the real controllers (create → confirm → check-in → check-out /
 * cancel / no-show), so invoices, guests, room status and rent billing are the
 * same as for bookings made in the app. Dates are relative to today.
 *
 * Safe to keep around: it refuses to run twice on the same property (seeded
 * bookings carry the note "[seed]"), and refuses a non-local database unless
 * --allow-remote is passed.
 */
import 'dotenv/config'
import prisma from './prisma.js'
import { runWithProperty, runUnscoped } from './propertyContext.js'
import { schemas } from '../middleware/validate.js'
import { createRoom } from '../controllers/roomsController.js'
import {
  createBooking, createBookingGroup, confirmBooking, checkInBooking, checkOutBooking, cancelBooking, noShowBooking,
} from '../controllers/bookingsController.js'

const SEED_NOTE = '[seed] demo booking'

const args = process.argv.slice(2)
const allowRemote = args.includes('--allow-remote')
const target = args.find((a) => !a.startsWith('--')) || 'Test'

const host = (() => { try { return new URL(process.env.DATABASE_URL).hostname } catch { return '' } })()
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && !allowRemote) {
  console.error(`Refusing to seed a non-local database (${host || 'unknown host'}). Pass --allow-remote to override.`)
  process.exit(1)
}

// Call a controller the way the router would: validated body, property scope.
const call = async (handler, { params = {}, body = {}, schema } = {}) => {
  const res = {
    code: 200, data: null,
    status(c) { this.code = c; return this },
    json(d) { this.data = d; return this },
    send(d) { this.data = d; return this },
  }
  const parsed = schema ? schema.parse(body) : body
  await handler({ params, body: parsed, query: {}, user: { userId: 'seed' }, propertyId: CURRENT.propertyId, headers: {}, get: () => '' }, res)
  if (res.code >= 400) throw new Error(`${handler.name}: ${res.code} ${res.data?.message || ''}`)
  return res.data
}
const CURRENT = { propertyId: null }

const DAY = 24 * 60 * 60 * 1000
const today = new Date(); today.setHours(12, 0, 0, 0)
const day = (n) => new Date(today.getTime() + n * DAY).toISOString()

// [number, type, daily, monthly, floor]
const ROOMS = [
  ['102', 'Double', 1800, 30000, 1],
  ['103', 'Deluxe', 2500, 45000, 1],
  ['104', 'Suite', 4000, 70000, 1],
  ['201', 'Single', 1200, 22000, 2],
  ['202', 'Double', 1800, 30000, 2],
  ['203', 'Deluxe', 2500, 45000, 2],
]

// Each stay: room, dates (days from today), how it ends up, money, guest.
const STAYS = [
  // Pending (requests not yet confirmed)
  { room: '202', from: 7, to: 9, end: 'Pending', name: 'Aarav Malhotra', source: 'website' },
  { room: '203', from: 12, to: 15, end: 'Pending', name: 'Ishita Rao', source: 'phone', adults: 2 },
  // Confirmed, arriving soon
  { room: '201', from: 1, to: 3, end: 'Confirmed', name: 'Vikram Singh', advance: 'full', source: 'ota' },
  { room: '103', from: 2, to: 5, end: 'Confirmed', name: 'Neha Kulkarni', advance: 2500, adults: 2 },
  { room: '102', from: 4, to: 6, end: 'Confirmed', name: 'Rahul Verma', advance: 1000, source: 'phone' },
  { room: '104', from: 10, to: 12, end: 'Confirmed', name: 'Ananya Iyer', source: 'corporate', adults: 2, children: 1 },
  { room: '201', from: 12, months: 2, end: 'Confirmed', stayType: 'monthly', name: 'Karan Mehta', advance: 22000 },
  // In house (daily)
  { room: '102', from: -2, to: 1, end: 'CheckedIn', name: 'Sanjay Gupta', advance: 2000 },
  { room: '104', from: -1, to: 2, end: 'CheckedIn', name: 'Pooja Nair', advance: 'full', adults: 2 },
  { room: '203', from: -3, to: 0, end: 'CheckedIn', name: 'Arjun Reddy', source: 'ota' },
  { room: '202', from: -1, to: 1, end: 'CheckedIn', name: 'Meera Joshi', advance: 1800 },
  // Checked out
  { room: '201', from: -7, to: -4, end: 'CheckedOut', name: 'Rohit Sharma', advance: 'full' },
  { room: '103', from: -6, to: -3, end: 'CheckedOut', name: 'Divya Menon', advance: 2500, settle: 2500, adults: 2 },
  { room: '102', from: -11, to: -7, end: 'CheckedOut', name: 'Amit Patel', advance: 'full', source: 'referral' },
  // Cancelled and no-show
  { room: '104', from: 17, to: 19, end: 'Cancelled', name: 'Farhan Qureshi', reason: 'Plans changed' },
  { room: '201', from: 6, to: 8, end: 'Cancelled', name: 'Sneha Pillai', reason: 'Booked elsewhere', source: 'ota' },
  { room: '103', from: -2, to: -1, end: 'NoShow', name: 'Rakesh Yadav', source: 'phone' },
]

// PG tenants: one group of two beds and one single bed, all in house.
const TENANCIES = [
  { room: '105', from: -7, occupants: [
    { bedNo: 1, name: 'Kiran Desai', rent: 8500, advance: 8500, deposit: 8500 },
    { bedNo: 2, name: 'Tanvi Shah', rent: 8500, advance: 4000, deposit: 8500 },
  ] },
  { room: '101', from: -5, occupants: [
    { bedNo: 1, name: 'Nikhil Bansal', rent: 6000, advance: 0, deposit: 6000 },
  ] },
]

let phoneSeq = 0
const phone = () => `98${String(76500100 + ++phoneSeq).padStart(8, '0')}`

async function main() {
  const property = await runUnscoped(() => prisma.property.findFirst({
    where: { OR: [{ name: { equals: target, mode: 'insensitive' } }, { code: { equals: target, mode: 'insensitive' } }] },
  }))
  if (!property) throw new Error(`No property named or coded "${target}".`)
  CURRENT.propertyId = property.id

  await runWithProperty(property.id, async () => {
    if (await prisma.booking.count({ where: { notes: SEED_NOTE } })) {
      console.log(`"${property.name}" already has seeded bookings — nothing to do.`)
      return
    }

    // Rooms (skip numbers that already exist)
    const rooms = {}
    for (const r of await prisma.room.findMany({ where: { deletedAt: null } })) rooms[r.number] = r
    for (const [number, typeName, dailyRate, monthlyRate, floor] of ROOMS) {
      if (rooms[number]) continue
      const { room } = await call(createRoom, { body: { number, typeName, dailyRate, monthlyRate, floor, status: 'available' } })
      rooms[number] = room
    }

    const made = { Pending: 0, Confirmed: 0, CheckedIn: 0, CheckedOut: 0, Cancelled: 0, NoShow: 0 }
    for (const s of STAYS) {
      const room = rooms[s.room]
      const monthly = s.stayType === 'monthly'
      const nights = monthly ? 0 : s.to - s.from
      const rate = monthly ? room.monthlyRate : room.dailyRate
      const total = monthly ? rate * s.months : rate * nights
      const body = {
        guestName: s.name, guestPhone: phone(), adults: s.adults || 1, children: s.children || 0,
        idType: 'Aadhaar', idNumber: `XXXX-XXXX-${String(4100 + phoneSeq)}`,
        roomId: room.id, stayType: monthly ? 'monthly' : 'daily',
        fromDate: day(s.from), ...(monthly ? { months: s.months } : { toDate: day(s.to) }),
        roomRate: rate, advance: s.advance === 'full' ? total : s.advance || 0,
        source: s.source || 'walk_in', notes: SEED_NOTE,
      }
      const { booking } = await call(createBooking, { body, schema: schemas.createBooking })
      const id = booking.id
      // New bookings are created confirmed; a request still waiting on the guest
      // is shown as Pending, so set that state directly (no money changes).
      if (s.end === 'Pending') await prisma.booking.update({ where: { id }, data: { status: 'Pending', confirmedAt: null } })
      else if (booking.status === 'Pending') await call(confirmBooking, { params: { id } })
      if (s.end === 'Cancelled') await call(cancelBooking, { params: { id }, body: { reason: s.reason }, schema: schemas.cancelBooking })
      if (s.end === 'NoShow') await call(noShowBooking, { params: { id } })
      if (s.end === 'CheckedIn' || s.end === 'CheckedOut') await call(checkInBooking, { params: { id }, body: {}, schema: schemas.checkInBooking })
      if (s.end === 'CheckedOut') {
        await call(checkOutBooking, {
          params: { id },
          body: { finalPayment: s.settle ?? 0, paymentMethod: 'upi' },
          schema: schemas.checkOutBooking,
        })
      }
      made[s.end]++
    }

    for (const g of TENANCIES) {
      const room = rooms[g.room]
      if (!room) { console.log(`Room ${g.room} not found — skipping its tenants.`); continue }
      const body = {
        roomId: room.id, stayType: 'monthly', fromDate: day(g.from), source: 'walk_in', notes: SEED_NOTE,
        occupants: g.occupants.map((o) => ({
          bedNo: o.bedNo, guestName: o.name, guestPhone: phone(), idType: 'Aadhaar', idNumber: `XXXX-XXXX-${4100 + phoneSeq}`,
          roomRate: o.rent, advance: o.advance, securityDeposit: o.deposit,
        })),
      }
      const res = await call(createBookingGroup, { body, schema: schemas.createBookingGroup })
      for (const b of res.bookings) {
        if (b.status === 'Pending') await call(confirmBooking, { params: { id: b.id } })
        await call(checkInBooking, { params: { id: b.id }, body: {}, schema: schemas.checkInBooking })
        made.CheckedIn++
      }
    }

    const total = Object.values(made).reduce((n, x) => n + x, 0)
    console.log(`Seeded ${total} bookings in "${property.name}":`, made)
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1) })
