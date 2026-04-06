import { useState } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { useStore } from '../../../store/useStore'

// ─── Mock Data ───────────────────────────────────────────────────────────────
const mockRooms = [
  { id: '1',  number: '101', type: 'Single',  floor: 1, status: 'available',   dailyRate: 500,  monthlyRate: 9000  },
  { id: '2',  number: '102', type: 'Double',  floor: 1, status: 'occupied',    dailyRate: 800,  monthlyRate: 14000, guest: { name: 'Rahul Sharma', phone: '9876543210' } },
  { id: '3',  number: '103', type: 'Suite',   floor: 1, status: 'maintenance', dailyRate: 1500, monthlyRate: 28000 },
  { id: '4',  number: '104', type: 'Deluxe',  floor: 1, status: 'reserved',    dailyRate: 1200, monthlyRate: 22000 },
  { id: '5',  number: '201', type: 'Single',  floor: 2, status: 'available',   dailyRate: 500,  monthlyRate: 9000  },
  { id: '6',  number: '202', type: 'Double',  floor: 2, status: 'occupied',    dailyRate: 800,  monthlyRate: 14000, guest: { name: 'Priya Patel', phone: '9123456789' } },
  { id: '7',  number: '203', type: 'Suite',   floor: 2, status: 'available',   dailyRate: 1500, monthlyRate: 28000 },
  { id: '8',  number: '204', type: 'Deluxe',  floor: 2, status: 'occupied',    dailyRate: 1200, monthlyRate: 22000, guest: { name: 'Ankit Singh', phone: '9988776655' } },
  { id: '9',  number: '301', type: 'Single',  floor: 3, status: 'available',   dailyRate: 500,  monthlyRate: 9000  },
  { id: '10', number: '302', type: 'Double',  floor: 3, status: 'reserved',    dailyRate: 800,  monthlyRate: 14000 },
  { id: '11', number: '303', type: 'Suite',   floor: 3, status: 'occupied',    dailyRate: 1500, monthlyRate: 28000, guest: { name: 'Sneha Rao', phone: '9654321098' } },
  { id: '12', number: '304', type: 'Single',  floor: 3, status: 'available',   dailyRate: 500,  monthlyRate: 9000  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  available:   'green',
  occupied:    'red',
  maintenance: 'amber',
  reserved:    'blue',
}

const STATUS_LABEL = {
  available:   'Available',
  occupied:    'Occupied',
  maintenance: 'Maintenance',
  reserved:    'Reserved',
}

const FILTERS = ['All', 'Available', 'Occupied', 'Maintenance', 'Reserved']

const EMPTY_FORM = {
  number: '', type: 'Single', floor: '', dailyRate: '', monthlyRate: '', maxOccupancy: '',
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ title, rooms, badgeType, onSelect }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      minWidth: 0,
      flex: '1 1 220px',
    }}>
      <div style={{
        padding: '11px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </span>
        <Badge type={badgeType}>{rooms.length}</Badge>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rooms.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
            No rooms
          </p>
        )}
        {rooms.map(room => (
          <div
            key={room.id}
            className={`room-card ${room.status}`}
            onClick={() => onSelect(room)}
            style={{ padding: '10px 13px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {room.number}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Floor {room.floor}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)' }}>{room.type}</p>
            {room.guest && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text2)' }}>
                {room.guest.name}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function RoomDetail({ room, onClose, onStatusChange }) {
  if (!room) return null

  const badgeType = STATUS_BADGE[room.status] || 'grey'

  return (
    <>
      {/* Room header info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        marginBottom: 18,
      }}>
        {[
          ['Room Number', room.number],
          ['Type',        room.type],
          ['Floor',       `Floor ${room.floor}`],
          ['Status',      null],
          ['Daily Rate',  `₹${room.dailyRate?.toLocaleString()}`],
          ['Monthly Rate',`₹${room.monthlyRate?.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </p>
            {value ? (
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                {value}
              </p>
            ) : (
              <div style={{ marginTop: 4 }}>
                <Badge type={badgeType}>{STATUS_LABEL[room.status]}</Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid var(--red-bg)',
          borderRadius: 8,
          padding: '13px 16px',
          marginBottom: 18,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: 'var(--red-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Current Occupant
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--red-text)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, flexShrink: 0,
            }}>
              {room.guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{room.guest.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text2)' }}>{room.guest.phone}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Quick Actions
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {room.status !== 'available' && (
            <Button variant="success" size="sm" onClick={() => { onStatusChange(room.id, 'available'); onClose() }}>
              Mark Available
            </Button>
          )}
          {room.status !== 'maintenance' && (
            <Button variant="outline" size="sm" onClick={() => { onStatusChange(room.id, 'maintenance'); onClose() }}>
              Mark Maintenance
            </Button>
          )}
          {room.status === 'occupied' && room.guest && (
            <Button variant="outline" size="sm">
              View Guest
            </Button>
          )}
          {room.status !== 'reserved' && room.status !== 'occupied' && (
            <Button variant="outline" size="sm" onClick={() => { onStatusChange(room.id, 'reserved'); onClose() }}>
              Mark Reserved
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Add Room Form ────────────────────────────────────────────────────────────
function AddRoomForm({ form, onChange }) {
  const field = (label, key, type = 'text', extra = {}) => (
    <div key={key}>
      <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>{label}</label>
      <input
        className="form-input"
        type={type}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        {...extra}
      />
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {field('Room Number', 'number', 'text', { placeholder: 'e.g. 105' })}

      {/* Room Type select */}
      <div>
        <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Room Type</label>
        <select
          className="form-select"
          value={form.type}
          onChange={e => onChange('type', e.target.value)}
        >
          {['Single', 'Double', 'Suite', 'Deluxe'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {field('Floor', 'floor', 'number', { placeholder: '1', min: 1 })}
      {field('Daily Rate ₹', 'dailyRate', 'number', { placeholder: '500', min: 0 })}
      {field('Monthly Rate ₹', 'monthlyRate', 'number', { placeholder: '9000', min: 0 })}
      {field('Max Occupancy', 'maxOccupancy', 'number', { placeholder: '2', min: 1 })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Rooms() {
  useStore() // subscribe so component re-renders on store changes if needed

  const [rooms, setRooms]             = useState(mockRooms)
  const [filter, setFilter]           = useState('All')
  const [search, setSearch]           = useState('')
  const [view, setView]               = useState('grid')   // 'grid' | 'kanban'
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm]         = useState(EMPTY_FORM)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = rooms.filter(r => {
    const matchesFilter = filter === 'All' || r.status === filter.toLowerCase()
    const matchesSearch = r.number.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStatusChange = (id, newStatus) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  const handleAddRoom = () => {
    if (!addForm.number.trim() || !addForm.floor) return
    const newRoom = {
      id:           Date.now().toString(),
      number:       addForm.number.trim(),
      type:         addForm.type,
      floor:        parseInt(addForm.floor, 10),
      status:       'available',
      dailyRate:    parseFloat(addForm.dailyRate) || 0,
      monthlyRate:  parseFloat(addForm.monthlyRate) || 0,
      maxOccupancy: parseInt(addForm.maxOccupancy, 10) || 1,
    }
    setRooms(prev => [...prev, newRoom])
    setAddForm(EMPTY_FORM)
    setShowAddModal(false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const counts = {
    available:   rooms.filter(r => r.status === 'available').length,
    occupied:    rooms.filter(r => r.status === 'occupied').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    reserved:    rooms.filter(r => r.status === 'reserved').length,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
          }}>
            Rooms
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Manage room inventory
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          + Add Room
        </Button>
      </div>

      {/* ── Quick Stats ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Available',   count: counts.available,   color: 'var(--green)',  bg: 'var(--green-bg)',  tc: 'var(--green-text)'  },
          { label: 'Occupied',    count: counts.occupied,    color: 'var(--red)',    bg: 'var(--red-bg)',    tc: 'var(--red-text)'    },
          { label: 'Maintenance', count: counts.maintenance, color: 'var(--amber)',  bg: 'var(--amber-bg)',  tc: 'var(--amber-text)'  },
          { label: 'Reserved',    count: counts.reserved,    color: 'var(--blue)',   bg: 'var(--blue-bg)',   tc: 'var(--blue-text)'   },
          { label: 'Total',       count: rooms.length,       color: 'var(--gold)',   bg: 'var(--gold-bg)',   tc: 'var(--gold)'        },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            borderBottom: `3px solid ${s.color}`,
          }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: s.tc }}>{s.count}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter / Search / View Toggle ──────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 13px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  background: active ? 'var(--gold-bg)' : 'var(--surface)',
                  border: active ? '1px solid var(--gold)' : '1px solid var(--border)',
                  color: active ? 'var(--gold)' : 'var(--text2)',
                  transition: 'all 0.13s',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {f}
              </button>
            )
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'var(--text3)', pointerEvents: 'none',
          }}>
            ⌕
          </span>
          <input
            className="form-input"
            type="text"
            placeholder="Search room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, width: 160, fontSize: 12 }}
          />
        </div>

        {/* View toggle */}
        <div style={{
          display: 'flex',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {[
            { key: 'grid',   icon: '▦', title: 'Grid view'   },
            { key: 'kanban', icon: '☰', title: 'Kanban view' },
          ].map(({ key, icon, title }) => {
            const active = view === key
            return (
              <button
                key={key}
                title={title}
                onClick={() => setView(key)}
                style={{
                  padding: '6px 11px',
                  fontSize: 14,
                  cursor: 'pointer',
                  background: active ? 'var(--gold-bg)' : 'var(--surface)',
                  color: active ? 'var(--gold)' : 'var(--text3)',
                  border: 'none',
                  borderRight: key === 'grid' ? '1px solid var(--border)' : 'none',
                  transition: 'all 0.13s',
                }}
              >
                {icon}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────────── */}
      {(filter !== 'All' || search) && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          Showing {filtered.length} of {rooms.length} rooms
        </p>
      )}

      {/* ── Grid View ──────────────────────────────────────────────────────── */}
      {view === 'grid' && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>🏨</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No rooms found</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>Try adjusting your filters</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
              gap: 10,
            }}>
              {filtered.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => setSelectedRoom(room)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Kanban View ────────────────────────────────────────────────────── */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {[
            { status: 'available',   label: 'Available',   badge: 'green'  },
            { status: 'occupied',    label: 'Occupied',    badge: 'red'    },
            { status: 'maintenance', label: 'Maintenance', badge: 'amber'  },
            { status: 'reserved',    label: 'Reserved',    badge: 'blue'   },
          ].map(col => (
            <KanbanColumn
              key={col.status}
              title={col.label}
              badgeType={col.badge}
              rooms={filtered.filter(r => r.status === col.status)}
              onSelect={setSelectedRoom}
            />
          ))}
        </div>
      )}

      {/* ── Room Detail Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title={selectedRoom ? `Room ${selectedRoom.number}` : ''}
      >
        <RoomDetail
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onStatusChange={handleStatusChange}
        />
      </Modal>

      {/* ── Add Room Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddForm(EMPTY_FORM) }}
        title="Add New Room"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setAddForm(EMPTY_FORM) }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddRoom}>
              Save Room
            </Button>
          </>
        }
      >
        <AddRoomForm form={addForm} onChange={(key, val) => setAddForm(p => ({ ...p, [key]: val }))} />
      </Modal>
    </div>
  )
}

// ─── Room Card ────────────────────────────────────────────────────────────────
function RoomCard({ room, onClick }) {
  return (
    <div
      className={`room-card ${room.status}`}
      onClick={onClick}
      title={`Room ${room.number} — ${STATUS_LABEL[room.status]}`}
    >
      {/* Room number */}
      <p style={{
        margin: '0 0 2px',
        fontFamily: "'Syne', sans-serif",
        fontSize: 20,
        fontWeight: 800,
        color: 'var(--text)',
        lineHeight: 1.1,
      }}>
        {room.number}
      </p>

      {/* Type */}
      <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text3)' }}>
        {room.type} · Fl {room.floor}
      </p>

      {/* Status badge */}
      <Badge type={STATUS_BADGE[room.status]}>
        {STATUS_LABEL[room.status]}
      </Badge>

      {/* Guest name if occupied */}
      {room.status === 'occupied' && room.guest && (
        <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {room.guest.name}
        </p>
      )}

      {/* Rate */}
      <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text3)' }}>
        ₹{room.dailyRate}/day
      </p>
    </div>
  )
}
