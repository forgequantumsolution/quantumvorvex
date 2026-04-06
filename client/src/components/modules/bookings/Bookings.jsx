import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatDate, formatCurrency, statusColor, stayTypeColor, generateBookingNo } from '../../../utils/format'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_BOOKINGS = [
  { id: '1', bookingNo: 'BK-2026-001', guestName: 'Deepak Mehta', room: '104', stayType: 'daily', fromDate: '2026-04-08', toDate: '2026-04-12', months: null, amount: 3200, advance: 1000, status: 'Confirmed', notes: 'Late check-in expected' },
  { id: '2', bookingNo: 'BK-2026-002', guestName: 'Kavita Joshi', room: '203', stayType: 'monthly', fromDate: '2026-04-15', toDate: null, months: 2, amount: 56000, advance: 10000, status: 'Pending', notes: '' },
  { id: '3', bookingNo: 'BK-2026-003', guestName: 'Sanjay Verma', room: '301', stayType: 'daily', fromDate: '2026-04-20', toDate: '2026-04-25', months: null, amount: 2500, advance: 500, status: 'Pending', notes: 'Vegetarian meals only' },
  { id: '4', bookingNo: 'BK-2026-004', guestName: 'Meena Reddy', room: '202', stayType: 'monthly', fromDate: '2026-03-01', toDate: null, months: 1, amount: 14000, advance: 5000, status: 'Confirmed', notes: '' },
]

const AVAILABLE_ROOMS = ['104', '110', '201', '203', '301', '304', '310', '401']

const TABS = [
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Cancelled', label: 'Cancelled' },
]

const UPCOMING_CUTOFF = '2026-04-07' // today ref

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToDisplay(booking) {
  if (booking.stayType === 'daily') return formatDate(booking.toDate)
  return `${booking.months} month${booking.months !== 1 ? 's' : ''}`
}

function isUpcoming(booking) {
  return booking.fromDate >= UPCOMING_CUTOFF && booking.status !== 'Cancelled'
}

function filterByTab(bookings, tab) {
  if (tab === 'Upcoming') return bookings.filter(isUpcoming)
  return bookings.filter(b => b.status === tab)
}

const emptyForm = {
  guestName: '',
  room: '',
  stayType: 'daily',
  fromDate: '',
  toDate: '',
  months: 1,
  amount: '',
  advance: '',
  notes: '',
}

// ─── New Booking Modal ────────────────────────────────────────────────────────

function NewBookingModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.guestName.trim() || !form.room || !form.fromDate) return
    onSave({
      ...form,
      id: String(Date.now()),
      bookingNo: generateBookingNo(),
      status: 'Pending',
      amount: Number(form.amount) || 0,
      advance: Number(form.advance) || 0,
      months: form.stayType === 'monthly' ? Number(form.months) : null,
      toDate: form.stayType === 'daily' ? form.toDate : null,
    })
    setForm(emptyForm)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Booking"
      maxWidth="560px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Save Booking</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Guest Name */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Guest Name</label>
          <input className="form-input" placeholder="Full name" value={form.guestName} onChange={e => set('guestName', e.target.value)} />
        </div>

        {/* Room */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Room</label>
          <select className="form-select" value={form.room} onChange={e => set('room', e.target.value)}>
            <option value="">Select room</option>
            {AVAILABLE_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Stay Type */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Stay Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['daily', 'monthly'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => set('stayType', type)}
                className={form.stayType === type ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {type === 'daily' ? 'Daily' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {/* From Date */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>From Date</label>
          <input type="date" className="form-input" value={form.fromDate} onChange={e => set('fromDate', e.target.value)} />
        </div>

        {/* To Date or Months */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>
            {form.stayType === 'daily' ? 'To Date' : 'Months'}
          </label>
          {form.stayType === 'daily'
            ? <input type="date" className="form-input" value={form.toDate} onChange={e => set('toDate', e.target.value)} />
            : <input type="number" className="form-input" min="1" value={form.months} onChange={e => set('months', e.target.value)} />
          }
        </div>

        {/* Amount */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Amount (₹)</label>
          <input type="number" className="form-input" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>

        {/* Advance */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Advance (₹)</label>
          <input type="number" className="form-input" placeholder="0" value={form.advance} onChange={e => set('advance', e.target.value)} />
        </div>

        {/* Notes */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Notes</label>
          <textarea className="form-textarea" placeholder="Any special requests..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ─── View Booking Modal ───────────────────────────────────────────────────────

function ViewBookingModal({ booking, onClose, onConfirm, onCancel }) {
  if (!booking) return null
  return (
    <Modal
      isOpen={!!booking}
      onClose={onClose}
      title={
        <span>
          {booking.bookingNo}{' '}
          <Badge type={statusColor(booking.status).replace('badge-', '')} className="ml-1">{booking.status}</Badge>
        </span>
      }
      maxWidth="480px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {booking.status === 'Pending' && (
            <button className="btn btn-success btn-sm" onClick={() => onConfirm(booking)}>Confirm</button>
          )}
          {booking.status !== 'Cancelled' && (
            <button className="btn btn-danger btn-sm" onClick={() => onCancel(booking)}>Cancel</button>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {[
          ['Guest', booking.guestName],
          ['Room', booking.room],
          ['Stay Type', booking.stayType === 'monthly' ? 'Monthly' : 'Daily'],
          ['From', formatDate(booking.fromDate)],
          ['To / Duration', getToDisplay(booking)],
          ['Amount', formatCurrency(booking.amount)],
          ['Advance Paid', formatCurrency(booking.advance)],
          ['Balance Due', formatCurrency(booking.amount - booking.advance)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="form-label" style={{ marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
        {booking.notes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="form-label" style={{ marginBottom: '3px' }}>Notes</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', background: 'var(--surface2)', borderRadius: '6px', padding: '8px 10px' }}>
              {booking.notes}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Bookings() {
  const addToast = useToast()
  const [bookings, setBookings] = useState(MOCK_BOOKINGS)
  const [activeTab, setActiveTab] = useState('Upcoming')
  const [showNew, setShowNew] = useState(false)
  const [viewBooking, setViewBooking] = useState(null)

  const filtered = useMemo(() => filterByTab(bookings, activeTab), [bookings, activeTab])

  const handleSaveBooking = (newBooking) => {
    setBookings(bs => [...bs, newBooking])
    setShowNew(false)
    addToast(`Booking ${newBooking.bookingNo} created`, 'success')
  }

  const handleConfirm = (booking) => {
    setBookings(bs => bs.map(b => b.id === booking.id ? { ...b, status: 'Confirmed' } : b))
    setViewBooking(null)
    addToast(`Booking ${booking.bookingNo} confirmed`, 'success')
  }

  const handleCancel = (booking) => {
    setBookings(bs => bs.map(b => b.id === booking.id ? { ...b, status: 'Cancelled' } : b))
    setViewBooking(null)
    addToast(`Booking ${booking.bookingNo} cancelled`, 'info')
  }

  const handleQuickConfirm = (booking) => {
    setBookings(bs => bs.map(b => b.id === booking.id ? { ...b, status: 'Confirmed' } : b))
    addToast(`Booking ${booking.bookingNo} confirmed`, 'success')
  }

  const handleQuickCancel = (booking) => {
    setBookings(bs => bs.map(b => b.id === booking.id ? { ...b, status: 'Cancelled' } : b))
    addToast(`Booking ${booking.bookingNo} cancelled`, 'info')
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            Bookings
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '13px' }}>Manage advance reservations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Booking
        </button>
      </div>

      {/* Tabs + Table */}
      <div className="card">
        <div style={{ padding: '0 0' }}>
          <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
            {TABS.map(tab => (
              <div key={tab.id} data-tab-id={tab.id}>
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
                    <div>No bookings found</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Booking ID</th>
                          <th>Guest</th>
                          <th>Room</th>
                          <th>Type</th>
                          <th>From</th>
                          <th>To / Duration</th>
                          <th>Amount</th>
                          <th>Advance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(booking => (
                          <tr key={booking.id}>
                            {/* Booking No */}
                            <td>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontSize: '12px', fontWeight: 600 }}>
                                {booking.bookingNo}
                              </span>
                            </td>
                            {/* Guest */}
                            <td style={{ fontWeight: 600 }}>{booking.guestName}</td>
                            {/* Room */}
                            <td>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{booking.room}</span>
                            </td>
                            {/* Type */}
                            <td>
                              <Badge type={booking.stayType === 'monthly' ? 'purple' : 'blue'}>
                                {booking.stayType === 'monthly' ? 'Monthly' : 'Daily'}
                              </Badge>
                            </td>
                            {/* From */}
                            <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{formatDate(booking.fromDate)}</td>
                            {/* To / Months */}
                            <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{getToDisplay(booking)}</td>
                            {/* Amount */}
                            <td>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}>{formatCurrency(booking.amount)}</span>
                            </td>
                            {/* Advance */}
                            <td>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}>{formatCurrency(booking.advance)}</span>
                            </td>
                            {/* Status */}
                            <td>
                              <Badge type={statusColor(booking.status).replace('badge-', '')}>{booking.status}</Badge>
                            </td>
                            {/* Actions */}
                            <td>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button className="btn btn-outline btn-xs" onClick={() => setViewBooking(booking)}>View</button>
                                {booking.status === 'Pending' && (
                                  <button
                                    className="btn btn-xs"
                                    style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
                                    onClick={() => handleQuickConfirm(booking)}
                                  >
                                    Confirm
                                  </button>
                                )}
                                {booking.status !== 'Cancelled' && (
                                  <button className="btn btn-danger btn-xs" onClick={() => handleQuickCancel(booking)}>Cancel</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <NewBookingModal isOpen={showNew} onClose={() => setShowNew(false)} onSave={handleSaveBooking} />
      <ViewBookingModal
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
