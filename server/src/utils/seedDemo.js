/**
 * Demo / transactional data seeder.
 *
 * Run:   npm run db:seed:demo            (seeds only if no demo data yet)
 *        npm run db:seed:demo -- --reset (wipes demo tables first, then reseeds)
 *
 * Prerequisite: reference data must already exist — run `npm run db:seed` first
 * (it creates the hotel, room types, rooms, food plans, amenities and users).
 *
 * This script DOES NOT touch reference data (Hotel/RoomType/Room/FoodPlan/Amenity/
 * User). It populates the transactional + operational tables so every module —
 * Guests, Billing (ledger / cash register), Reports (revenue / occupancy), Bookings,
 * Maintenance, Housekeeping, Staff, Communications, Pricing, Templates — shows
 * realistic, internally-consistent data.
 */
import prisma from './prisma.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const RESET = process.argv.includes('--reset')

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAY = 86_400_000
const daysAgo = (n) => new Date(Date.now() - n * DAY)
const daysFromNow = (n) => new Date(Date.now() + n * DAY)
const atTime = (date, hh, mm = 0) => { const d = new Date(date); d.setHours(hh, mm, 0, 0); return d }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const round2 = (n) => Math.round(n * 100) / 100
const tokenHex = () => crypto.randomBytes(16).toString('hex')
const J = (v) => JSON.stringify(v)

// ── Reset (reverse-FK order so deletes never violate a constraint) ──────────────
async function resetDemo() {
  await prisma.maintenanceNote.deleteMany()
  await prisma.maintenanceRequest.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.document.deleteMany()
  await prisma.guestCommunication.deleteMany()
  await prisma.reminder.deleteMany()
  await prisma.bookingDocument.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.roomInspection.deleteMany()
  await prisma.linenRecord.deleteMany()
  await prisma.housekeepingStatus.deleteMany()
  await prisma.staffSession.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.staffProperty.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.competitorRate.deleteMany()
  await prisma.pricingRule.deleteMany()
  await prisma.messageTemplate.deleteMany()
  await prisma.maintenanceSchedule.deleteMany()
  await prisma.guest.deleteMany()
  await prisma.property.deleteMany()
}

async function main() {
  console.log('🌱 Seeding demo data...')

  const rooms = await prisma.room.findMany({ include: { type: true }, orderBy: { number: 'asc' } })
  if (rooms.length === 0) {
    console.error('✗ No rooms found. Run `npm run db:seed` first to create reference data.')
    process.exit(1)
  }
  const hotel = await prisma.hotel.findFirst()
  const gstRate = hotel?.gstRate ?? 12

  if (RESET) {
    await resetDemo()
    console.log('🧹 Cleared existing demo tables')
  } else if ((await prisma.guest.count()) > 0) {
    console.log('ℹ️  Demo data already present — skipping. Re-run with `-- --reset` to rebuild.')
    return
  }

  // Build the GST-consistent invoice math the billing controller uses.
  const invoiceTotals = (rent, food, amen) => {
    const subtotal = rent + food + amen
    const gstAmount = round2((subtotal * gstRate) / 100)
    return { rent, food, amenities: amen, gstRate, gstAmount, total: round2(subtotal + gstAmount) }
  }

  // ─── TIER 1: Independent config ───────────────────────────────────────────────

  // Pricing rules
  await prisma.pricingRule.createMany({
    data: [
      { name: 'High Demand Surge',      triggerType: 'occupancy',   threshold: 80, adjustment: 15,  active: true },
      { name: 'Long Stay Discount',     triggerType: 'stay_length', threshold: 30, adjustment: -10, active: true },
      { name: 'Extended Stay Discount', triggerType: 'stay_length', threshold: 90, adjustment: -20, active: true },
      { name: 'Early Bird Discount',    triggerType: 'lead_time',   threshold: 15, adjustment: -8,  active: false },
    ],
  })

  // Competitor rates
  await prisma.competitorRate.createMany({
    data: [
      { name: 'Hotel Sunrise', roomType: 'Single', theirRate: 650,  recordedDate: daysAgo(2) },
      { name: 'Grand Palms',   roomType: 'Double', theirRate: 1100, recordedDate: daysAgo(5) },
      { name: 'City Inn',      roomType: 'Suite',  theirRate: 1800, recordedDate: daysAgo(1) },
      { name: 'Royal Stay',    roomType: 'Deluxe', theirRate: 1400, recordedDate: daysAgo(3) },
    ],
  })

  // Message templates
  await prisma.messageTemplate.createMany({
    data: [
      { trigger: 'checkin',    content: 'Hi {{guestName}} 👋 Welcome to {{hotelName}}! Room {{roomNumber}}. WiFi: {{wifiPassword}}.', active: true },
      { trigger: 'due',        content: 'Dear {{guestName}}, your payment of ₹{{amount}} for Room {{roomNumber}} is due today.', active: true },
      { trigger: 'overdue_3',  content: 'Dear {{guestName}}, your payment of ₹{{amount}} is 3 days overdue. Please settle soon.', active: true },
      { trigger: 'overdue_7',  content: 'FINAL NOTICE: {{guestName}}, your overdue balance of ₹{{amount}} must be paid immediately.', active: false },
      { trigger: 'bill',       content: 'Dear {{guestName}}, your bill for {{period}} is ready: ₹{{amount}}.', active: true },
    ],
  })

  // Preventive maintenance schedules
  await prisma.maintenanceSchedule.createMany({
    data: [
      { roomType: 'Deluxe', task: 'AC servicing',        frequency: 'Quarterly', assignedTo: 'Ravi Kumar', lastDone: daysAgo(80), nextDue: daysFromNow(10) },
      { roomType: 'Suite',  task: 'Deep cleaning',        frequency: 'Monthly',   assignedTo: 'Meena Nair', lastDone: daysAgo(20), nextDue: daysFromNow(10) },
      { roomType: 'Single', task: 'Geyser inspection',    frequency: 'Half-Yearly', assignedTo: 'Ravi Kumar', lastDone: daysAgo(120), nextDue: daysFromNow(60) },
      { roomType: 'Double', task: 'Pest control',          frequency: 'Quarterly', assignedTo: null, lastDone: daysAgo(70), nextDue: daysFromNow(20) },
    ],
  })
  console.log('✓ Pricing rules, competitors, templates, maintenance schedules')

  // One property + staff (multi-property join table)
  const property = await prisma.property.create({
    data: { name: 'Quantum Vorvex — Main', address: '123, Hotel Street, Mumbai 400001', phone: '9876543210', gstin: hotel?.gstin || null, status: 'active' },
  })

  // Staff (separate from User; roles match the frontend permissions matrix)
  const staffHash = await bcrypt.hash('Welcome@123', 12)
  const staffSeed = [
    { name: 'Priya Sharma', phone: '9876543211', email: 'priya.staff@quantumvorvex.com', role: 'manager',      lastLogin: daysAgo(0) },
    { name: 'Arjun Patel',  phone: '9876543212', email: 'arjun.staff@quantumvorvex.com', role: 'front_desk',   lastLogin: daysAgo(0) },
    { name: 'Meena Nair',   phone: '9876543213', email: 'meena.staff@quantumvorvex.com', role: 'housekeeping', lastLogin: daysAgo(1) },
    { name: 'Ravi Kumar',   phone: '9876543214', email: 'ravi.staff@quantumvorvex.com',  role: 'maintenance',  lastLogin: daysAgo(2) },
    { name: 'Sara Khan',    phone: '9876543215', email: 'sara.staff@quantumvorvex.com',  role: 'accountant',   lastLogin: daysAgo(3) },
  ]
  const staff = []
  for (const s of staffSeed) {
    staff.push(await prisma.staff.create({ data: { ...s, passwordHash: staffHash } }))
  }
  // Link a couple of staff to the property
  await prisma.staffProperty.createMany({
    data: [
      { staffId: staff[0].id, propertyId: property.id },
      { staffId: staff[1].id, propertyId: property.id },
    ],
  })
  // Active sessions for 2 staff → Force Logout demo has something to terminate
  await prisma.staffSession.createMany({
    data: [
      { staffId: staff[0].id, token: tokenHex(), expiresAt: daysFromNow(1) },
      { staffId: staff[1].id, token: tokenHex(), expiresAt: daysFromNow(1) },
    ],
  })
  console.log(`✓ Staff (${staff.length}) + property + sessions`)

  // Permission matrix (mirrors the Staff → Permissions tab; skips 'none')
  const MATRIX = {
    super_admin:  { Dashboard:'Full', Rooms:'Full', 'Check-In':'Full', Guests:'Full', Bookings:'Full', Billing:'Full', Reports:'Full', Settings:'Full', Maintenance:'Full', Housekeeping:'Full', Staff:'Full' },
    manager:      { Dashboard:'Full', Rooms:'Full', 'Check-In':'Full', Guests:'Full', Bookings:'Full', Billing:'Full', Reports:'Full', Settings:'Edit', Maintenance:'Full', Housekeeping:'Full', Staff:'View' },
    front_desk:   { Dashboard:'View', Rooms:'Edit', 'Check-In':'Full', Guests:'Edit', Bookings:'Edit', Billing:'View', Reports:'View', Maintenance:'Create', Housekeeping:'View' },
    housekeeping: { Dashboard:'View', Rooms:'Edit', 'Check-In':'View', Guests:'View', Reports:'View', Maintenance:'Create', Housekeeping:'Full' },
    accountant:   { Dashboard:'View', Rooms:'View', 'Check-In':'View', Guests:'View', Bookings:'View', Billing:'Full', Reports:'Full' },
  }
  const permRows = []
  for (const [role, mods] of Object.entries(MATRIX)) {
    for (const [module, level] of Object.entries(mods)) permRows.push({ role, module, level })
  }
  for (const p of permRows) {
    await prisma.permission.upsert({ where: { role_module: { role: p.role, module: p.module } }, update: { level: p.level }, create: p })
  }

  // Activity log
  const actActions = ['login', 'created booking', 'checked in guest', 'collected payment', 'updated room', 'closed ticket', 'logged out']
  const actModules = ['Auth', 'Bookings', 'Check-In', 'Billing', 'Rooms', 'Maintenance']
  const actLogs = Array.from({ length: 15 }, (_, i) => {
    const member = pick(staff)
    return {
      staffId: member.id, action: pick(actActions), module: pick(actModules),
      recordId: `REC-${1000 + i}`, detail: null, ipAddress: `192.168.1.${10 + i}`, createdAt: daysAgo(i % 14),
    }
  })
  await prisma.activityLog.createMany({ data: actLogs })
  console.log('✓ Permissions matrix + activity log')

  // ─── TIER 2: Guests (room-aware) ────────────────────────────────────────────────
  // Host active guests on the first N rooms and mark those rooms 'occupied' so room
  // status stays consistent with who is actually staying. Remaining rooms host
  // checked-out history. (This is the only place the seeder updates a Room — status only.)
  const activeProfilesCount = 8
  const activeRooms = rooms.slice(0, activeProfilesCount)
  const freeRooms = rooms.slice(activeProfilesCount)

  const activeProfiles = [
    { name: 'Anil Sharma',   gender: 'male',   nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'All Meals',       tags: ['VIP'],        source: 'walk_in' },
    { name: 'Priya Mehta',   gender: 'female', nationality: 'Indian', idType: 'PAN',      foodPlan: 'Breakfast Only',  tags: ['Corporate'],  source: 'corporate' },
    { name: 'Rajesh Kumar',  gender: 'male',   nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'No Meals',        tags: [],             source: 'phone' },
    { name: 'Sunita Verma',  gender: 'female', nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'Dinner Only',     tags: ['Long-term'],  source: 'website' },
    { name: 'Imran Sayed',   gender: 'male',   nationality: 'Indian', idType: 'Passport', foodPlan: 'All Meals',       tags: ['VIP'],        source: 'ota' },
    { name: 'Kavya Reddy',   gender: 'female', nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'Lunch Only',      tags: [],             source: 'referral' },
    { name: 'Deepak Joshi',  gender: 'male',   nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'Breakfast Only',  tags: ['Corporate'],  source: 'corporate' },
    { name: 'Fatima Ali',    gender: 'female', nationality: 'Indian', idType: 'PAN',      foodPlan: 'All Meals',       tags: [],             source: 'walk_in' },
  ]
  const checkedOutProfiles = [
    { name: 'Michael DSouza', gender: 'male',   nationality: 'Indian', idType: 'Passport', foodPlan: 'All Meals',      tags: ['VIP'],       source: 'website' },
    { name: 'Neha Gupta',     gender: 'female', nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'No Meals',       tags: [],            source: 'phone' },
    { name: 'Vijay Singh',    gender: 'male',   nationality: 'Indian', idType: 'Aadhaar',  foodPlan: 'Dinner Only',    tags: ['Corporate'], source: 'walk_in' },
  ]

  let docSeq = 1
  const nextDocId = () => `DOC-${String(docSeq++).padStart(4, '0')}`
  const guests = []

  // Active guests occupy the chosen rooms (status mix: most Active, some Due).
  activeRooms.forEach((room, i) => {
    const p = activeProfiles[i % activeProfiles.length]
    const monthly = i % 2 === 0
    const checkIn = daysAgo(monthly ? 40 : 5)
    guests.push({
      _room: room,
      docId: nextDocId(),
      name: p.name, phone: `98765${String(10000 + i).slice(-5)}`, email: `${p.name.split(' ')[0].toLowerCase()}@example.com`,
      gender: p.gender, nationality: p.nationality, idType: p.idType, idNumber: `${p.idType.slice(0, 3).toUpperCase()}${100000 + i}`,
      tags: J(p.tags), stayType: monthly ? 'monthly' : 'daily', roomId: room.id, checkInDate: checkIn,
      checkOutDate: monthly ? null : daysFromNow(2), months: monthly ? 1 : null,
      roomRate: monthly ? room.monthlyRate : room.dailyRate, deposit: monthly ? 5000 : 2000,
      occupants: 1 + (i % 2), foodPlan: p.foodPlan, status: i % 4 === 3 ? 'Due' : 'Active',
      amenities: J(['WiFi', 'AC']), facilities: J(['Parking']), source: p.source, createdAt: checkIn,
    })
  })

  // Checked-out guests (historical — reference free rooms, room stays available).
  checkedOutProfiles.forEach((p, i) => {
    const room = freeRooms[i % freeRooms.length]
    const checkIn = daysAgo(30 + i * 5)
    guests.push({
      _room: room,
      docId: nextDocId(),
      name: p.name, phone: `99876${String(20000 + i).slice(-5)}`, email: `${p.name.split(' ')[0].toLowerCase()}@example.com`,
      gender: p.gender, nationality: p.nationality, idType: p.idType, idNumber: `${p.idType.slice(0, 3).toUpperCase()}${200000 + i}`,
      tags: J(p.tags), stayType: 'daily', roomId: room.id, checkInDate: checkIn, checkOutDate: daysAgo(20 + i * 5),
      months: null, roomRate: room.dailyRate, deposit: 2000, occupants: 1, foodPlan: p.foodPlan,
      status: 'Checked Out', amenities: J(['WiFi']), facilities: J([]), source: p.source, createdAt: checkIn,
    })
  })

  const createdGuests = []
  for (const g of guests) {
    const { _room, ...data } = g
    createdGuests.push({ room: _room, status: data.status, stayType: data.stayType, roomRate: data.roomRate, foodPlan: data.foodPlan, rec: await prisma.guest.create({ data }) })
  }
  // Mark active guests' rooms occupied (and reflect locally for the housekeeping pass).
  for (const room of activeRooms) {
    await prisma.room.update({ where: { id: room.id }, data: { status: 'occupied' } })
    room.status = 'occupied'
  }
  console.log(`✓ Guests (${createdGuests.length}) — ${activeRooms.length} active rooms marked occupied`)

  // ─── TIER 3: Documents, Invoices, Payments, Communications, Reminders ───────────
  let invSeq = 1
  const nextInvoiceNo = () => `INV-${String(invSeq++).padStart(4, '0')}`

  for (let gi = 0; gi < createdGuests.length; gi++) {
    const { rec: guest, status, stayType, roomRate, foodPlan } = createdGuests[gi]

    // Documents (1–2 per guest, some verified)
    await prisma.document.createMany({
      data: [
        { guestId: guest.id, docType: guest.idType || 'Aadhaar', url: `/uploads/demo-id-${gi}.jpg`, verified: true, uploadedAt: guest.createdAt },
        ...(gi % 2 === 0 ? [{ guestId: guest.id, docType: 'Photo', url: `/uploads/demo-photo-${gi}.jpg`, verified: gi % 3 !== 0, uploadedAt: guest.createdAt }] : []),
      ],
    })

    // Invoices — the first active guest gets 3 (rich ledger); others get 1.
    const invoiceCount = gi === 0 ? 3 : 1
    for (let k = 0; k < invoiceCount; k++) {
      const rent = stayType === 'monthly' ? roomRate : roomRate * 7
      const food = foodPlan === 'No Meals' ? 0 : pick([2500, 3000, 4500])
      const amen = pick([0, 500, 800])
      const t = invoiceTotals(rent, food, amen)
      const createdAt = daysAgo(35 - gi * 2 - k * 12)
      // Checked-out guests fully paid; active mix paid/pending; older invoices paid.
      const paid = status === 'Checked Out' || k < invoiceCount - 1 || gi % 3 !== 0
      const paidAt = paid ? daysAgo(33 - gi * 2 - k * 12) : null
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNo: nextInvoiceNo(), guestId: guest.id,
          period: `${createdAt.toLocaleString('en-IN', { month: 'short' })} ${createdAt.getFullYear()}`,
          ...t, amountPaid: paid ? t.total : 0, status: paid ? 'Paid' : 'Pending', createdAt, paidAt,
        },
      })
      if (paid) {
        await prisma.payment.create({
          data: { guestId: guest.id, invoiceId: invoice.id, amount: t.total, method: pick(['cash', 'upi', 'card']), type: 'collection', reference: invoice.invoiceNo, createdAt: paidAt },
        })
      }
    }

    // Communications (2–3 for the first few guests)
    if (gi < 5) {
      await prisma.guestCommunication.createMany({
        data: [
          { guestId: guest.id, channel: 'whatsapp', direction: 'outbound', content: `Welcome message sent to ${guest.name}.`, staff: 'Front Desk', createdAt: guest.createdAt },
          { guestId: guest.id, channel: 'call', direction: 'outbound', content: 'Confirmed late checkout request.', staff: 'Priya Sharma', createdAt: daysAgo(2) },
        ],
      })
      await prisma.reminder.create({
        data: { guestId: guest.id, channel: 'whatsapp', message: 'Your payment is due soon.', status: 'sent', sentAt: daysAgo(1) },
      })
    }
  }

  // Today's cash-register movements (so the default date view shows all 3 types).
  const firstGuest = createdGuests[0].rec
  const aPaidInvoice = await prisma.invoice.findFirst({ where: { status: 'Paid' } })
  await prisma.payment.createMany({
    data: [
      { guestId: firstGuest.id, invoiceId: aPaidInvoice?.id || null, amount: 5000, method: 'cash', type: 'collection', reference: 'Front desk', createdAt: atTime(new Date(), 9, 15) },
      { guestId: firstGuest.id, amount: 10000, method: 'upi', type: 'advance', reference: 'Advance booking', createdAt: atTime(new Date(), 11, 30) },
      { guestId: createdGuests[1].rec.id, amount: 2000, method: 'cash', type: 'refund', reference: 'Deposit refund', createdAt: atTime(new Date(), 16, 45) },
    ],
  })
  console.log('✓ Documents, invoices, payments, communications, reminders')

  // ─── TIER 4: Bookings ───────────────────────────────────────────────────────────
  let bkgSeq = 1001
  const nextBookingNo = () => `BKG-${bkgSeq++}`
  const bookingPlan = [
    { status: 'Pending',   from: 3,   to: 6,    pay: 'unpaid' },
    { status: 'Pending',   from: 7,   to: 9,    pay: 'partial' },
    { status: 'Confirmed', from: 2,   to: 5,    pay: 'partial' },
    { status: 'Confirmed', from: 5,   to: 8,    pay: 'paid' },
    { status: 'Confirmed', from: 10,  to: 12,   pay: 'unpaid' },
    { status: 'CheckedIn', from: -1,  to: 3,    pay: 'paid' },
    { status: 'CheckedIn', from: -2,  to: 2,    pay: 'partial' },
    { status: 'CheckedOut',from: -8,  to: -2,   pay: 'paid' },
    { status: 'CheckedOut',from: -14, to: -7,   pay: 'paid' },
    { status: 'Cancelled', from: -3,  to: 1,    pay: 'unpaid' },
    { status: 'NoShow',    from: -4,  to: -2,   pay: 'unpaid' },
    { status: 'Confirmed', from: 1,   to: 4,    pay: 'partial' },
  ]
  const bkNames = ['Rohit Bansal', 'Anjali Singh', 'Karan Malhotra', 'Sneha Iyer', 'Aman Gupta', 'Divya Rao', 'Nikhil Jain', 'Pooja Desai', 'Suresh Nair', 'Tara Bose', 'Manish Agarwal', 'Lata Pillai']
  for (let i = 0; i < bookingPlan.length; i++) {
    const b = bookingPlan[i]
    const room = rooms[i % rooms.length]
    const nights = b.to - b.from
    const roomRate = room.dailyRate
    const subtotal = roomRate * Math.max(1, nights)
    const taxAmount = round2((subtotal * gstRate) / 100)
    const amount = round2(subtotal + taxAmount)
    const advance = b.pay === 'paid' ? amount : b.pay === 'partial' ? round2(amount / 2) : 0
    const fromDate = daysFromNow(b.from)
    const created = await prisma.booking.create({
      data: {
        bookingNo: nextBookingNo(), guestName: bkNames[i], guestPhone: `90000${String(10000 + i).slice(-5)}`,
        guestEmail: `${bkNames[i].split(' ')[0].toLowerCase()}@example.com`, adults: 1 + (i % 3), children: i % 2,
        roomId: room.id, stayType: 'daily', fromDate, toDate: daysFromNow(b.to), nights: Math.max(1, nights),
        roomRate, subtotal, taxRate: gstRate, taxAmount, amount, advance, balance: round2(amount - advance),
        paymentStatus: b.pay, source: pick(['walk_in', 'phone', 'website', 'ota']), status: b.status,
        confirmedAt: ['Confirmed', 'CheckedIn', 'CheckedOut'].includes(b.status) ? daysAgo(1) : null,
        checkedInAt: ['CheckedIn', 'CheckedOut'].includes(b.status) ? fromDate : null,
        checkedOutAt: b.status === 'CheckedOut' ? daysFromNow(b.to) : null,
        cancelledAt: b.status === 'Cancelled' ? daysAgo(1) : null,
        cancelReason: b.status === 'Cancelled' ? 'Guest cancelled' : null,
      },
    })
    // KYC docs for a couple of bookings
    if (i < 3) {
      await prisma.bookingDocument.createMany({
        data: [
          { bookingId: created.id, docType: 'ID Front', url: `/uploads/bk-${i}-front.jpg`, verified: true },
          { bookingId: created.id, docType: 'ID Back',  url: `/uploads/bk-${i}-back.jpg`,  verified: i % 2 === 0 },
        ],
      })
    }
  }
  console.log(`✓ Bookings (${bookingPlan.length}) + booking documents`)

  // ─── TIER 5: Maintenance ──────────────────────────────────────────────────────
  let tktSeq = 1
  const nextTicketNo = () => `TKT-${String(tktSeq++).padStart(4, '0')}`
  const maint = [
    { cat: 'HVAC',        title: 'AC not cooling',          prio: 'High',   status: 'Open' },
    { cat: 'Plumbing',    title: 'Leaking bathroom tap',     prio: 'Medium', status: 'In Progress' },
    { cat: 'Electrical',  title: 'Power socket not working', prio: 'Urgent', status: 'Open' },
    { cat: 'Furniture',   title: 'Broken chair',             prio: 'Low',    status: 'Resolved' },
    { cat: 'Housekeeping',title: 'Stained carpet',           prio: 'Low',    status: 'In Progress' },
    { cat: 'Plumbing',    title: 'Geyser not heating',       prio: 'High',   status: 'Resolved' },
    { cat: 'Other',       title: 'WiFi router reset needed',  prio: 'Medium', status: 'Open' },
    { cat: 'HVAC',        title: 'Noisy AC compressor',       prio: 'Medium', status: 'In Progress' },
  ]
  const techs = ['Ravi Kumar', 'Meena Nair', null]
  for (let i = 0; i < maint.length; i++) {
    const m = maint[i]
    const room = rooms[i % rooms.length]
    const createdAt = daysAgo(i + 1)
    const ticket = await prisma.maintenanceRequest.create({
      data: {
        ticketNo: nextTicketNo(), roomId: room.id, category: m.cat, title: m.title,
        description: `${m.title} reported in room ${room.number}.`, priority: m.prio,
        reportedBy: pick(['Front Desk', `Guest – Room ${room.number}`]),
        assignedTo: m.status === 'Open' ? null : pick(techs.filter(Boolean)),
        status: m.status, createdAt, resolvedAt: m.status === 'Resolved' ? daysAgo(i % 3) : null,
      },
    })
    if (m.status !== 'Open') {
      await prisma.maintenanceNote.create({
        data: { requestId: ticket.id, author: pick(['Ravi Kumar', 'Meena Nair']), content: m.status === 'Resolved' ? 'Issue fixed and verified.' : 'Work in progress, parts ordered.', createdAt: daysAgo(i % 3) },
      })
    }
  }
  console.log(`✓ Maintenance tickets (${maint.length}) + notes`)

  // ─── Housekeeping (one status per room, consistent with room.status) + linen ────
  const hkByRoomStatus = (s) => {
    if (s === 'occupied')    return pick(['clean_available', 'cleaning_in_progress'])
    if (s === 'maintenance') return 'dirty_available'
    if (s === 'reserved')    return 'clean_available'
    return pick(['clean_available', 'clean_available', 'dirty_available', 'checkout_pending'])
  }
  const housekeepers = ['Meena Nair', 'Ravi Kumar', null]
  for (const room of rooms) {
    const status = hkByRoomStatus(room.status)
    const inProgress = status === 'cleaning_in_progress'
    await prisma.housekeepingStatus.upsert({
      where: { roomId: room.id },
      update: { status },
      create: {
        roomId: room.id, status,
        assignedTo: status === 'clean_available' ? null : pick(housekeepers),
        startedAt: inProgress ? atTime(new Date(), 10) : null,
        completedAt: null,
      },
    })
  }
  // Linen records + a couple of inspections for the first few rooms
  for (let i = 0; i < Math.min(6, rooms.length); i++) {
    await prisma.linenRecord.create({
      data: { roomId: rooms[i].id, lastChanged: daysAgo(i + 1), nextDue: daysFromNow(7 - i), changedBy: pick(['Meena Nair', 'Ravi Kumar']) },
    })
  }
  for (let i = 0; i < 3; i++) {
    await prisma.roomInspection.create({
      data: { roomId: rooms[i].id, staffId: staff[2].id, checklist: J([
        { item: 'Bedsheets clean', ok: true }, { item: 'Bathroom sanitized', ok: true },
        { item: 'Minibar stocked', ok: i !== 1 }, { item: 'AC working', ok: true },
      ]), createdAt: daysAgo(i) },
    })
  }
  console.log(`✓ Housekeeping statuses (${rooms.length}) + linen + inspections`)

  // ─── Extra notifications ────────────────────────────────────────────────────────
  const notifCount = await prisma.notification.count()
  if (notifCount < 5) {
    await prisma.notification.createMany({
      data: [
        { type: 'success', message: 'Payment of ₹7,280 collected for INV-0001' },
        { type: 'warn', message: 'Room 105 maintenance overdue by 2 days' },
        { type: 'info', message: 'New booking BKG-1003 received' },
      ],
    })
  }

  console.log('\n✅ Demo data seeded successfully!')
}

main()
  .catch((e) => { console.error('✗ Demo seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
