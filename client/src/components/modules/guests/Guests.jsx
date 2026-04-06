import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { useToast } from '../../../hooks/useToast'
import { useStore } from '../../../store/useStore'
import { formatDate, formatCurrency, statusColor, stayTypeColor } from '../../../utils/format'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_GUESTS = [
  { id: '1', docId: 'DOC-0001', name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@email.com', room: '102', stayType: 'monthly', checkInDate: '2026-03-01', checkOutDate: null, months: 3, status: 'Active', foodPlan: 'Breakfast Only', tags: ['VIP'], stayCount: 3, idType: 'Aadhaar', idNumber: '1234-5678-9012', documents: 2, amenities: ['AC', 'WiFi'], facilities: ['AC', 'WiFi', 'TV'] },
  { id: '2', docId: 'DOC-0002', name: 'Priya Patel', phone: '9123456789', email: 'priya@email.com', room: '205', stayType: 'daily', checkInDate: '2026-04-03', checkOutDate: '2026-04-10', months: null, status: 'Active', foodPlan: 'All Meals', tags: ['Corporate'], stayCount: 1, idType: 'PAN', idNumber: 'ABCDE1234F', documents: 3, amenities: [], facilities: ['AC', 'WiFi'] },
  { id: '3', docId: 'DOC-0003', name: 'Ankit Singh', phone: '9988776655', email: '', room: '312', stayType: 'monthly', checkInDate: '2026-03-15', checkOutDate: null, months: 1, status: 'Due', foodPlan: 'No Meals', tags: ['Long-term'], stayCount: 5, idType: 'Aadhaar', idNumber: '9876-5432-1098', documents: 4, amenities: ['Mini Fridge'], facilities: ['AC'] },
  { id: '4', docId: 'DOC-0004', name: 'Sneha Rao', phone: '9654321098', email: 'sneha@email.com', room: '118', stayType: 'daily', checkInDate: '2026-04-01', checkOutDate: '2026-04-06', months: null, status: 'Due', foodPlan: 'Dinner Only', tags: [], stayCount: 2, idType: 'Passport', idNumber: 'P1234567', documents: 2, amenities: [], facilities: ['WiFi'] },
  { id: '5', docId: 'DOC-0005', name: 'Vijay Kumar', phone: '9543210987', email: 'vijay@email.com', room: '221', stayType: 'monthly', checkInDate: '2026-02-01', checkOutDate: null, months: 2, status: 'Checked Out', foodPlan: 'Breakfast Only', tags: ['VIP', 'Long-term'], stayCount: 8, idType: 'Voter ID', idNumber: 'ABC1234567', documents: 3, amenities: [], facilities: ['AC', 'WiFi', 'TV', 'Geyser'] },
]

const FOOD_PLANS = ['Breakfast Only', 'All Meals', 'Dinner Only', 'No Meals']
const GUEST_TAGS = ['VIP', 'Corporate', 'Long-term']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDueDate(guest) {
  if (guest.stayType === 'daily') return guest.checkOutDate
  if (guest.stayType === 'monthly' && guest.checkInDate && guest.months) {
    const d = new Date(guest.checkInDate)
    d.setMonth(d.getMonth() + guest.months)
    return d.toISOString().split('T')[0]
  }
  return null
}

function getTagClass(tag) {
  if (tag === 'VIP') return 'gtag gtag-vip'
  if (tag === 'Corporate') return 'gtag gtag-corp'
  if (tag === 'Long-term') return 'gtag gtag-long'
  return 'gtag gtag-long'
}

function calcCheckout(guest) {
  const rent = guest.stayType === 'monthly' ? 14000 : 800
  const food = guest.foodPlan === 'All Meals' ? 8000 : guest.foodPlan === 'No Meals' ? 0 : 2500
  const amenities = guest.amenities.length * 800
  const subtotal = rent + food + amenities
  const gst = Math.round(subtotal * 0.12)
  return { rent, food, amenities, gst, total: subtotal + gst }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GuestDetailModal({ guest, onClose, onCheckout, onEdit }) {
  if (!guest) return null
  const dueDate = getDueDate(guest)
  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={
        <span>
          {guest.name}{' '}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--gold)', fontWeight: 400 }}>
            {guest.docId}
          </span>
        </span>
      }
      maxWidth="700px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          {(guest.status === 'Active' || guest.status === 'Due') && (
            <button className="btn btn-danger btn-sm" onClick={() => onCheckout(guest)}>Checkout</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(guest)}>Edit</button>
        </>
      }
    >
      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: '16px' }}>
        {[
          ['Phone', guest.phone || '—'],
          ['Email', guest.email || '—'],
          ['ID Type', guest.idType],
          ['ID Number', guest.idNumber],
          ['Room', guest.room],
          ['Stay Type', guest.stayType === 'monthly' ? 'Monthly' : 'Daily'],
          ['Check-In', formatDate(guest.checkInDate)],
          ['Due Date', formatDate(dueDate)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="form-label" style={{ marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {guest.tags.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div className="form-label" style={{ marginBottom: '6px' }}>Tags</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {guest.tags.map(t => <span key={t} className={getTagClass(t)}>{t}</span>)}
          </div>
        </div>
      )}

      {/* Facilities */}
      {guest.facilities.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div className="form-label" style={{ marginBottom: '6px' }}>Facilities</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {guest.facilities.map(f => (
              <span key={f} className="badge badge-grey">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {guest.amenities.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div className="form-label" style={{ marginBottom: '6px' }}>Amenities</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {guest.amenities.map(a => (
              <span key={a} className="badge badge-blue">{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div className="form-label">Documents</div>
        <Badge type={guest.documents >= 4 ? 'green' : guest.documents >= 2 ? 'amber' : 'red'}>
          {guest.documents} / 4 uploaded
        </Badge>
      </div>

      {/* Food Plan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="form-label">Food Plan</div>
        <span className="badge badge-amber">{guest.foodPlan}</span>
      </div>
    </Modal>
  )
}

function CheckoutModal({ guest, onClose, onConfirm }) {
  const [payMethod, setPayMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  if (!guest) return null
  const { rent, food, amenities, gst, total } = calcCheckout(guest)
  const dueDate = getDueDate(guest)

  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={`Checkout — ${guest.name}`}
      maxWidth="500px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={() => onConfirm(guest, notes, payMethod)}>
            Confirm Checkout
          </button>
        </>
      }
    >
      {/* Summary */}
      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ marginBottom: '10px', fontWeight: 600, fontSize: '13px' }}>Billing Summary</div>
        {[
          ['Room', `${guest.room}`],
          ['Stay Period', `${formatDate(guest.checkInDate)} → ${formatDate(dueDate)}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12.5px', color: 'var(--text2)' }}>
            <span>{k}</span><span>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />
        {[
          ['Rent', rent],
          ['Food', food],
          ['Amenities', amenities],
          ['GST (12%)', gst],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text2)' }}>{k}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(v)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
          <span>Total</span>
          <span style={{ color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Payment Method */}
      <div style={{ marginBottom: '12px' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Payment Method</label>
        <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
          {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..." />
      </div>
    </Modal>
  )
}

function EditGuestModal({ guest, onClose, onSave }) {
  const [form, setForm] = useState(guest ? { ...guest } : {})
  if (!guest) return null

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const toggleTag = (tag) => {
    const tags = form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]
    set('tags', tags)
  }
  const dueDate = getDueDate(form)

  return (
    <Modal
      isOpen={!!guest}
      onClose={onClose}
      title={`Edit — ${guest.name}`}
      maxWidth="580px"
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(form)}>Save Changes</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Name */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Name</label>
          <input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} />
        </div>
        {/* Phone */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Phone</label>
          <input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
        </div>
        {/* Room */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Room</label>
          <input className="form-input" value={form.room || ''} onChange={e => set('room', e.target.value)} />
        </div>
        {/* Stay Type */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Stay Type</label>
          <select className="form-select" value={form.stayType} onChange={e => set('stayType', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {/* Check-In */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Check-In Date</label>
          <input type="date" className="form-input" value={form.checkInDate || ''} onChange={e => set('checkInDate', e.target.value)} />
        </div>
        {/* Due Date */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>
            {form.stayType === 'monthly' ? 'Months' : 'Check-Out Date'}
          </label>
          {form.stayType === 'monthly'
            ? <input type="number" className="form-input" min="1" value={form.months || ''} onChange={e => set('months', Number(e.target.value))} />
            : <input type="date" className="form-input" value={form.checkOutDate || ''} onChange={e => set('checkOutDate', e.target.value)} />
          }
        </div>
        {/* Food Plan */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Food Plan</label>
          <select className="form-select" value={form.foodPlan} onChange={e => set('foodPlan', e.target.value)}>
            {FOOD_PLANS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {/* Status */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '5px' }}>Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {['Active', 'Due', 'Checked Out'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div style={{ marginTop: '14px' }}>
        <label className="form-label" style={{ display: 'block', marginBottom: '7px' }}>Tags</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {GUEST_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={getTagClass(tag)}
              style={{
                cursor: 'pointer',
                opacity: form.tags?.includes(tag) ? 1 : 0.4,
                border: form.tags?.includes(tag) ? undefined : '1px dashed var(--border2)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Guests() {
  const addToast = useToast()
  const setActivePanel = useStore(s => s.setActivePanel)

  const [guests, setGuests] = useState(MOCK_GUESTS)
  const [search, setSearch] = useState('')
  const [stayFilter, setStayFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [viewGuest, setViewGuest] = useState(null)
  const [checkoutGuest, setCheckoutGuest] = useState(null)
  const [editGuest, setEditGuest] = useState(null)

  // Filtered list
  const filtered = useMemo(() => {
    return guests.filter(g => {
      const q = search.toLowerCase()
      const matchSearch = !q || g.name.toLowerCase().includes(q) || g.room.includes(q) || g.docId.toLowerCase().includes(q)
      const matchStay = stayFilter === 'All' || g.stayType === stayFilter.toLowerCase()
      const matchStatus = statusFilter === 'All' || g.status === statusFilter
      return matchSearch && matchStay && matchStatus
    })
  }, [guests, search, stayFilter, statusFilter])

  // Stats
  const activeCount = guests.filter(g => g.status === 'Active').length
  const dueCount = guests.filter(g => g.status === 'Due').length
  const checkedOutCount = guests.filter(g => g.status === 'Checked Out').length

  // Handlers
  const handleCheckoutConfirm = (guest, notes, payMethod) => {
    setGuests(gs => gs.map(g => g.id === guest.id ? { ...g, status: 'Checked Out' } : g))
    setCheckoutGuest(null)
    setViewGuest(null)
    addToast(`${guest.name} checked out successfully`, 'success')
  }

  const handleEditSave = (updated) => {
    setGuests(gs => gs.map(g => g.id === updated.id ? updated : g))
    setEditGuest(null)
    addToast('Guest details updated', 'success')
  }

  const handleExportCSV = () => {
    addToast('CSV exported', 'success')
  }

  const openCheckout = (guest) => {
    setViewGuest(null)
    setCheckoutGuest(guest)
  }

  const openEdit = (guest) => {
    setViewGuest(null)
    setEditGuest(guest)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1300px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            All Guests
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '13px' }}>Guest registry & stay history</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActivePanel('checkin')}>
          + Check-In
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { label: 'Active', count: activeCount, type: 'green', bar: 'stat-bar-green' },
          { label: 'Due', count: dueCount, type: 'amber', bar: 'stat-bar-amber' },
          { label: 'Checked Out', count: checkedOutCount, type: 'grey', bar: '' },
        ].map(({ label, count, type, bar }) => (
          <div key={label} className={`stat-card ${bar}`}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '26px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '15px' }}>⌕</span>
            <input
              className="form-input"
              style={{ paddingLeft: '30px' }}
              placeholder="Search name, room, DOC ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Stay Type */}
          <select className="form-select" style={{ width: '140px' }} value={stayFilter} onChange={e => setStayFilter(e.target.value)}>
            <option>All</option>
            <option>Daily</option>
            <option>Monthly</option>
          </select>
          {/* Status */}
          <select className="form-select" style={{ width: '150px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option>All</option>
            <option>Active</option>
            <option>Due</option>
            <option>Checked Out</option>
          </select>
          {/* Export */}
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>DOC ID</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Type</th>
                <th>Check-In</th>
                <th>Due / Out</th>
                <th>Food Plan</th>
                <th>Stays</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">No guests found</div>
                  </td>
                </tr>
              )}
              {filtered.map(guest => {
                const dueDate = getDueDate(guest)
                return (
                  <tr key={guest.id}>
                    {/* DOC ID */}
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontSize: '12px', fontWeight: 600 }}>
                        {guest.docId}
                      </span>
                    </td>
                    {/* Guest */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{guest.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '1px' }}>{guest.phone}</div>
                    </td>
                    {/* Room */}
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{guest.room}</span>
                    </td>
                    {/* Stay Type */}
                    <td>
                      <Badge type={guest.stayType === 'monthly' ? 'purple' : 'blue'}>
                        {guest.stayType === 'monthly' ? 'Monthly' : 'Daily'}
                      </Badge>
                    </td>
                    {/* Check-In */}
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{formatDate(guest.checkInDate)}</td>
                    {/* Due / Out */}
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{formatDate(dueDate)}</td>
                    {/* Food Plan */}
                    <td style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{guest.foodPlan}</td>
                    {/* Stays */}
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>{guest.stayCount}</span>
                    </td>
                    {/* Tags */}
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {guest.tags.map(t => (
                          <span key={t} className={getTagClass(t)}>{t}</span>
                        ))}
                      </div>
                    </td>
                    {/* Status */}
                    <td>
                      <Badge type={statusColor(guest.status).replace('badge-', '')}>
                        {guest.status}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-outline btn-xs" onClick={() => setViewGuest(guest)}>View</button>
                        {(guest.status === 'Active' || guest.status === 'Due') && (
                          <button className="btn btn-danger btn-xs" onClick={() => setCheckoutGuest(guest)}>Checkout</button>
                        )}
                        {guest.status === 'Due' && (
                          <button className="btn btn-xs" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
                            onClick={() => { addToast(`Renewed stay for ${guest.name}`, 'success') }}>
                            Renew
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <GuestDetailModal
        guest={viewGuest}
        onClose={() => setViewGuest(null)}
        onCheckout={openCheckout}
        onEdit={openEdit}
      />
      <CheckoutModal
        guest={checkoutGuest}
        onClose={() => setCheckoutGuest(null)}
        onConfirm={handleCheckoutConfirm}
      />
      <EditGuestModal
        guest={editGuest}
        onClose={() => setEditGuest(null)}
        onSave={handleEditSave}
      />
    </div>
  )
}
