import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { useStore } from '../../../store/useStore'

// ─── Mock Data ────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// Short abbreviation for room type
const TYPE_ABBR = {
  Single: 'Sgl',
  Double: 'Dbl',
  Suite:  'Ste',
  Deluxe: 'Dlx',
}

const LEGEND = [
  { status: 'available',   label: 'Available',   bg: 'var(--green-bg)',  color: 'var(--green-text)',  dot: 'var(--green)'  },
  { status: 'occupied',    label: 'Occupied',    bg: 'var(--red-bg)',    color: 'var(--red-text)',    dot: 'var(--red)'    },
  { status: 'maintenance', label: 'Maintenance', bg: 'var(--amber-bg)',  color: 'var(--amber-text)',  dot: 'var(--amber)'  },
  { status: 'reserved',    label: 'Reserved',    bg: 'var(--blue-bg)',   color: 'var(--blue-text)',   dot: 'var(--blue)'   },
]

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function FloorPlanRoomDetail({ room, onClose }) {
  if (!room) return null
  const badgeType = STATUS_BADGE[room.status] || 'grey'

  return (
    <>
      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        {[
          ['Room Number', room.number],
          ['Floor',       `Floor ${room.floor}`],
          ['Type',        room.type],
          ['Daily Rate',  `₹${room.dailyRate?.toLocaleString()}`],
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
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {value}
            </p>
          </div>
        ))}

        {/* Status spans full width */}
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          gridColumn: '1 / -1',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status
          </p>
          <Badge type={badgeType}>{STATUS_LABEL[room.status]}</Badge>
        </div>
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div style={{
          background: 'var(--red-bg)',
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

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </>
  )
}

// ─── Floor Section ────────────────────────────────────────────────────────────
function FloorSection({ floorNum, rooms, onRoomClick }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Floor label + rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: 'var(--text3)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Floor {floorNum}
        </span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
          {rooms.length} room{rooms.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Room grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 8,
      }}>
        {rooms.map(room => (
          <FloorRoomCell key={room.id} room={room} onClick={() => onRoomClick(room)} />
        ))}
      </div>
    </div>
  )
}

// ─── Individual Floor Room Cell ───────────────────────────────────────────────
function FloorRoomCell({ room, onClick }) {
  const abbr = TYPE_ABBR[room.type] || room.type.slice(0, 3).toUpperCase()

  return (
    <div
      className={`fp-room ${room.status}`}
      onClick={onClick}
      title={`Room ${room.number} — ${room.type} — ${STATUS_LABEL[room.status]}${room.guest ? ` — ${room.guest.name}` : ''}`}
    >
      {/* Room number */}
      <p style={{
        margin: 0,
        fontFamily: "'Syne', sans-serif",
        fontSize: 14,
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}>
        {room.number}
      </p>

      {/* Type abbreviation */}
      <p style={{
        margin: '3px 0 0',
        fontSize: 9,
        fontWeight: 500,
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1,
      }}>
        {abbr}
      </p>

      {/* Occupied indicator dot */}
      {room.status === 'occupied' && (
        <div style={{
          width: 5, height: 5,
          borderRadius: '50%',
          background: 'var(--red-text)',
          margin: '4px auto 0',
          opacity: 0.8,
        }} />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FloorPlan({ rooms: propRooms }) {
  useStore() // subscribe to global store

  const rooms = propRooms ?? mockRooms

  const [selectedRoom, setSelectedRoom] = useState(null)

  // Group rooms by floor, sorted ascending
  const floors = useMemo(() => {
    const map = {}
    for (const room of rooms) {
      if (!map[room.floor]) map[room.floor] = []
      map[room.floor].push(room)
    }
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b)
      .map(floorNum => ({ floorNum, rooms: map[floorNum] }))
  }, [rooms])

  // Summary counts
  const counts = useMemo(() => ({
    total:       rooms.length,
    available:   rooms.filter(r => r.status === 'available').length,
    occupied:    rooms.filter(r => r.status === 'occupied').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    reserved:    rooms.filter(r => r.status === 'reserved').length,
  }), [rooms])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 26,
          fontWeight: 800,
          margin: 0,
          color: 'var(--text)',
          letterSpacing: '-0.03em',
        }}>
          Floor Plan
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Visual room layout by floor
        </p>
      </div>

      {/* ── Legend + Summary Bar ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 28,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '13px 18px',
      }}>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Legend
          </span>
          {LEGEND.map(({ status, label, bg, color, dot }) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 14, height: 14,
                borderRadius: 3,
                background: bg,
                border: `1.5px solid ${dot}`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Occupancy summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {counts.occupied}/{counts.total} occupied
          </span>
          {/* Mini progress bar */}
          <div style={{ width: 100, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((counts.occupied / counts.total) * 100)}%`,
              background: 'var(--red)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            {Math.round((counts.occupied / counts.total) * 100)}%
          </span>
        </div>
      </div>

      {/* ── Quick stat chips ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {LEGEND.map(({ status, label, bg, color }) => (
          <div key={status} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: bg,
            color,
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}>
            <span style={{ fontSize: 15, fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
              {counts[status]}
            </span>
            <span style={{ fontWeight: 500, opacity: 0.85 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Floor Sections ──────────────────────────────────────────────────── */}
      {floors.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, margin: '0 0 8px' }}>🏨</p>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No rooms found</p>
        </div>
      ) : (
        floors.map(({ floorNum, rooms: floorRooms }) => (
          <FloorSection
            key={floorNum}
            floorNum={floorNum}
            rooms={floorRooms}
            onRoomClick={setSelectedRoom}
          />
        ))
      )}

      {/* ── Room Detail Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title={selectedRoom ? `Room ${selectedRoom.number} — Floor ${selectedRoom.floor}` : ''}
        maxWidth="480px"
      >
        <FloorPlanRoomDetail
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
        />
      </Modal>
    </div>
  )
}
