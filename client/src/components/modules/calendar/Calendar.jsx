import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { formatDate, formatCurrency } from '../../../utils/format'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const ROOMS = [
  { id: 'r1',  number: '101', type: 'Standard',  floor: 1 },
  { id: 'r2',  number: '102', type: 'Standard',  floor: 1 },
  { id: 'r3',  number: '103', type: 'Standard',  floor: 1 },
  { id: 'r4',  number: '104', type: 'Deluxe',    floor: 1 },
  { id: 'r5',  number: '105', type: 'Deluxe',    floor: 1 },
  { id: 'r6',  number: '201', type: 'Deluxe',    floor: 2 },
  { id: 'r7',  number: '202', type: 'Suite',     floor: 2 },
  { id: 'r8',  number: '203', type: 'Suite',     floor: 2 },
  { id: 'r9',  number: '301', type: 'Executive', floor: 3 },
  { id: 'r10', number: '302', type: 'Executive', floor: 3 },
  { id: 'r11', number: '303', type: 'Standard',  floor: 3 },
  { id: 'r12', number: '401', type: 'Suite',     floor: 4 },
]

// Bookings: { roomId, guestName, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD), status }
const MOCK_BOOKINGS = [
  { id: 'b1',  roomId: 'r1',  guestName: 'Anil Sharma',     checkIn: '2026-04-01', checkOut: '2026-04-07', status: 'occupied',  color: '#2563eb' },
  { id: 'b2',  roomId: 'r4',  guestName: 'Priya Mehta',     checkIn: '2026-03-28', checkOut: '2026-04-10', status: 'occupied',  color: '#16a34a' },
  { id: 'b3',  roomId: 'r7',  guestName: 'Rajesh Kumar',    checkIn: '2026-04-04', checkOut: '2026-04-06', status: 'occupied',  color: '#2563eb' },
  { id: 'b4',  roomId: 'r12', guestName: 'Sunita Verma',    checkIn: '2026-03-20', checkOut: '2026-04-20', status: 'occupied',  color: '#16a34a' },
  { id: 'b5',  roomId: 'r9',  guestName: 'Deepak Nair',     checkIn: '2026-04-08', checkOut: '2026-04-12', status: 'confirmed', color: '#c9a84c' },
  { id: 'b6',  roomId: 'r3',  guestName: 'Anjali Singh',    checkIn: '2026-04-09', checkOut: '2026-04-11', status: 'confirmed', color: '#c9a84c' },
  { id: 'b7',  roomId: 'r6',  guestName: 'Farhan Ahmed',    checkIn: '2026-04-12', checkOut: '2026-04-17', status: 'confirmed', color: '#c9a84c' },
  { id: 'b8',  roomId: 'r2',  guestName: 'Neha Joshi',      checkIn: '2026-04-15', checkOut: '2026-04-22', status: 'confirmed', color: '#c9a84c' },
  { id: 'b9',  roomId: 'r5',  guestName: 'Maintenance',     checkIn: '2026-04-06', checkOut: '2026-04-08', status: 'maintenance', color: '#d97706' },
  { id: 'b10', roomId: 'r11', guestName: 'Vijay Kumar',     checkIn: '2026-04-03', checkOut: '2026-04-05', status: 'checkout',  color: '#6b7280' },
]

const ROOM_TYPES = ['All', 'Standard', 'Deluxe', 'Suite', 'Executive']
const FLOORS     = ['All Floors', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4']

const STATUS_COLORS = {
  occupied:    { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  confirmed:   { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  maintenance: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  checkout:    { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toYMD(date) {
  return date.toISOString().split('T')[0]
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function isSameDay(a, b) {
  return toYMD(new Date(a)) === toYMD(new Date(b))
}

// ─── New Booking Modal ────────────────────────────────────────────────────────

function NewBookingModal({ isOpen, onClose, onSave, preRoom, preDate }) {
  const [form, setForm] = useState({
    roomId: preRoom || '',
    guestName: '',
    checkIn: preDate || '',
    checkOut: '',
    notes: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.guestName.trim() || !form.roomId || !form.checkIn || !form.checkOut) return
    onSave({ ...form, id: `nb-${Date.now()}`, status: 'confirmed', color: '#c9a84c' })
    setForm({ roomId: '', guestName: '', checkIn: '', checkOut: '', notes: '' })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Booking" maxWidth="440px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Create Booking</button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">Guest Name</label>
          <input className="form-input" placeholder="Full name" value={form.guestName} onChange={e => set('guestName', e.target.value)} />
        </div>
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">Room</label>
          <select className="form-select" value={form.roomId} onChange={e => set('roomId', e.target.value)}>
            <option value="">Select room</option>
            {ROOMS.map(r => <option key={r.id} value={r.id}>{r.number} — {r.type}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label block mb-[5px]">Check-In</label>
          <input type="date" className="form-input" value={form.checkIn} onChange={e => set('checkIn', e.target.value)} />
        </div>
        <div>
          <label className="form-label block mb-[5px]">Check-Out</label>
          <input type="date" className="form-input" value={form.checkOut} onChange={e => set('checkOut', e.target.value)} />
        </div>
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">Notes</label>
          <input className="form-input" placeholder="Special requests..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, room, onClose, onDelete }) {
  if (!booking) return null
  const nights = daysBetween(booking.checkIn, booking.checkOut)
  const colors = STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed

  return (
    <Modal isOpen={!!booking} onClose={onClose} title="Booking Details" maxWidth="380px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {booking.status !== 'occupied' && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(booking)}>Remove</button>
          )}
        </>
      }
    >
      <div className="t-label inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 mb-4 border" style={{
        background: colors.bg, borderColor: colors.border,
        color: colors.text,
      }}>
        {booking.status}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
        {[
          ['Guest', booking.guestName],
          ['Room', room?.number || '—'],
          ['Room Type', room?.type || '—'],
          ['Check-In', formatDate(booking.checkIn)],
          ['Check-Out', formatDate(booking.checkOut)],
          ['Duration', `${nights} night${nights !== 1 ? 's' : ''}`],
        ].map(([label, val]) => (
          <div key={label}>
            <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.06em] mb-[3px]">{label}</div>
            <div className="t-title">{val}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

export default function Calendar() {
  const addToast = useToast()

  // View: start date (Monday of current week)
  const today = new Date()
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    return d
  })
  const [viewDays, setViewDays] = useState(14)
  const [typeFilter, setTypeFilter] = useState('All')
  const [floorFilter, setFloorFilter] = useState('All Floors')

  const [bookings, setBookings] = useState(MOCK_BOOKINGS)
  const [showNew, setShowNew] = useState(false)
  const [newPreRoom, setNewPreRoom] = useState('')
  const [newPreDate, setNewPreDate] = useState('')
  const [detailBooking, setDetailBooking] = useState(null)

  // Generate date columns
  const dates = useMemo(() =>
    Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i)),
    [viewStart, viewDays]
  )

  // Filtered rooms
  const filteredRooms = useMemo(() => ROOMS.filter(r => {
    const matchType  = typeFilter  === 'All'        || r.type  === typeFilter
    const matchFloor = floorFilter === 'All Floors' || r.floor === parseInt(floorFilter.split(' ')[1])
    return matchType && matchFloor
  }), [typeFilter, floorFilter])

  // Navigate
  const prev = () => setViewStart(d => addDays(d, -viewDays))
  const next = () => setViewStart(d => addDays(d, viewDays))
  const goToday = () => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    setViewStart(d)
  }

  // Get bookings for a room × date cell
  const getCell = (roomId, date) => {
    const ymd = toYMD(date)
    return bookings.find(b =>
      b.roomId === roomId && b.checkIn <= ymd && b.checkOut > ymd
    )
  }

  // Get booking bar width (how many columns it spans in the current view)
  const getBookingSpan = (booking, startDate) => {
    const viewEnd = toYMD(addDays(startDate, viewDays - 1))
    const start = booking.checkIn > toYMD(startDate) ? booking.checkIn : toYMD(startDate)
    const end   = booking.checkOut < viewEnd ? booking.checkOut : viewEnd
    return Math.max(1, daysBetween(start, end))
  }

  // Check if this is the START of a booking within the view
  const isBookingStart = (booking, date) => {
    const ymd = toYMD(date)
    return booking.checkIn === ymd || (booking.checkIn < toYMD(viewStart) && isSameDay(viewStart, date))
  }

  const handleCellClick = (roomId, date) => {
    const existing = getCell(roomId, date)
    if (existing) {
      setDetailBooking(existing)
    } else {
      setNewPreRoom(roomId)
      setNewPreDate(toYMD(date))
      setShowNew(true)
    }
  }

  const handleNewBooking = (booking) => {
    setBookings(bs => [...bs, booking])
    setShowNew(false)
    addToast('Booking added to calendar', 'success')
  }

  const handleDeleteBooking = (booking) => {
    setBookings(bs => bs.filter(b => b.id !== booking.id))
    setDetailBooking(null)
    addToast('Booking removed', 'info')
  }

  const COL_W = 44
  const ROW_H = 40
  const LABEL_W = 80

  const todayYMD = toYMD(today)
  const rangeLabel = `${formatDate(viewStart)} — ${formatDate(addDays(viewStart, viewDays - 1))}`

  // Legend data
  const legend = [
    { label: 'Occupied',    ...STATUS_COLORS.occupied },
    { label: 'Confirmed',   ...STATUS_COLORS.confirmed },
    { label: 'Maintenance', ...STATUS_COLORS.maintenance },
    { label: 'Available',   bg: 'var(--surface2)', text: 'var(--text3)', border: 'var(--border)' },
  ]

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.03em]">Room Calendar</h1>
          <p className="t-sm mt-1 mx-0 mb-0 text-ink3">Visual booking timeline — click a cell to book or view details</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setNewPreRoom(''); setNewPreDate(todayYMD); setShowNew(true) }}>
          + New Booking
        </button>
      </div>

      {/* Controls */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <button className="btn btn-outline btn-sm" onClick={prev}>‹ Prev</button>
          <button className="btn btn-outline btn-sm" onClick={goToday}>Today</button>
          <button className="btn btn-outline btn-sm" onClick={next}>Next ›</button>
          <span className="t-sm text-ink2 font-medium ml-1">{rangeLabel}</span>
        </div>
        <div className="flex-1" />
        {/* View span */}
        <select className="form-select w-[100px]" value={viewDays} onChange={e => setViewDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={21}>21 days</option>
          <option value={30}>30 days</option>
        </select>
        {/* Filters */}
        <select className="form-select w-[130px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="form-select w-[120px]" value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
          {FLOORS.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-[14px] flex-wrap">
        {legend.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-[14px] h-[14px] rounded-[3px] border" style={{ background: l.bg, borderColor: l.border }} />
            <span className="text-[11.5px] text-ink3">{l.label}</span>
          </div>
        ))}
        <span className="text-[11.5px] text-ink3 ml-2">· Click empty cell to book · Click booking to view details</span>
      </div>

      {/* Grid */}
      <div className="card overflow-x-auto p-0">
        <div style={{ minWidth: LABEL_W + COL_W * viewDays + 2 }}>
          {/* Date header row */}
          <div className="flex border-b border-line sticky top-0 bg-surface z-10">
            <div className="py-2.5 px-3 text-[10.5px] font-bold text-ink3 uppercase tracking-[0.06em] border-r border-line" style={{ width: LABEL_W, minWidth: LABEL_W }}>
              Room
            </div>
            {dates.map(date => {
              const ymd = toYMD(date)
              const isToday = ymd === todayYMD
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              return (
                <div
                  key={ymd}
                  className={`text-center py-1.5 px-0.5 text-[10.5px] border-r border-line ${isToday ? 'font-bold text-gold bg-[var(--gold-bg)] border-b-2 border-b-gold' : `font-medium ${isWeekend ? 'text-warning-text' : 'text-ink3'} bg-transparent`}`}
                  style={{ width: COL_W, minWidth: COL_W }}
                >
                  <div>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  <div className="text-[12px] font-bold">{date.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Room rows */}
          {filteredRooms.map(room => (
            <div key={room.id} className="flex border-b border-line relative" style={{ height: ROW_H }}>
              {/* Room label */}
              <div
                className="flex flex-col justify-center px-3 border-r border-line sticky left-0 bg-surface z-[5]"
                style={{ width: LABEL_W, minWidth: LABEL_W }}
              >
                <div className="text-[12px] font-bold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{room.number}</div>
                <div className="text-[9.5px] text-ink3 mt-px">{room.type}</div>
              </div>

              {/* Day cells */}
              {dates.map((date, dIdx) => {
                const ymd = toYMD(date)
                const booking = getCell(room.id, date)
                const isToday = ymd === todayYMD
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const showBar = booking && isBookingStart(booking, date)
                const span = showBar ? getBookingSpan(booking, viewStart) : 0
                const colors = booking ? (STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed) : null

                return (
                  <div
                    key={ymd}
                    onClick={() => handleCellClick(room.id, date)}
                    className={`border-r border-line relative transition-[background] duration-100 ${booking ? 'cursor-pointer' : 'cursor-cell'}`}
                    style={{
                      width: COL_W, minWidth: COL_W, height: ROW_H,
                      background: isToday ? 'var(--gold-bg)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!booking) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { if (!booking) e.currentTarget.style.background = isToday ? 'var(--gold-bg)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent' }}
                  >
                    {/* Booking bar */}
                    {showBar && (
                      <div
                        onClick={e => { e.stopPropagation(); setDetailBooking(booking) }}
                        className="absolute left-0.5 top-1.5 rounded z-[3] flex items-center pl-1.5 overflow-hidden cursor-pointer transition-[opacity] duration-100 border"
                        style={{
                          width: span * COL_W - 4, height: ROW_H - 12,
                          background: colors.bg, borderColor: colors.border,
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <span className="text-[10.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: colors.text }}>
                          {booking.guestName}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {[
          { label: 'Total Rooms', value: filteredRooms.length, color: 'var(--text)' },
          { label: 'Occupied Today', value: bookings.filter(b => b.checkIn <= todayYMD && b.checkOut > todayYMD && b.status === 'occupied').length, color: 'var(--blue-text)' },
          { label: 'Confirmed Upcoming', value: bookings.filter(b => b.checkIn > todayYMD && b.status === 'confirmed').length, color: 'var(--amber-text)' },
          { label: 'Available Today', value: filteredRooms.length - bookings.filter(b => b.checkIn <= todayYMD && b.checkOut > todayYMD).length, color: 'var(--green-text)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.05em] mb-1.5">{s.label}</div>
            <div className="text-[24px] font-bold" style={{ fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Modals */}
      <NewBookingModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSave={handleNewBooking}
        preRoom={newPreRoom}
        preDate={newPreDate}
      />
      <BookingDetailModal
        booking={detailBooking}
        room={detailBooking ? ROOMS.find(r => r.id === detailBooking.roomId) : null}
        onClose={() => setDetailBooking(null)}
        onDelete={handleDeleteBooking}
      />
    </div>
  )
}
