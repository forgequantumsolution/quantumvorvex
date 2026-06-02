/**
 * Seed data for the front-desk operations slice (opsSlice).
 *
 * A single `bookings` array is the source of truth for the Bookings, Check-In,
 * Check-Out and Cancellations pages — each page just filters by `status`:
 *   Pending | Confirmed | CheckedIn | CheckedOut | Cancelled
 *
 * `tickets` powers the Maintenance page (Open | In Progress | Resolved).
 *
 * Dates are kept as plain ISO `YYYY-MM-DD` strings around the demo "today"
 * (2026-06-02) so arrivals/departures look current in the UI.
 */

export const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Executive']
export const STAY_TYPES = ['daily', 'monthly']
export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled']

// Rooms that can be picked when creating a booking (demo inventory)
export const AVAILABLE_ROOMS = [
  { number: '104', type: 'Deluxe', rate: 3200 },
  { number: '110', type: 'Standard', rate: 1800 },
  { number: '201', type: 'Suite', rate: 5400 },
  { number: '203', type: 'Deluxe', rate: 3200 },
  { number: '208', type: 'Standard', rate: 1800 },
  { number: '301', type: 'Executive', rate: 4200 },
  { number: '304', type: 'Suite', rate: 5400 },
  { number: '401', type: 'Executive', rate: 4200 },
]

export const TICKET_CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Housekeeping', 'Other']
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved']

export const SEED_BOOKINGS = [
  {
    id: 'bk-1', bookingNo: 'BK-2026-001', guestName: 'Deepak Mehta',
    phone: '+91 98201 11223', email: 'deepak.mehta@example.com',
    room: '104', roomType: 'Deluxe', stayType: 'daily',
    fromDate: '2026-06-02', toDate: '2026-06-05', months: null, nights: 3,
    rate: 3200, guests: 2, amount: 9600, advance: 3000,
    status: 'Confirmed', notes: 'Late check-in expected (after 9pm).',
    createdAt: '2026-05-28', checkedInAt: null, checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-2', bookingNo: 'BK-2026-002', guestName: 'Kavita Joshi',
    phone: '+91 99300 44556', email: 'kavita.j@example.com',
    room: '203', roomType: 'Deluxe', stayType: 'monthly',
    fromDate: '2026-06-03', toDate: null, months: 2, nights: null,
    rate: 70000, guests: 1, amount: 140000, advance: 20000,
    status: 'Pending', notes: 'Corporate long-stay, GST invoice required.',
    createdAt: '2026-05-30', checkedInAt: null, checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-3', bookingNo: 'BK-2026-003', guestName: 'Sanjay Verma',
    phone: '+91 98765 43210', email: 'sanjay.verma@example.com',
    room: '301', roomType: 'Executive', stayType: 'daily',
    fromDate: '2026-06-02', toDate: '2026-06-04', months: null, nights: 2,
    rate: 4200, guests: 2, amount: 8400, advance: 2000,
    status: 'Pending', notes: 'Vegetarian meals only.',
    createdAt: '2026-05-31', checkedInAt: null, checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-4', bookingNo: 'BK-2026-004', guestName: 'Meena Reddy',
    phone: '+91 90080 12345', email: 'meena.reddy@example.com',
    room: '201', roomType: 'Suite', stayType: 'daily',
    fromDate: '2026-05-31', toDate: '2026-06-03', months: null, nights: 3,
    rate: 5400, guests: 3, amount: 16200, advance: 8000,
    status: 'CheckedIn', notes: 'Anniversary — arrange welcome cake.',
    createdAt: '2026-05-25', checkedInAt: '2026-05-31', checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-5', bookingNo: 'BK-2026-005', guestName: 'Arjun Nair',
    phone: '+91 97000 55667', email: 'arjun.nair@example.com',
    room: '401', roomType: 'Executive', stayType: 'daily',
    fromDate: '2026-05-30', toDate: '2026-06-02', months: null, nights: 3,
    rate: 4200, guests: 1, amount: 12600, advance: 5000,
    status: 'CheckedIn', notes: 'Frequent guest — Gold tier.',
    createdAt: '2026-05-24', checkedInAt: '2026-05-30', checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-6', bookingNo: 'BK-2026-006', guestName: 'Priya Mehta',
    phone: '+91 95551 23456', email: 'priya.mehta@example.com',
    room: '110', roomType: 'Standard', stayType: 'daily',
    fromDate: '2026-05-27', toDate: '2026-05-30', months: null, nights: 3,
    rate: 1800, guests: 2, amount: 5400, advance: 5400,
    status: 'CheckedOut', notes: '',
    createdAt: '2026-05-20', checkedInAt: '2026-05-27', checkedOutAt: '2026-05-30',
    cancelledAt: null, cancelReason: null,
  },
  {
    id: 'bk-7', bookingNo: 'BK-2026-007', guestName: 'Rahul Khanna',
    phone: '+91 98199 87654', email: 'rahul.khanna@example.com',
    room: '304', roomType: 'Suite', stayType: 'daily',
    fromDate: '2026-06-06', toDate: '2026-06-09', months: null, nights: 3,
    rate: 5400, guests: 4, amount: 16200, advance: 0,
    status: 'Cancelled', notes: '',
    createdAt: '2026-05-29', checkedInAt: null, checkedOutAt: null,
    cancelledAt: '2026-05-31', cancelReason: 'Guest changed travel plans.',
  },
  {
    id: 'bk-8', bookingNo: 'BK-2026-008', guestName: 'Sneha Rao',
    phone: '+91 99887 66554', email: 'sneha.rao@example.com',
    room: '208', roomType: 'Standard', stayType: 'daily',
    fromDate: '2026-06-04', toDate: '2026-06-06', months: null, nights: 2,
    rate: 1800, guests: 2, amount: 3600, advance: 1000,
    status: 'Confirmed', notes: 'Early check-in requested.',
    createdAt: '2026-06-01', checkedInAt: null, checkedOutAt: null,
    cancelledAt: null, cancelReason: null,
  },
]

export const SEED_TICKETS = [
  {
    id: 'mt-1', ticketNo: 'MT-2026-001', room: '105', category: 'HVAC',
    title: 'AC not cooling', description: 'Air conditioner runs but does not cool the room.',
    priority: 'High', status: 'Open', assignedTo: 'Ravi (Technician)',
    reportedBy: 'Front Desk', createdAt: '2026-05-30', resolvedAt: null,
  },
  {
    id: 'mt-2', ticketNo: 'MT-2026-002', room: '212', category: 'Plumbing',
    title: 'Leaking bathroom tap', description: 'Continuous drip from the wash basin tap.',
    priority: 'Medium', status: 'In Progress', assignedTo: 'Suresh (Plumber)',
    reportedBy: 'Housekeeping', createdAt: '2026-05-31', resolvedAt: null,
  },
  {
    id: 'mt-3', ticketNo: 'MT-2026-003', room: '118', category: 'Electrical',
    title: 'Bedside lamp not working', description: 'Lamp does not turn on; suspect wiring.',
    priority: 'Low', status: 'Open', assignedTo: 'Unassigned',
    reportedBy: 'Guest', createdAt: '2026-06-01', resolvedAt: null,
  },
  {
    id: 'mt-4', ticketNo: 'MT-2026-004', room: '301', category: 'Furniture',
    title: 'Wobbly desk chair', description: 'Chair base is loose and unstable.',
    priority: 'Low', status: 'Resolved', assignedTo: 'Ravi (Technician)',
    reportedBy: 'Guest', createdAt: '2026-05-28', resolvedAt: '2026-05-29',
  },
  {
    id: 'mt-5', ticketNo: 'MT-2026-005', room: '404', category: 'Plumbing',
    title: 'Low water pressure in shower', description: 'Weak flow in the shower across the floor.',
    priority: 'Urgent', status: 'In Progress', assignedTo: 'Suresh (Plumber)',
    reportedBy: 'Front Desk', createdAt: '2026-06-01', resolvedAt: null,
  },
]
