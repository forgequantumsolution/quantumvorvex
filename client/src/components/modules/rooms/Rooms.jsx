import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { LuTrash2 } from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { roomsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'

// Flatten an API room (type is a relation object) to the shape the UI renders.
const normalizeRoom = (r) => ({
  id: r.id,
  number: r.number,
  floor: r.floor,
  status: r.status,
  type: r.type?.name || (typeof r.type === 'string' ? r.type : 'Standard'),
  qrToken: r.qrToken,
})

// Public URL a guest reaches when scanning the room's maintenance QR.
const reportUrl = (qrToken) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/report?t=${qrToken}`

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
  number: '', type: 'Single', floor: '', maxOccupancy: '',
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ title, rooms, badgeType, onSelect }) {
  return (
    <div className="bg-surface border border-line rounded-[var(--radius)] min-w-0 flex-[1_1_220px]">
      <div className="px-4 py-[11px] border-b border-line flex items-center justify-between">
        <span className="t-title">{title}</span>
        <Badge type={badgeType}>{rooms.length}</Badge>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2">
        {rooms.length === 0 && (
          <p className="t-xs text-ink3 text-center py-4 m-0">
            No rooms
          </p>
        )}
        {rooms.map(room => (
          <div
            key={room.id}
            className={`room-card ${room.status} px-[13px] py-2.5`}
            onClick={() => onSelect(room)}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="t-h3">{room.number}</span>
              <span className="t-label">Floor {room.floor}</span>
            </div>
            <p className="t-label m-0">{room.type}</p>
            {room.guest && (
              <p className="t-xs mt-1">{room.guest.name}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function RoomDetail({ room, onClose, onStatusChange, onShowQr, onDelete }) {
  if (!room) return null

  const badgeType = STATUS_BADGE[room.status] || 'grey'

  return (
    <>
      {/* Room header info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-[18px]">
        {[
          ['Room Number', room.number],
          ['Type',        room.type],
          ['Floor',       `Floor ${room.floor}`],
          ['Status',      null],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface2 border border-line rounded-lg px-[14px] py-2.5">
            <p className="t-label">{label}</p>
            {value ? (
              <p className="t-title mt-1">{value}</p>
            ) : (
              <div className="mt-1">
                <Badge type={badgeType}>{STATUS_LABEL[room.status]}</Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div className="bg-danger-bg border border-danger-bg rounded-lg px-4 py-[13px] mb-[18px]">
          <p className="t-label text-danger-text mb-2">
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

      {/* Quick actions */}
      <div>
        <p className="t-label mb-2.5">
          Quick Actions
        </p>
        <div className="flex gap-2 flex-wrap">
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
          <Button variant="outline" size="sm" onClick={() => onShowQr(room)}>
            ▦ Maintenance QR
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(room)}>
            <span className="inline-flex items-center gap-1.5"><LuTrash2 size={15} /> Delete Room</span>
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Room QR Code (maintenance) ───────────────────────────────────────────────
function RoomQrCode({ room }) {
  if (!room) return null

  if (!room.qrToken) {
    return (
      <p className="t-sm text-ink3 text-center py-6 m-0">
        This room has no QR token yet. Run the backfill script, or re-create the room.
      </p>
    )
  }

  const url = reportUrl(room.qrToken)

  // Print just the sticker (QR + room number) in an isolated window.
  const handlePrint = () => {
    const svg = document.getElementById('room-qr-svg')?.outerHTML || ''
    const win = window.open('', '_blank', 'width=420,height=560')
    if (!win) return
    win.document.write(`
      <html>
        <head><title>Room ${room.number} — Report an Issue</title></head>
        <body style="margin:0;font-family:system-ui,sans-serif;text-align:center;padding:40px">
          <h2 style="margin:0 0 4px">Room ${room.number}</h2>
          <p style="margin:0 0 24px;color:#555;font-size:14px">Scan to report a maintenance issue</p>
          ${svg}
          <p style="margin:24px 0 0;color:#888;font-size:11px">No app or login needed</p>
        </body>
      </html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  // Download the QR (with room number caption) as a PNG image.
  const handleDownload = () => {
    const svg = document.getElementById('room-qr-svg')
    if (!svg) return

    const PAD = 24
    const QR = 200
    const TITLE_H = 40
    const W = QR + PAD * 2
    const H = QR + PAD * 2 + TITLE_H

    const svgData = new XMLSerializer().serializeToString(svg)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#111111'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Room ${room.number}`, W / 2, PAD + TITLE_H / 2)

      ctx.drawImage(img, PAD, PAD + TITLE_H, QR, QR)

      const link = document.createElement('a')
      link.download = `room-${room.number}-qr.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = svgUrl
  }

  return (
    <div className="text-center">
      <p className="t-sm text-ink3 mb-4">
        Print this and place it in the room. Guests scan it to report a maintenance issue — no login needed.
      </p>
      <div className="inline-flex bg-white p-4 rounded-lg border border-line">
        <QRCodeSVG id="room-qr-svg" value={url} size={200} level="M" includeMargin />
      </div>
      <p className="t-xs text-ink3 break-all mt-3">{url}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="primary" onClick={handlePrint}>🖨 Print sticker</Button>
        <Button variant="outline" onClick={handleDownload}>⬇ Download QR</Button>
      </div>
    </div>
  )
}

// ─── Add Room Form ────────────────────────────────────────────────────────────
function AddRoomForm({ form, onChange }) {
  const field = (label, key, type = 'text', extra = {}) => (
    <div key={key}>
      <label className="form-label block mb-[5px]">{label}</label>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {field('Room Number', 'number', 'text', { placeholder: 'e.g. 105' })}

      {/* Room Type select */}
      <div>
        <label className="form-label block mb-[5px]">Room Type</label>
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
      {field('Max Occupancy', 'maxOccupancy', 'number', { placeholder: '2', min: 1 })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Rooms() {
  const addToast = useToast()
  const [rooms, setRooms]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [filter, setFilter]           = useState('All')
  const [search, setSearch]           = useState('')
  const [view, setView]               = useState('grid')   // 'grid' | 'kanban'
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [qrRoom, setQrRoom]           = useState(null)
  const [deleteRoom, setDeleteRoom]   = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm]         = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await roomsApi.getAll()
      setRooms((data.rooms || []).map(normalizeRoom))
    } catch {
      setError('Could not load rooms. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = rooms.filter(r => {
    const matchesFilter = filter === 'All' || r.status === filter.toLowerCase()
    const matchesSearch = r.number.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    const prev = rooms
    setRooms(rs => rs.map(r => r.id === id ? { ...r, status: newStatus } : r))
    try {
      await roomsApi.update(id, { status: newStatus })
    } catch {
      setRooms(prev)
      addToast('Could not update room status', 'error')
    }
  }

  const handleAddRoom = async () => {
    if (!addForm.number.trim() || !addForm.floor) return
    try {
      await roomsApi.create({
        number: addForm.number.trim(),
        typeName: addForm.type,
        floor: parseInt(addForm.floor, 10),
        status: 'available',
      })
      setAddForm(EMPTY_FORM)
      setShowAddModal(false)
      addToast(`Room ${addForm.number.trim()} added`, 'success')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not add room', 'error')
    }
  }

  const handleDeleteRoom = async () => {
    if (!deleteRoom) return
    setDeleting(true)
    try {
      await roomsApi.delete(deleteRoom.id)
      addToast(`Room ${deleteRoom.number} deleted`, 'success')
      setDeleteRoom(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete room', 'error')
    } finally {
      setDeleting(false)
    }
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
    <div>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-[22px] gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold m-0 text-ink tracking-[-0.03em]">
            Rooms
          </h1>
          <p className="t-sm text-ink3 mt-[3px]">
            Manage room inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>↻ Refresh</Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>+ Add Room</Button>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── Quick Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5 mb-5">
        {[
          { label: 'Available',   count: counts.available,   color: 'var(--green)',  bg: 'var(--green-bg)',  tc: 'var(--green-text)'  },
          { label: 'Occupied',    count: counts.occupied,    color: 'var(--red)',    bg: 'var(--red-bg)',    tc: 'var(--red-text)'    },
          { label: 'Maintenance', count: counts.maintenance, color: 'var(--amber)',  bg: 'var(--amber-bg)',  tc: 'var(--amber-text)'  },
          { label: 'Reserved',    count: counts.reserved,    color: 'var(--blue)',   bg: 'var(--blue-bg)',   tc: 'var(--blue-text)'   },
          { label: 'Total',       count: rooms.length,       color: 'var(--gold)',   bg: 'var(--gold-bg)',   tc: 'var(--gold)'        },
        ].map(s => (
          <div
            key={s.label}
            className="bg-surface border border-line rounded-[var(--radius)] px-4 py-3 border-b-[3px]"
            style={{ borderBottomColor: s.color }}
          >
            <p className="t-h1 m-0" style={{ color: s.tc }}>{s.count}</p>
            <p className="t-label mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter / Search / View Toggle ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-[13px] py-[5px] rounded-[20px] text-[12px] cursor-pointer border transition-all duration-[130ms] ${
                  active
                    ? 'font-semibold bg-[var(--gold-bg)] border-gold text-gold'
                    : 'font-medium bg-surface border-line text-ink2'
                }`}
              >
                {f}
              </button>
            )
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Search */}
        <div className="relative shrink-0">
          <span className="t-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none">
            ⌕
          </span>
          <input
            className="form-input pl-7 w-40 text-[12px]"
            type="text"
            placeholder="Search room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* View toggle */}
        <div className="flex border border-line rounded-md overflow-hidden shrink-0 divide-x divide-line">
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
                className={`t-body px-[11px] py-1.5 cursor-pointer border-0 transition-all duration-[130ms] ${
                  active ? 'bg-[var(--gold-bg)] text-gold' : 'bg-surface text-ink3'
                }`}
              >
                {icon}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────────── */}
      {(filter !== 'All' || search) && (
        <p className="t-xs text-ink3 mb-3">
          Showing {filtered.length} of {rooms.length} rooms
        </p>
      )}

      {/* ── Grid View ──────────────────────────────────────────────────────── */}
      {view === 'grid' && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="t-display mb-2">🏨</p>
              <p className="m-0 font-semibold text-ink2">No rooms found</p>
              <p className="t-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-2.5">
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
        <div className="flex gap-3 flex-wrap items-start">
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
          onShowQr={(room) => { setSelectedRoom(null); setQrRoom(room) }}
          onDelete={(room) => { setSelectedRoom(null); setDeleteRoom(room) }}
        />
      </Modal>

      {/* ── Delete Room Confirm ─────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteRoom}
        onClose={() => setDeleteRoom(null)}
        onConfirm={handleDeleteRoom}
        title="Delete Room"
        message={deleteRoom ? <>Delete <b>Room {deleteRoom.number}</b>? This cannot be undone.</> : null}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />

      {/* ── Maintenance QR Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={!!qrRoom}
        onClose={() => setQrRoom(null)}
        title={qrRoom ? `Room ${qrRoom.number} — Maintenance QR` : ''}
      >
        <RoomQrCode room={qrRoom} />
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
      <p className="t-h1 mb-0.5 leading-[1.1]">
        {room.number}
      </p>

      {/* Type */}
      <p className="t-label mb-2">
        {room.type} · Fl {room.floor}
      </p>

      {/* Status badge */}
      <Badge type={STATUS_BADGE[room.status]}>
        {STATUS_LABEL[room.status]}
      </Badge>

      {/* Guest name if occupied */}
      {room.status === 'occupied' && room.guest && (
        <p className="mt-1.5 text-[10.5px] text-ink2 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
          {room.guest.name}
        </p>
      )}
    </div>
  )
}
