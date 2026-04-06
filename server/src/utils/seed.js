/**
 * Database seed script
 * Run: npm run db:seed (from /server)
 * Seeds: default hotel, room types, food plans, amenities, admin user, and sample rooms
 */
import prisma from './prisma.js'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🌱 Seeding Quantum Vorvex database...')

  // Hotel profile
  const hotel = await prisma.hotel.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Quantum Vorvex',
      ownerName: 'Ramesh Gupta',
      phone: '9876543210',
      email: 'manager@quantumvorvex.com',
      gstin: '22AAAAA0000A1Z5',
      licenseNo: 'MH-2024-HOTEL-001',
      address: '123, Hotel Street, Mumbai, Maharashtra - 400001',
      gstRate: 12,
      gstType: 'CGST+SGST',
    },
  })
  console.log('✓ Hotel profile')

  // Room types
  const roomTypes = [
    { name: 'Single', dailyRate: 500, monthlyRate: 9000, peakDailyRate: 700, peakMonthlyRate: 13000, maxOccupancy: 1 },
    { name: 'Double', dailyRate: 800, monthlyRate: 14000, peakDailyRate: 1100, peakMonthlyRate: 20000, maxOccupancy: 2 },
    { name: 'Suite', dailyRate: 1500, monthlyRate: 28000, peakDailyRate: 2200, peakMonthlyRate: 40000, maxOccupancy: 3 },
    { name: 'Deluxe', dailyRate: 1200, monthlyRate: 22000, peakDailyRate: 1800, peakMonthlyRate: 32000, maxOccupancy: 2 },
  ]
  const createdTypes = {}
  for (const rt of roomTypes) {
    const t = await prisma.roomType.upsert({ where: { name: rt.name }, update: rt, create: rt })
    createdTypes[rt.name] = t.id
  }
  console.log('✓ Room types')

  // Sample rooms (3 floors, 8 rooms each = 24 rooms)
  const roomData = [
    // Floor 1
    { number: '101', type: 'Single', floor: 1, status: 'available' },
    { number: '102', type: 'Double', floor: 1, status: 'occupied' },
    { number: '103', type: 'Suite', floor: 1, status: 'maintenance' },
    { number: '104', type: 'Deluxe', floor: 1, status: 'reserved' },
    { number: '105', type: 'Single', floor: 1, status: 'available' },
    { number: '106', type: 'Double', floor: 1, status: 'available' },
    { number: '107', type: 'Single', floor: 1, status: 'occupied' },
    { number: '108', type: 'Single', floor: 1, status: 'available' },
    // Floor 2
    { number: '201', type: 'Single', floor: 2, status: 'available' },
    { number: '202', type: 'Double', floor: 2, status: 'occupied' },
    { number: '203', type: 'Suite', floor: 2, status: 'available' },
    { number: '204', type: 'Deluxe', floor: 2, status: 'occupied' },
    { number: '205', type: 'Single', floor: 2, status: 'available' },
    { number: '206', type: 'Double', floor: 2, status: 'available' },
    { number: '207', type: 'Single', floor: 2, status: 'maintenance' },
    { number: '208', type: 'Single', floor: 2, status: 'available' },
    // Floor 3
    { number: '301', type: 'Single', floor: 3, status: 'available' },
    { number: '302', type: 'Double', floor: 3, status: 'reserved' },
    { number: '303', type: 'Suite', floor: 3, status: 'occupied' },
    { number: '304', type: 'Single', floor: 3, status: 'available' },
    { number: '305', type: 'Single', floor: 3, status: 'available' },
    { number: '306', type: 'Deluxe', floor: 3, status: 'available' },
    { number: '307', type: 'Double', floor: 3, status: 'occupied' },
    { number: '308', type: 'Single', floor: 3, status: 'available' },
  ]

  for (const r of roomData) {
    const typeId = createdTypes[r.type]
    const rates = roomTypes.find(rt => rt.name === r.type)
    await prisma.room.upsert({
      where: { number: r.number },
      update: { status: r.status },
      create: {
        number: r.number,
        typeId,
        floor: r.floor,
        status: r.status,
        dailyRate: rates.dailyRate,
        monthlyRate: rates.monthlyRate,
      },
    })
  }
  console.log('✓ Sample rooms (24)')

  // Food plans
  const foodPlans = [
    { name: 'Breakfast Only', description: 'Morning meal — Idli, Dosa, Poha or Bread + Tea', oneTimeRate: 120, weeklyRate: 700, monthlyRate: 2500 },
    { name: 'All Meals', description: 'Breakfast + Lunch + Dinner — Full board', oneTimeRate: 350, weeklyRate: 2100, monthlyRate: 8000 },
    { name: 'Dinner Only', description: 'Evening meal — Rice, Dal, Sabji, Roti', oneTimeRate: 180, weeklyRate: 1050, monthlyRate: 3500 },
    { name: 'Lunch Only', description: 'Afternoon meal — Thali with 3 items', oneTimeRate: 150, weeklyRate: 900, monthlyRate: 3000 },
    { name: 'No Meals', description: 'Self-catering option', oneTimeRate: 0, weeklyRate: 0, monthlyRate: 0 },
  ]
  for (const fp of foodPlans) {
    await prisma.foodPlan.upsert({ where: { name: fp.name }, update: fp, create: fp })
  }
  console.log('✓ Food plans')

  // Amenities
  const amenities = [
    { name: 'Mini Fridge', dailyRate: 50, monthlyRate: 800, chargeable: true },
    { name: 'Washing Machine', dailyRate: 80, monthlyRate: 1200, chargeable: true },
    { name: 'Parking (Premium)', dailyRate: 100, monthlyRate: 1500, chargeable: true },
    { name: 'Gym Access', dailyRate: 150, monthlyRate: 2000, chargeable: true },
    { name: 'Laundry Service', dailyRate: 200, monthlyRate: 0, chargeable: true },
    { name: 'AC', dailyRate: 0, monthlyRate: 0, chargeable: false },
    { name: 'WiFi', dailyRate: 0, monthlyRate: 0, chargeable: false },
    { name: 'TV', dailyRate: 0, monthlyRate: 0, chargeable: false },
    { name: 'Geyser', dailyRate: 0, monthlyRate: 0, chargeable: false },
  ]
  for (const a of amenities) {
    await prisma.amenity.upsert({ where: { name: a.name }, update: a, create: a })
  }
  console.log('✓ Amenities')

  // Users — owner, manager, staff
  const ownerHash   = await bcrypt.hash('owner123',   12)
  const managerHash = await bcrypt.hash('manager123', 12)
  const staffHash   = await bcrypt.hash('staff123',   12)

  await prisma.user.upsert({
    where: { email: 'owner@quantumvorvex.com' },
    update: { role: 'owner' },
    create: { name: 'Ramesh Gupta', email: 'owner@quantumvorvex.com', password: ownerHash, role: 'owner', phone: '9876543210' },
  })
  await prisma.user.upsert({
    where: { email: 'manager@quantumvorvex.com' },
    update: { role: 'manager' },
    create: { name: 'Priya Sharma', email: 'manager@quantumvorvex.com', password: managerHash, role: 'manager', phone: '9876543211' },
  })
  await prisma.user.upsert({
    where: { email: 'staff@quantumvorvex.com' },
    update: { role: 'staff' },
    create: { name: 'Arjun Patel', email: 'staff@quantumvorvex.com', password: staffHash, role: 'staff', phone: '9876543212' },
  })
  // Keep legacy admin user but upgrade to owner role
  const legacyHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@hotel.com' },
    update: { role: 'owner' },
    create: { name: 'Ramesh Gupta', email: 'admin@hotel.com', password: legacyHash, role: 'owner' },
  })
  console.log('✓ Users seeded:')
  console.log('   Owner:   owner@quantumvorvex.com / owner123')
  console.log('   Manager: manager@quantumvorvex.com / manager123')
  console.log('   Staff:   staff@quantumvorvex.com / staff123')
  console.log('   Legacy:  admin@hotel.com / admin123 (owner)')

  // Sample notifications (check count first to avoid duplicates)
  const notifCount = await prisma.notification.count()
  if (notifCount === 0) {
    await prisma.notification.createMany({
      data: [
        { type: 'warn', message: 'Room 312 payment due in 3 days' },
        { type: 'info', message: 'Room 207 maintenance scheduled tomorrow' },
        { type: 'danger', message: 'ID verification pending for Room 102' },
      ],
    })
  }
  console.log('✓ Sample notifications')

  console.log('\n✅ Database seeded successfully!')
  console.log('   Login: admin@hotel.com / admin123')
}

seed()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
