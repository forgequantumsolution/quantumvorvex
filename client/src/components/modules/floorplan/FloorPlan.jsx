import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { appLocale } from '../../../i18n'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { PageWrapper } from '../../ui-tw'

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

// Short abbreviation for room type (room types are data, so these stay as-is)
const TYPE_ABBR = {
  Single: 'Sgl',
  Double: 'Dbl',
  Suite:  'Ste',
  Deluxe: 'Dlx',
}

// Labels come from t(`status.<status>`) at render time.
const LEGEND = [
  { status: 'available',   bg: 'var(--green-bg)',  color: 'var(--green-text)',  dot: 'var(--green)'  },
  { status: 'occupied',    bg: 'var(--red-bg)',    color: 'var(--red-text)',    dot: 'var(--red)'    },
  { status: 'maintenance', bg: 'var(--amber-bg)',  color: 'var(--amber-text)',  dot: 'var(--amber)'  },
  { status: 'reserved',    bg: 'var(--blue-bg)',   color: 'var(--blue-text)',   dot: 'var(--blue)'   },
]

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function FloorPlanRoomDetail({ room, onClose }) {
  const { t } = useTranslation('floorplan')
  if (!room) return null
  const badgeType = STATUS_BADGE[room.status] || 'grey'

  return (
    <>
      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4 sm:mb-[18px]">
        {[
          [t('detail.roomNumber'), room.number],
          [t('detail.floor'),      t('floorN', { n: room.floor })],
          [t('detail.type'),       room.type],
          [t('detail.dailyRate'),  `₹${room.dailyRate?.toLocaleString(appLocale())}`],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 bg-surface2 border border-line rounded-lg px-3 sm:px-[14px] py-2.5">
            <p className="t-label m-0">
              {label}
            </p>
            <p className="t-title mt-1 truncate">
              {value}
            </p>
          </div>
        ))}

        {/* Status spans full width */}
        <div className="bg-surface2 border border-line rounded-lg px-[14px] py-2.5 col-[1/-1]">
          <p className="t-label mb-1.5">
            {t('common:status')}
          </p>
          <Badge type={badgeType}>{t(`status.${room.status}`, { defaultValue: room.status })}</Badge>
        </div>
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div className="bg-danger-bg rounded-lg px-4 py-[13px] mb-[18px]">
          <p className="t-label mb-2 text-danger-text">
            {t('detail.currentOccupant')}
          </p>
          <div className="flex items-center gap-3">
            <div className="t-title w-9 h-9 rounded-full bg-danger-text text-white flex items-center justify-center shrink-0">
              {room.guest.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="t-title m-0 truncate">{room.guest.name}</p>
              <p className="t-xs mt-0.5">{room.guest.phone}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end [&>*]:w-full [&>*]:justify-center sm:[&>*]:w-auto">
        <Button variant="outline" size="sm" onClick={onClose}>{t('common:close')}</Button>
      </div>
    </>
  )
}

// ─── Floor Section ────────────────────────────────────────────────────────────
function FloorSection({ floorNum, rooms, onRoomClick }) {
  const { t } = useTranslation('floorplan')
  return (
    <div className="mb-6 sm:mb-8">
      {/* Floor label + rule */}
      <div className="flex items-center gap-3 mb-[14px]">
        <span className="t-label whitespace-nowrap shrink-0">
          {t('floorN', { n: floorNum })}
        </span>
        <hr className="flex-1 border-none border-t border-t-line m-0" />
        <span className="t-label shrink-0">
          {t('roomCount', { count: rooms.length })}
        </span>
      </div>

      {/* Room grid — as many ~72px tiles per row as fit, wrapping onto more
          rows on narrow screens instead of scrolling sideways. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {rooms.map(room => (
          <FloorRoomCell key={room.id} room={room} onClick={() => onRoomClick(room)} />
        ))}
      </div>
    </div>
  )
}

// ─── Individual Floor Room Cell ───────────────────────────────────────────────
function FloorRoomCell({ room, onClick }) {
  const { t } = useTranslation('floorplan')
  const abbr = TYPE_ABBR[room.type] || room.type.slice(0, 3).toUpperCase()

  return (
    <div
      className={`fp-room ${room.status} min-h-11`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      title={`${t('roomN', { number: room.number })} — ${room.type} — ${t(`status.${room.status}`, { defaultValue: room.status })}${room.guest ? ` — ${room.guest.name}` : ''}`}
    >
      {/* Room number */}
      <p className="t-title m-0 leading-[1.1] tracking-[-0.02em]">
        {room.number}
      </p>

      {/* Type abbreviation */}
      <p className="mt-[3px] text-[10px] font-medium opacity-70 uppercase tracking-[0.04em] leading-none">
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
  const { t } = useTranslation('floorplan')
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
    <PageWrapper title={t('title')} subtitle={t('subtitle')}>

      {/* ── Legend + Summary Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5 bg-surface border border-line rounded-[var(--radius)] px-4 sm:px-[18px] py-3 sm:py-[13px]">
        {/* Legend */}
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className="t-label">
            {t('legend')}
          </span>
          {LEGEND.map(({ status, bg, dot }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="w-[14px] h-[14px] rounded-[3px] shrink-0"
                style={{ background: bg, border: `1.5px solid ${dot}` }}
              />
              <span className="t-xs">{t(`status.${status}`)}</span>
            </div>
          ))}
        </div>

        {/* Occupancy summary */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="t-label">
            {t('occupiedOf', { occupied: counts.occupied, total: counts.total })}
          </span>
          {/* Mini progress bar */}
          <div className="flex-1 sm:flex-none min-w-[60px] sm:w-[100px] h-1.5 bg-surface2 rounded-[3px] overflow-hidden">
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
      <div className="flex gap-2 flex-wrap mb-5 sm:mb-7">
        {LEGEND.map(({ status, bg, color }) => (
          <div
            key={status}
            className="flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-[12px] font-semibold"
            style={{ background: bg, color }}
          >
            <span className="t-h3">
              {counts[status]}
            </span>
            <span className="font-medium opacity-85">{t(`status.${status}`)}</span>
          </div>
        ))}
      </div>

      {/* ── Floor Sections ──────────────────────────────────────────────────── */}
      {floors.length === 0 ? (
        <div className="empty-state">
          <p className="t-display mb-2">🏨</p>
          <p className="m-0 font-semibold text-ink2">{t('noRooms')}</p>
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
        title={selectedRoom ? `${t('roomN', { number: selectedRoom.number })} — ${t('floorN', { n: selectedRoom.floor })}` : ''}
        maxWidth="480px"
      >
        <FloorPlanRoomDetail
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
        />
      </Modal>
    </PageWrapper>
  )
}
