import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'

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
      <div className="grid grid-cols-[1fr_1fr] gap-3 mb-[18px]">
        {[
          ['Room Number', room.number],
          ['Floor',       `Floor ${room.floor}`],
          ['Type',        room.type],
          ['Daily Rate',  `₹${room.dailyRate?.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface2 border border-line rounded-lg px-[14px] py-2.5">
            <p className="t-label m-0">
              {label}
            </p>
            <p className="t-title mt-1">
              {value}
            </p>
          </div>
        ))}

        {/* Status spans full width */}
        <div className="bg-surface2 border border-line rounded-lg px-[14px] py-2.5 col-[1/-1]">
          <p className="t-label mb-1.5">
            Status
          </p>
          <Badge type={badgeType}>{STATUS_LABEL[room.status]}</Badge>
        </div>
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div className="bg-danger-bg rounded-lg px-4 py-[13px] mb-[18px]">
          <p className="t-label mb-2 text-danger-text">
            Current Occupant
          </p>
          <div className="flex items-center gap-3">
            <div className="t-title w-9 h-9 rounded-full bg-danger-text text-white flex items-center justify-center shrink-0">
              {room.guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="t-title m-0">{room.guest.name}</p>
              <p className="t-xs mt-0.5">{room.guest.phone}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </>
  )
}

// ─── Floor Section ────────────────────────────────────────────────────────────
function FloorSection({ floorNum, rooms, onRoomClick }) {
  return (
    <div className="mb-8">
      {/* Floor label + rule */}
      <div className="flex items-center gap-3 mb-[14px]">
        <span className="t-label whitespace-nowrap shrink-0">
          Floor {floorNum}
        </span>
        <hr className="flex-1 border-none border-t border-t-line m-0" />
        <span className="t-label shrink-0">
          {rooms.length} room{rooms.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Room grid */}
      <div className="grid grid-cols-[repeat(8,1fr)] gap-2">
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
      <p className="t-title m-0 leading-[1.1] tracking-[-0.02em]">
        {room.number}
      </p>

      {/* Type abbreviation */}
      <p className="mt-[3px] text-[9px] font-medium opacity-70 uppercase tracking-[0.04em] leading-none">
        {abbr}
      </p>

      {/* Occupied indicator dot */}
      {room.status === 'occupied' && (
        <div className="w-[5px] h-[5px] rounded-full bg-danger-text mx-auto mt-1 opacity-80" />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FloorPlan({ rooms: propRooms }) {
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
    <div className="px-7 py-6 max-w-[1400px] mx-auto">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="mb-[22px]">
        <h1 className="text-[26px] font-extrabold m-0 text-ink tracking-[-0.03em]">
          Floor Plan
        </h1>
        <p className="t-sm mt-[3px] text-ink3">
          Visual room layout by floor
        </p>
      </div>

      {/* ── Legend + Summary Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-7 bg-surface border border-line rounded-[var(--radius)] px-[18px] py-[13px]">
        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="t-label">
            Legend
          </span>
          {LEGEND.map(({ status, label, bg, color, dot }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="w-[14px] h-[14px] rounded-[3px] shrink-0"
                style={{ background: bg, border: `1.5px solid ${dot}` }}
              />
              <span className="t-xs">{label}</span>
            </div>
          ))}
        </div>

        {/* Occupancy summary */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="t-label">
            {counts.occupied}/{counts.total} occupied
          </span>
          {/* Mini progress bar */}
          <div className="w-[100px] h-1.5 bg-surface2 rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-danger rounded-[3px] transition-all duration-[400ms] ease-[ease]"
              style={{ width: `${Math.round((counts.occupied / counts.total) * 100)}%` }}
            />
          </div>
          <span className="t-label">
            {Math.round((counts.occupied / counts.total) * 100)}%
          </span>
        </div>
      </div>

      {/* ── Quick stat chips ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-7">
        {LEGEND.map(({ status, label, bg, color }) => (
          <div
            key={status}
            className="flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-[12px] font-semibold"
            style={{ background: bg, color }}
          >
            <span className="t-h3">
              {counts[status]}
            </span>
            <span className="font-medium opacity-85">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Floor Sections ──────────────────────────────────────────────────── */}
      {floors.length === 0 ? (
        <div className="empty-state">
          <p className="t-display mb-2">🏨</p>
          <p className="m-0 font-semibold text-ink2">No rooms found</p>
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
