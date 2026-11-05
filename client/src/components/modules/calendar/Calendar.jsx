import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LuBedDouble, LuUserCheck, LuCalendarClock, LuCircleCheck, LuPlus } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import { PageWrapper, StatCard } from '../../ui-tw'
import { useMinWidth } from '../../../hooks/useMediaQuery'
import { useToast } from '../../../hooks/useToast'
import { formatDate } from '../../../utils/format'
import { appLocale } from '../../../i18n'

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

// Filter values (compared in code); 'All' is labelled at render time.
const ROOM_TYPES = ['All', 'Standard', 'Deluxe', 'Suite', 'Executive']
const FLOORS     = ['all', 1, 2, 3, 4]

// Theme tokens (index.css) so the bars follow light / dark mode.
const STATUS_COLORS = {
  occupied:    { bg: 'var(--blue-bg)',  text: 'var(--blue-text)',  border: 'var(--blue)' },
  confirmed:   { bg: 'var(--gold-bg)',  text: 'var(--gold)',       border: 'var(--gold-border)' },
  maintenance: { bg: 'var(--amber-bg)', text: 'var(--amber-text)', border: 'var(--amber)' },
  checkout:    { bg: 'var(--grey-bg)',  text: 'var(--grey-text)',  border: 'var(--border2)' },
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
  const { t } = useTranslation('calendar')
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('newBooking.title')} maxWidth="440px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('newBooking.create')}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">{t('newBooking.guestName')}</label>
          <input className="form-input" placeholder={t('newBooking.fullName')} value={form.guestName} onChange={e => set('guestName', e.target.value)} />
        </div>
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">{t('field.room')}</label>
          <select className="form-select" value={form.roomId} onChange={e => set('roomId', e.target.value)}>
            <option value="">{t('newBooking.selectRoom')}</option>
            {ROOMS.map(r => <option key={r.id} value={r.id}>{r.number} — {r.type}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="form-label block mb-[5px]">{t('field.checkIn')}</label>
          <input type="date" className="form-input w-full" value={form.checkIn} onChange={e => set('checkIn', e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="form-label block mb-[5px]">{t('field.checkOut')}</label>
          <input type="date" className="form-input w-full" value={form.checkOut} onChange={e => set('checkOut', e.target.value)} />
        </div>
        <div className="col-span-full">
          <label className="form-label block mb-[5px]">{t('newBooking.notes')}</label>
          <input className="form-input" placeholder={t('newBooking.notesPlaceholder')} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, room, onClose, onDelete }) {
  const { t } = useTranslation('calendar')
  if (!booking) return null
  const nights = daysBetween(booking.checkIn, booking.checkOut)
  const colors = STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed

  return (
    <Modal isOpen={!!booking} onClose={onClose} title={t('detail.title')} maxWidth="380px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common:close')}</button>
          {booking.status !== 'occupied' && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(booking)}>{t('common:remove')}</button>
          )}
        </>
      }
    >
      <div className="t-label inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 mb-4 border" style={{
        background: colors.bg, borderColor: colors.border,
        color: colors.text,
      }}>
        {t(`status.${booking.status}`, { defaultValue: booking.status })}
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {[
          [t('field.guest'), booking.guestName],
          [t('field.room'), room?.number || '—'],
          [t('field.roomType'), room?.type || '—'],
          [t('field.checkIn'), formatDate(booking.checkIn)],
          [t('field.checkOut'), formatDate(booking.checkOut)],
          [t('field.duration'), t('nights', { count: nights })],
        ].map(([label, val]) => (
          <div key={label} className="min-w-0">
            <div className="text-xs font-semibold text-ink3 uppercase tracking-[0.06em] mb-[3px]">{label}</div>
            <div className="t-title break-words">{val}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

export default function Calendar() {
  const { t } = useTranslation('calendar')
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
  const [floorFilter, setFloorFilter] = useState('all')

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
    const matchFloor = floorFilter === 'all' || r.floor === Number(floorFilter)
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
    addToast(t('toast.added'), 'success')
  }

  const handleDeleteBooking = (booking) => {
    setBookings(bs => bs.filter(b => b.id !== booking.id))
    setDetailBooking(null)
    addToast(t('toast.removed'), 'info')
  }

  const COL_W = 44
  const ROW_H = 40
  const LABEL_W = 80

  const todayYMD = toYMD(today)
  const rangeLabel = `${formatDate(viewStart)} — ${formatDate(addDays(viewStart, viewDays - 1))}`

  // Legend data
  const legend = [
    { label: t('status.occupied'),    ...STATUS_COLORS.occupied },
    { label: t('status.confirmed'),   ...STATUS_COLORS.confirmed },
    { label: t('status.maintenance'), ...STATUS_COLORS.maintenance },
    { label: t('status.available'),   bg: 'var(--surface2)', text: 'var(--text3)', border: 'var(--border)' },
  ]

  const openNew = (roomId, ymd) => { setNewPreRoom(roomId); setNewPreDate(ymd); setShowNew(true) }

  // Phones and portrait tablets get a day-by-day list; the room × date grid
  // needs the width of a laptop to read.
  const showGrid = useMinWidth('lg')

  return (
    <PageWrapper
      title={t('title')}
      subtitle={showGrid ? t('subtitleGrid') : t('subtitleList')}
      headerActions={[
        { id: 'new', label: t('newBookingAction'), icon: <LuPlus />, variant: 'primary', onClick: () => openNew('', todayYMD) },
      ]}
      stats={[
        { id: 'total', label: t('stats.totalRooms'), value: filteredRooms.length, icon: <LuBedDouble />, tone: 'grey' },
        { id: 'occupied', label: t('stats.occupiedToday'), value: bookings.filter(b => b.checkIn <= todayYMD && b.checkOut > todayYMD && b.status === 'occupied').length, icon: <LuUserCheck />, tone: 'blue' },
        { id: 'upcoming', label: t('stats.confirmedUpcoming'), value: bookings.filter(b => b.checkIn > todayYMD && b.status === 'confirmed').length, icon: <LuCalendarClock />, tone: 'amber' },
        { id: 'available', label: t('stats.availableToday'), value: filteredRooms.length - bookings.filter(b => b.checkIn <= todayYMD && b.checkOut > todayYMD).length, icon: <LuCircleCheck />, tone: 'green' },
      ].map(({ id, ...st }) => <StatCard key={id} {...st} />)}
    >
      {/* Controls: range navigation, then span + filters (three across on phones) */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button className="btn btn-outline btn-sm" onClick={prev} aria-label={t('nav.prevRange')}>‹<span className="hidden sm:inline"> {t('nav.prev')}</span></button>
            <button className="btn btn-outline btn-sm" onClick={goToday}>{t('common:today')}</button>
            <button className="btn btn-outline btn-sm" onClick={next} aria-label={t('nav.nextRange')}><span className="hidden sm:inline">{t('common:next')} </span>›</button>
          </div>
          <span className="t-sm text-ink2 font-medium ml-1 min-w-0">{rangeLabel}</span>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2 lg:ml-auto">
          {/* View span */}
          <select aria-label={t('filter.daysShown')} className="form-select w-full sm:w-[110px]" value={viewDays} onChange={e => setViewDays(Number(e.target.value))}>
            {[7, 14, 21, 30].map(n => <option key={n} value={n}>{t('filter.days', { count: n })}</option>)}
          </select>
          {/* Filters */}
          <select aria-label={t('field.roomType')} className="form-select w-full sm:w-[130px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt === 'All' ? t('filter.allTypes') : rt}</option>)}
          </select>
          <select aria-label={t('filter.floor')} className="form-select w-full sm:w-[120px]" value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
            {FLOORS.map(f => <option key={f} value={f}>{f === 'all' ? t('filter.allFloors') : t('filter.floorN', { n: f })}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-x-3 gap-y-1.5 mb-[14px] flex-wrap items-center">
        {legend.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-[14px] h-[14px] rounded-[3px] border" style={{ background: l.bg, borderColor: l.border }} />
            <span className="text-xs text-ink3">{l.label}</span>
          </div>
        ))}
        {showGrid && <span className="text-xs text-ink3 ml-2">· {t('gridHint')}</span>}
      </div>

      {showGrid ? (
        /* Grid — scrolls sideways inside its own box when the span is wide */
        <div className="card overflow-x-auto overscroll-x-contain p-0">
          <div style={{ minWidth: LABEL_W + COL_W * viewDays + 2 }}>
            {/* Date header row */}
            <div className="flex border-b border-line sticky top-0 bg-surface z-10">
              <div className="py-2.5 px-3 text-xs font-bold text-ink3 uppercase tracking-[0.06em] border-r border-line sticky left-0 bg-surface z-[6]" style={{ width: LABEL_W, minWidth: LABEL_W }}>
                {t('field.room')}
              </div>
              {dates.map(date => {
                const ymd = toYMD(date)
                const isToday = ymd === todayYMD
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                return (
                  <div
                    key={ymd}
                    className={`text-center py-1.5 px-0.5 text-xs border-r border-line ${isToday ? 'font-bold text-gold bg-[var(--gold-bg)] border-b-2 border-b-gold' : `font-medium ${isWeekend ? 'text-warning-text' : 'text-ink3'} bg-transparent`}`}
                    style={{ width: COL_W, minWidth: COL_W }}
                  >
                    <div>{date.toLocaleDateString(appLocale(), { weekday: 'short' })}</div>
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
                  <div className="text-[12px] font-bold text-gold font-mono">{room.number}</div>
                  <div className="text-xs text-ink3 mt-px truncate">{room.type}</div>
                </div>

                {/* Day cells */}
                {dates.map((date) => {
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
                      className={`border-r border-line relative transition-[background] duration-100 ${booking ? 'cursor-pointer' : 'cursor-cell hover:bg-surface2'} ${isToday ? 'bg-[var(--gold-bg)]' : isWeekend ? 'bg-[rgba(0,0,0,0.02)]' : 'bg-transparent'}`}
                      style={{ width: COL_W, minWidth: COL_W, height: ROW_H }}
                    >
                      {/* Booking bar */}
                      {showBar && (
                        <div
                          onClick={e => { e.stopPropagation(); setDetailBooking(booking) }}
                          className="absolute left-0.5 top-1.5 rounded z-[3] flex items-center pl-1.5 overflow-hidden cursor-pointer transition-[opacity] duration-100 border hover:opacity-85"
                          style={{
                            width: span * COL_W - 4, height: ROW_H - 12,
                            background: colors.bg, borderColor: colors.border,
                          }}
                        >
                          <span className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: colors.text }}>
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
      ) : (
        <DayList
          dates={dates}
          rooms={filteredRooms}
          bookings={bookings}
          todayYMD={todayYMD}
          onOpen={setDetailBooking}
          onBook={(ymd) => openNew('', ymd)}
        />
      )}

      {/* Modals */}
      <NewBookingModal
        key={`${newPreRoom}-${newPreDate}-${showNew}`}
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
    </PageWrapper>
  )
}

// ─── Day List (phones / tablets) ──────────────────────────────────────────────
// The grid read row-wise: one section per day with that day's arrivals and
// departures as full rows, everyone else in house as compact chips, and a
// free-room count with a "Book" shortcut for the day.

function DayList({ dates, rooms, bookings, todayYMD, onOpen, onBook }) {
  const { t } = useTranslation('calendar')
  const roomIds = new Set(rooms.map(r => r.id))
  const roomOf = (id) => rooms.find(r => r.id === id)

  return (
    <div className="flex flex-col gap-3">
      {dates.map(date => {
        const ymd = toYMD(date)
        const isToday = ymd === todayYMD
        const inRooms = bookings.filter(b => roomIds.has(b.roomId))
        const arrivals   = inRooms.filter(b => b.checkIn === ymd)
        const departures = inRooms.filter(b => b.checkOut === ymd)
        const staying    = inRooms.filter(b => b.checkIn < ymd && b.checkOut > ymd)
        const free = rooms.length - arrivals.length - staying.length

        return (
          <section key={ymd} className={`card overflow-hidden ${isToday ? 'border-gold' : ''}`}>
            <header className={`flex items-center justify-between gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b border-line ${isToday ? 'bg-[var(--gold-bg)]' : 'bg-surface2'}`}>
              <div className="min-w-0">
                <div className={`t-title ${isToday ? 'text-gold' : ''}`}>
                  {date.toLocaleDateString(appLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}
                  {isToday && <span className="ml-1.5 text-xs font-bold uppercase tracking-[0.06em]">{t('common:today')}</span>}
                </div>
                <div className="text-xs text-ink3 mt-0.5">
                  {arrivals.length + departures.length + staying.length === 0
                    ? t('day.allFree', { count: rooms.length })
                    : t('day.summary', { inHouse: arrivals.length + staying.length, free: Math.max(0, free) })}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm shrink-0"
                onClick={() => onBook(ymd)}
                disabled={free <= 0}
              >
                + {t('day.book')}
              </button>
            </header>

            {arrivals.length + departures.length + staying.length > 0 && (
              <div>
                {[...arrivals.map(b => ['arrives', b]), ...departures.map(b => ['departs', b])].map(([kind, b]) => {
                  const colors = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed
                  const room = roomOf(b.roomId)
                  const nights = daysBetween(b.checkIn, b.checkOut)
                  return (
                    <button
                      key={`${kind}-${b.id}`}
                      type="button"
                      onClick={() => onOpen(b)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-left border-b border-line last:border-b-0 active:bg-surface2 hover:bg-surface2"
                    >
                      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: colors.border }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink truncate">{b.guestName}</span>
                        <span className="block text-xs text-ink3 mt-0.5">
                          <span className="font-mono text-gold">{room?.number}</span> · {room?.type} · {t('nights', { count: nights })}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-xs font-semibold rounded-md px-2 py-0.5 border"
                        style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                      >
                        {t(`day.${kind}`)}
                      </span>
                    </button>
                  )
                })}

                {staying.length > 0 && (
                  <div className="px-4 py-2.5 flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-ink3 mr-0.5">{t('day.inHouse')}</span>
                    {staying.map(b => {
                      const colors = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onOpen(b)}
                          className="inline-flex items-center gap-1.5 max-w-full min-h-9 pointer-coarse:min-h-11 rounded-lg border px-2.5 text-xs font-medium"
                          style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                        >
                          <span className="font-mono font-bold">{roomOf(b.roomId)?.number}</span>
                          <span className="truncate">{b.guestName}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
