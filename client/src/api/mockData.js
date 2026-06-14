/**
 * Mock data for frontend demo mode (VITE_MOCK=true).
 * No backend required — axios adapter intercepts all requests.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
const d = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString()
const uid = (n) => `mock-${n}`

// ── Core data ─────────────────────────────────────────────────────────────────
export const MOCK_USER = {
  id: uid('user-1'),
  name: 'Ramesh Gupta',
  email: 'owner@quantumvorvex.com',
  role: 'owner',
  phone: '+91 98765 43210',
  status: 'active',
}

export const MOCK_TOKEN = 'mock.jwt.token'

const ROOMS = [
  { id: uid('r1'), number: '101', type: 'Standard',  floor: 1, dailyRate: 1800,  monthlyRate: 45000,  status: 'occupied',    maxOccupancy: 2 },
  { id: uid('r2'), number: '102', type: 'Standard',  floor: 1, dailyRate: 1800,  monthlyRate: 45000,  status: 'available',   maxOccupancy: 2 },
  { id: uid('r3'), number: '103', type: 'Standard',  floor: 1, dailyRate: 1800,  monthlyRate: 45000,  status: 'available',   maxOccupancy: 2 },
  { id: uid('r4'), number: '104', type: 'Deluxe',    floor: 1, dailyRate: 2800,  monthlyRate: 70000,  status: 'occupied',    maxOccupancy: 3 },
  { id: uid('r5'), number: '105', type: 'Deluxe',    floor: 1, dailyRate: 2800,  monthlyRate: 70000,  status: 'maintenance', maxOccupancy: 3 },
  { id: uid('r6'), number: '201', type: 'Deluxe',    floor: 2, dailyRate: 3200,  monthlyRate: 80000,  status: 'available',   maxOccupancy: 3 },
  { id: uid('r7'), number: '202', type: 'Suite',     floor: 2, dailyRate: 5500,  monthlyRate: 138000, status: 'occupied',    maxOccupancy: 4 },
  { id: uid('r8'), number: '203', type: 'Suite',     floor: 2, dailyRate: 5500,  monthlyRate: 138000, status: 'available',   maxOccupancy: 4 },
  { id: uid('r9'), number: '301', type: 'Executive', floor: 3, dailyRate: 8000,  monthlyRate: 200000, status: 'reserved',    maxOccupancy: 2 },
  { id: uid('r10'),number: '302', type: 'Executive', floor: 3, dailyRate: 8000,  monthlyRate: 200000, status: 'available',   maxOccupancy: 2 },
  { id: uid('r11'),number: '303', type: 'Standard',  floor: 3, dailyRate: 1800,  monthlyRate: 45000,  status: 'available',   maxOccupancy: 2 },
  { id: uid('r12'),number: '401', type: 'Suite',     floor: 4, dailyRate: 6200,  monthlyRate: 155000, status: 'occupied',    maxOccupancy: 4 },
]

const GUESTS = [
  { id: uid('g1'), name: 'Anil Sharma',      email: 'anil@example.com',   phone: '9876543201', roomNumber: '101', roomId: uid('r1'),  checkIn: d(3),  checkOut: d(-2), stayType: 'daily',   status: 'checked_in',  nationality: 'Indian', tags: ['VIP'] },
  { id: uid('g2'), name: 'Priya Mehta',      email: 'priya@example.com',  phone: '9876543202', roomNumber: '104', roomId: uid('r4'),  checkIn: d(7),  checkOut: d(-3), stayType: 'monthly', status: 'checked_in',  nationality: 'Indian', tags: ['Corporate'] },
  { id: uid('g3'), name: 'Rajesh Kumar',     email: 'rajesh@example.com', phone: '9876543203', roomNumber: '202', roomId: uid('r7'),  checkIn: d(1),  checkOut: d(-4), stayType: 'daily',   status: 'checked_in',  nationality: 'Indian', tags: [] },
  { id: uid('g4'), name: 'Sunita Verma',     email: 'sunita@example.com', phone: '9876543204', roomNumber: '401', roomId: uid('r12'), checkIn: d(14), checkOut: d(-1), stayType: 'monthly', status: 'checked_in',  nationality: 'Indian', tags: ['Long-term'] },
  { id: uid('g5'), name: 'Michael D\'Souza', email: 'mike@example.com',   phone: '9876543205', roomNumber: '',    roomId: null,       checkIn: d(20), checkOut: d(10), stayType: 'daily',   status: 'checked_out', nationality: 'Indian', tags: ['VIP'] },
  { id: uid('g6'), name: 'Kavya Reddy',      email: 'kavya@example.com',  phone: '9876543206', roomNumber: '',    roomId: null,       checkIn: d(30), checkOut: d(25), stayType: 'daily',   status: 'checked_out', nationality: 'Indian', tags: [] },
]

const INVOICES = [
  { id: uid('inv1'), invoiceNumber: 'INV-2026-001', guestId: uid('g1'), guestName: 'Anil Sharma',      roomNumber: '101', stayType: 'daily',   period: '3 days',   rentAmount: 5400,  foodAmount: 900,  amenitiesAmount: 200, gstRate: 12, gstAmount: 780,  totalAmount: 7280,  status: 'pending', createdAt: d(3) },
  { id: uid('inv2'), invoiceNumber: 'INV-2026-002', guestId: uid('g2'), guestName: 'Priya Mehta',      roomNumber: '104', stayType: 'monthly', period: '1 month',  rentAmount: 70000, foodAmount: 4500, amenitiesAmount: 0,   gstRate: 12, gstAmount: 8940, totalAmount: 83440, status: 'paid',    createdAt: d(7),  paidAt: d(5) },
  { id: uid('inv3'), invoiceNumber: 'INV-2026-003', guestId: uid('g5'), guestName: "Michael D'Souza",  roomNumber: '203', stayType: 'daily',   period: '10 days',  rentAmount: 55000, foodAmount: 2200, amenitiesAmount: 500, gstRate: 12, gstAmount: 6924, totalAmount: 64624, status: 'paid',    createdAt: d(20), paidAt: d(18) },
  { id: uid('inv4'), invoiceNumber: 'INV-2026-004', guestId: uid('g3'), guestName: 'Rajesh Kumar',     roomNumber: '202', stayType: 'daily',   period: '1 day',    rentAmount: 5500,  foodAmount: 0,    amenitiesAmount: 0,   gstRate: 12, gstAmount: 660,  totalAmount: 6160,  status: 'pending', createdAt: d(1) },
  { id: uid('inv5'), invoiceNumber: 'INV-2026-005', guestId: uid('g6'), guestName: 'Kavya Reddy',      roomNumber: '101', stayType: 'daily',   period: '5 days',   rentAmount: 9000,  foodAmount: 1500, amenitiesAmount: 300, gstRate: 12, gstAmount: 1296, totalAmount: 12096, status: 'overdue', createdAt: d(30) },
]

// Seed booking data removed — bookings now come from the real API/database.
// (Only used if VITE_MOCK=true; left empty so no demo bookings ever appear.)
const BOOKINGS = []

const NOTIFICATIONS = [
  { id: uid('n1'), type: 'warn',    title: 'Room 105 Maintenance Due',  message: 'AC servicing overdue by 3 days.',          createdAt: d(0), dismissed: false },
  { id: uid('n2'), type: 'info',    title: 'New Booking Received',       message: 'Booking from Anjali Singh for Room 103.',  createdAt: d(0), dismissed: false },
  { id: uid('n3'), type: 'success', title: 'Invoice Paid',               message: 'INV-2026-002 paid by Priya Mehta.',        createdAt: d(1), dismissed: false },
  { id: uid('n4'), type: 'danger',  title: 'Overdue Invoice',            message: 'INV-2026-005 overdue — Kavya Reddy.',     createdAt: d(2), dismissed: false },
]

const FOOD_PLANS = [
  { id: uid('fp1'), name: 'Breakfast Only',  price: 150, description: 'Continental breakfast served 7–10 AM' },
  { id: uid('fp2'), name: 'All Meals',       price: 450, description: 'Breakfast, lunch & dinner included' },
  { id: uid('fp3'), name: 'Dinner Only',     price: 220, description: 'Dinner served 7–10 PM' },
  { id: uid('fp4'), name: 'No Meals',        price: 0,   description: 'Room only, no meals included' },
]

const FOOD_ORDERS = [
  { id: uid('fo1'), guestName: 'Anil Sharma',  roomNumber: '101', planName: 'Breakfast Only', date: d(0), status: 'delivered' },
  { id: uid('fo2'), guestName: 'Priya Mehta',  roomNumber: '104', planName: 'All Meals',       date: d(0), status: 'pending' },
  { id: uid('fo3'), guestName: 'Rajesh Kumar', roomNumber: '202', planName: 'No Meals',        date: d(0), status: 'n/a' },
]

// Shaped to match the real GET /settings response: a Hotel record plus the
// related RoomType / FoodPlan / Amenity collections.
const SETTINGS_HOTEL = {
  id: uid('hotel'),
  name: 'Quantum Vorvex',
  ownerName: 'Ramesh Gupta',
  phone: '+91 98765 43210',
  email: 'contact@quantumvorvex.com',
  address: '12, MG Road, Bengaluru, Karnataka 560001',
  gstin: '29AADCB2230M1ZP',
  licenseNo: 'KA-2024-HOTEL-001',
  logoUrl: null,
  gstRate: 12,
  gstType: 'CGST+SGST',
  gstApplyOn: 'All',
  lateFeeRate: 5,
  gracePeriod: 3,
}

const SETTINGS_ROOM_TYPES = [
  { id: uid('rt'), name: 'Single', dailyRate: 500,  monthlyRate: 9000,  peakDailyRate: 700,  peakMonthlyRate: 13000, maxOccupancy: 1 },
  { id: uid('rt'), name: 'Double', dailyRate: 800,  monthlyRate: 14000, peakDailyRate: 1100, peakMonthlyRate: 20000, maxOccupancy: 2 },
]

const SETTINGS_FOOD_PLANS = [
  { id: uid('fp'), name: 'Breakfast Only', oneTimeRate: 120, weeklyRate: 700,  monthlyRate: 2500, description: 'Morning meal' },
  { id: uid('fp'), name: 'All Meals',      oneTimeRate: 350, weeklyRate: 2100, monthlyRate: 8000, description: 'Full board'    },
]

const SETTINGS_AMENITIES = [
  { id: uid('am'), name: 'Mini Fridge',     dailyRate: 50, monthlyRate: 800,  chargeable: true },
  { id: uid('am'), name: 'Washing Machine', dailyRate: 80, monthlyRate: 1200, chargeable: true },
]

const DOCUMENTS = [
  { id: uid('d1'), guestId: uid('g1'), guestName: 'Anil Sharma',  type: 'Aadhaar', fileName: 'aadhaar_anil.pdf',  verified: true,  uploadedAt: d(3) },
  { id: uid('d2'), guestId: uid('g2'), guestName: 'Priya Mehta',  type: 'PAN',     fileName: 'pan_priya.pdf',     verified: true,  uploadedAt: d(7) },
  { id: uid('d3'), guestId: uid('g3'), guestName: 'Rajesh Kumar', type: 'Aadhaar', fileName: 'aadhaar_rajesh.pdf',verified: false, uploadedAt: d(1) },
]

const DASHBOARD = {
  totalRooms: ROOMS.length,
  availableRooms: ROOMS.filter(r => r.status === 'available').length,
  occupiedRooms: ROOMS.filter(r => r.status === 'occupied').length,
  maintenanceRooms: ROOMS.filter(r => r.status === 'maintenance').length,
  reservedRooms: ROOMS.filter(r => r.status === 'reserved').length,
  monthlyRevenue: 241600,
  occupancyRate: Math.round((ROOMS.filter(r => r.status === 'occupied').length / ROOMS.length) * 100),
  revenueChart: [
    { month: 'Nov', revenue: 182000 },
    { month: 'Dec', revenue: 215000 },
    { month: 'Jan', revenue: 198000 },
    { month: 'Feb', revenue: 229000 },
    { month: 'Mar', revenue: 241600 },
    { month: 'Apr', revenue: 195000 },
  ],
  occupancyChart: [
    { month: 'Nov', rate: 58 },
    { month: 'Dec', rate: 72 },
    { month: 'Jan', rate: 65 },
    { month: 'Feb', rate: 78 },
    { month: 'Mar', rate: 83 },
    { month: 'Apr', rate: 67 },
  ],
  recentCheckIns: GUESTS.filter(g => g.status === 'checked_in').slice(0, 4),
  upcomingCheckouts: GUESTS.filter(g => g.status === 'checked_in').slice(0, 3),
}

const REVENUE = {
  totalRevenue: 241600,
  roomRevenue: 210000,
  foodRevenue: 18600,
  amenitiesRevenue: 13000,
  breakdown: [
    { category: 'Room Rent',  amount: 210000 },
    { category: 'Food',       amount: 18600 },
    { category: 'Amenities', amount: 13000 },
  ],
}

const GST_REPORT = {
  period: 'March 2026',
  totalTaxableAmount: 241600,
  cgst: 14496,
  sgst: 14496,
  totalGst: 28992,
  invoices: INVOICES,
}

const STAFF_USERS = [
  { id: uid('u1'), name: 'Ramesh Gupta',    email: 'owner@quantumvorvex.com',   role: 'owner',   phone: '+91 98765 43210', status: 'active',   createdAt: d(90) },
  { id: uid('u2'), name: 'Sita Sharma',     email: 'manager@quantumvorvex.com', role: 'manager', phone: '+91 97654 32109', status: 'active',   createdAt: d(60) },
  { id: uid('u3'), name: 'Ravi Patel',      email: 'staff@quantumvorvex.com',   role: 'staff',   phone: '+91 96543 21098', status: 'active',   createdAt: d(30) },
  { id: uid('u4'), name: 'Meena Nair',      email: 'meena@quantumvorvex.com',   role: 'staff',   phone: '+91 95432 10987', status: 'active',   createdAt: d(15) },
  { id: uid('u5'), name: 'Arjun Desai',     email: 'arjun@quantumvorvex.com',   role: 'staff',   phone: '+91 94321 09876', status: 'inactive', createdAt: d(45) },
]

const MAINTENANCE = [
  { id: uid('m1'), roomNumber: '105', title: 'AC Servicing',        description: 'AC unit needs gas refill and filter cleaning.', priority: 'high',   status: 'pending',     assignedTo: 'Ravi Patel',  createdAt: d(3) },
  { id: uid('m2'), roomNumber: '201', title: 'Geyser Repair',       description: 'Geyser not heating water properly.',            priority: 'medium', status: 'in_progress', assignedTo: 'Ravi Patel',  createdAt: d(1) },
  { id: uid('m3'), roomNumber: '303', title: 'WiFi Router Reset',   description: 'WiFi signal weak in room 303.',                priority: 'low',    status: 'completed',   assignedTo: 'Meena Nair', createdAt: d(5) },
  { id: uid('m4'), roomNumber: '401', title: 'Window Latch Broken', description: 'Bathroom window latch needs replacement.',     priority: 'medium', status: 'pending',     assignedTo: null,          createdAt: d(0) },
]

const HOUSEKEEPING = [
  { id: uid('hk1'), roomNumber: '101', status: 'clean',    assignedTo: 'Meena Nair', lastCleaned: d(0), notes: '' },
  { id: uid('hk2'), roomNumber: '102', status: 'dirty',    assignedTo: 'Meena Nair', lastCleaned: d(1), notes: 'Guest checked out' },
  { id: uid('hk3'), roomNumber: '104', status: 'clean',    assignedTo: 'Ravi Patel', lastCleaned: d(0), notes: '' },
  { id: uid('hk4'), roomNumber: '202', status: 'cleaning', assignedTo: 'Ravi Patel', lastCleaned: d(0), notes: 'In progress' },
  { id: uid('hk5'), roomNumber: '203', status: 'dirty',    assignedTo: null,         lastCleaned: d(2), notes: 'Needs deep clean' },
  { id: uid('hk6'), roomNumber: '401', status: 'clean',    assignedTo: 'Meena Nair', lastCleaned: d(0), notes: '' },
]

// ── Frontend-only feature mocks (ledger / cash register / occupancy / etc.) ─────
const LEDGER_ENTRIES = [
  { date: d(40).split('T')[0], type: 'Debit',  desc: 'Room Rent — Mar 2026 (INV-2026-001)', amount: 9000,  balance: -9000  },
  { date: d(40).split('T')[0], type: 'Debit',  desc: 'GST (12%)',                            amount: 1080,  balance: -10080 },
  { date: d(10).split('T')[0], type: 'Credit', desc: 'Payment Received — UPI',               amount: 10080, balance: 0      },
]

const CASH_TXNS = [
  { time: '09:15', type: 'collection', method: 'cash', desc: 'Collection — INV-2026-001 — Anil Sharma', cashIn: 7280,  cashOut: 0    },
  { time: '11:30', type: 'advance',    method: 'upi',  desc: 'Advance — Rajesh Kumar',                  cashIn: 5000,  cashOut: 0    },
  { time: '16:45', type: 'refund',     method: 'cash', desc: 'Refund — Kavya Reddy',                    cashIn: 0,     cashOut: 2000 },
]

const OCCUPANCY = {
  totalRooms: ROOMS.length,
  avgRate: 64.5,
  byDay: Array.from({ length: 14 }, (_, i) => ({
    date: d(13 - i).split('T')[0],
    occupied: 6 + (i % 4),
    total: ROOMS.length,
    rate: parseFloat((((6 + (i % 4)) / ROOMS.length) * 100).toFixed(1)),
  })),
  byRoomType: [
    { roomType: 'Standard',  total: 4, occupied: 1, rate: 25.0 },
    { roomType: 'Deluxe',    total: 3, occupied: 1, rate: 33.3 },
    { roomType: 'Suite',     total: 3, occupied: 2, rate: 66.7 },
    { roomType: 'Executive', total: 2, occupied: 0, rate: 0.0  },
  ],
}

const GUEST_COMMS = [
  { id: uid('comm1'), channel: 'whatsapp', direction: 'outbound', subject: null, content: 'Welcome message sent.',      staff: 'Front Desk', createdAt: d(3) },
  { id: uid('comm2'), channel: 'call',     direction: 'outbound', subject: null, content: 'Confirmed late checkout.',    staff: 'Sita Sharma', createdAt: d(1) },
]

const COMPETITORS = [
  { id: uid('comp1'), name: 'Hotel Taj',     roomType: 'Deluxe', theirRate: 4500, recordedDate: d(2) },
  { id: uid('comp2'), name: 'Grand Plaza',   roomType: 'Suite',  theirRate: 6800, recordedDate: d(5) },
]

const REMINDER_TEMPLATES = [
  { id: uid('tpl1'), trigger: 'welcome',       content: 'Welcome {{name}}! Your room is ready.', active: true },
  { id: uid('tpl2'), trigger: 'checkout_due',  content: 'Hi {{name}}, checkout is at 11 AM.',    active: true },
  { id: uid('tpl3'), trigger: 'payment_due',   content: 'Reminder: payment of {{amount}} due.',  active: false },
]

// ── Route matcher ─────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms))

export async function getMockResponse(method, url) {
  await delay(280) // simulate realistic network latency

  const m = method?.toLowerCase()
  const path = url?.replace(/^\/api\/v1/, '').replace(/^\/v1/, '').split('?')[0]

  // Auth
  if (path === '/auth/login')  return { message: 'Login successful.', token: MOCK_TOKEN, user: MOCK_USER }
  if (path === '/auth/logout') return { message: 'Logged out.' }
  if (path === '/auth/me')     return { user: MOCK_USER }

  // Rooms
  if (path === '/rooms' && m === 'get')  return { rooms: ROOMS, total: ROOMS.length }
  if (path === '/rooms' && m === 'post') return { room: { id: uid('r-new'), ...{}, status: 'available' }, message: 'Room created.' }
  if (path.match(/^\/rooms\/[^/]+$/) && m === 'put')    return { room: ROOMS[0], message: 'Room updated.' }
  if (path.match(/^\/rooms\/[^/]+$/) && m === 'delete') return { message: 'Room deleted.' }

  // Guests
  if (path === '/guests' && m === 'get')  return { guests: GUESTS, total: GUESTS.length }
  if (path === '/guests' && m === 'post') return { guest: { id: uid('g-new'), status: 'checked_in' }, message: 'Guest checked in.' }
  if (path.match(/^\/guests\/[^/]+\/checkout$/))       return { message: 'Checked out successfully.' }
  if (path.match(/^\/guests\/[^/]+\/renew$/))          return { guest: { ...GUESTS[0], stayCount: 2 }, message: 'Stay renewed successfully.' }
  if (path.match(/^\/guests\/[^/]+\/communications$/) && m === 'get')  return { communications: GUEST_COMMS }
  if (path.match(/^\/guests\/[^/]+\/communications$/) && m === 'post') return { communication: { id: uid('comm-new'), channel: 'note', direction: 'outbound', content: 'Logged.', createdAt: d(0) } }
  if (path.match(/^\/guests\/[^/]+$/) && m === 'get')  return { guest: GUESTS[0] }
  if (path.match(/^\/guests\/[^/]+$/) && m === 'put')  return { guest: GUESTS[0], message: 'Updated.' }

  // Billing
  if (path === '/billing' && m === 'get')          return { invoices: INVOICES, total: INVOICES.length }
  if (path === '/billing/ledger')        return { guest: { id: GUESTS[0].id, name: GUESTS[0].name, docId: 'DOC-0001' }, entries: LEDGER_ENTRIES, closingBalance: LEDGER_ENTRIES.length ? LEDGER_ENTRIES[LEDGER_ENTRIES.length - 1].balance : 0 }
  if (path === '/billing/cash-register') return { date: d(0).split('T')[0], transactions: CASH_TXNS, totalIn: CASH_TXNS.reduce((s, t) => s + t.cashIn, 0), totalOut: CASH_TXNS.reduce((s, t) => s + t.cashOut, 0), net: CASH_TXNS.reduce((s, t) => s + t.cashIn - t.cashOut, 0) }
  if (path === '/billing/generate' && m === 'post') return { invoice: INVOICES[0], message: 'Invoice generated.' }
  if (path.match(/^\/billing\/[^/]+\/collect$/))   return { invoice: { ...INVOICES[0], status: 'paid' }, message: 'Payment collected.' }
  if (path.match(/^\/billing\/[^/]+\/pdf$/))        return new Blob(['Mock PDF'], { type: 'application/pdf' })

  // Bookings
  if (path === '/bookings' && m === 'get')  return { bookings: BOOKINGS, total: BOOKINGS.length }
  if (path === '/bookings' && m === 'post') return { booking: { id: uid('bnew'), status: 'Confirmed' }, message: 'Booking created.' }
  if (path.match(/^\/bookings\/[^/]+$/) && m === 'put') return { booking: BOOKINGS[0], message: 'Updated.' }

  // Documents
  if (path === '/documents' && m === 'get')              return { documents: DOCUMENTS }
  if (path.match(/^\/documents\/[^/]+$/) && m === 'post') return { document: DOCUMENTS[0], message: 'Uploaded.' }
  if (path.match(/^\/documents\/[^/]+\/verify$/))         return { document: { ...DOCUMENTS[0], verified: true }, message: 'Verified.' }

  // Food
  if (path === '/food-plans')  return { plans: FOOD_PLANS }
  if (path === '/food-orders') return { orders: FOOD_ORDERS }

  // Reports
  if (path === '/reports/dashboard') return DASHBOARD
  if (path === '/reports/revenue')   return REVENUE
  if (path === '/reports/gst')       return GST_REPORT
  if (path === '/reports/occupancy') return OCCUPANCY
  if (path === '/reports/export/csv') return new Blob(['mock,csv,data'], { type: 'text/csv' })
  if (path === '/reports/export/pdf') return new Blob(['Mock PDF'], { type: 'application/pdf' })

  // Settings
  if (path === '/settings' && m === 'get') return {
    hotel: SETTINGS_HOTEL,
    roomTypes: SETTINGS_ROOM_TYPES,
    foodPlans: SETTINGS_FOOD_PLANS,
    amenities: SETTINGS_AMENITIES,
  }
  if (path === '/settings' && m === 'put') return { message: 'Settings updated successfully.' }
  if (path === '/settings/logo')           return { logoUrl: '/logo-mock.png', message: 'Logo uploaded.' }

  // Notifications
  if (path === '/notifications' && m === 'get')    return { notifications: NOTIFICATIONS }
  if (path.match(/^\/notifications\/[^/]+\/dismiss$/)) return { message: 'Dismissed.' }
  if (path === '/notifications' && m === 'delete') return { message: 'Cleared.' }

  // Users (staff management)
  if (path === '/users' && m === 'get')  return { users: STAFF_USERS, total: STAFF_USERS.length }
  if (path === '/users' && m === 'post') return { user: STAFF_USERS[2], message: 'User created.' }
  if (path.match(/^\/users\/[^/]+$/) && m === 'put')    return { user: STAFF_USERS[0], message: 'Updated.' }
  if (path.match(/^\/users\/[^/]+$/) && m === 'delete') return { message: 'User deleted.' }

  // Maintenance
  if (path === '/maintenance' && m === 'get')  return { requests: MAINTENANCE, total: MAINTENANCE.length }
  if (path === '/maintenance' && m === 'post') return { request: MAINTENANCE[0], message: 'Created.' }
  if (path.match(/^\/maintenance\/[^/]+$/) && m === 'put') return { request: MAINTENANCE[0], message: 'Updated.' }

  // Housekeeping
  if (path === '/housekeeping' && m === 'get')  return { tasks: HOUSEKEEPING }
  if (path === '/housekeeping' && m === 'post') return { task: HOUSEKEEPING[0], message: 'Created.' }
  if (path.match(/^\/housekeeping\/[^/]+$/) && m === 'put') return { task: HOUSEKEEPING[0], message: 'Updated.' }

  // Staff
  if (path === '/staff' && m === 'get')  return { staff: STAFF_USERS.filter(u => u.role !== 'owner') }
  if (path === '/staff' && m === 'post') return { staff: STAFF_USERS[2], message: 'Created.' }
  if (path.match(/^\/staff\/[^/]+\/sessions$/)) return [{ id: uid('sess1'), createdAt: d(0), expiresAt: d(-1) }]
  if (path.match(/^\/staff\/[^/]+\/logout$/))   return { success: true, terminated: 1 }

  // Pricing / room types
  if (path === '/pricing' && m === 'get')  return { roomTypes: [
    { id: uid('rt1'), name: 'Standard',  baseRate: 1800, monthlyRate: 45000 },
    { id: uid('rt2'), name: 'Deluxe',    baseRate: 2800, monthlyRate: 70000 },
    { id: uid('rt3'), name: 'Suite',     baseRate: 5500, monthlyRate: 138000 },
    { id: uid('rt4'), name: 'Executive', baseRate: 8000, monthlyRate: 200000 },
  ]}
  if (path === '/pricing/competitors' && m === 'get')  return COMPETITORS
  if (path === '/pricing/competitors' && m === 'post') return { id: uid('comp-new'), name: 'New Competitor', roomType: 'Deluxe', theirRate: 4000, recordedDate: d(0) }
  if (path.match(/^\/pricing\/competitors\/[^/]+$/) && m === 'put')    return { id: uid('comp1'), name: 'Updated', roomType: 'Deluxe', theirRate: 4200, recordedDate: d(0) }
  if (path.match(/^\/pricing\/competitors\/[^/]+$/) && m === 'delete') return { success: true }

  // Reminders / channels
  if (path === '/reminders') return { reminders: [] }
  if (path === '/reminders/templates' && m === 'get')  return REMINDER_TEMPLATES
  if (path === '/reminders/templates' && m === 'post') return { id: uid('tpl-new'), trigger: 'custom', content: 'New template', active: true }
  if (path.match(/^\/reminders\/templates\/[^/]+$/) && m === 'put') return { id: uid('tpl1'), trigger: 'welcome', content: 'Updated', active: true }
  if (path === '/channels')  return { channels: [] }

  // Fallback
  console.warn('[MOCK] Unhandled route:', m?.toUpperCase(), path)
  return { data: [], message: 'Mock fallback response.' }
}
