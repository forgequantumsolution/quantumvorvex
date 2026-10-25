import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuTrash2, LuRefreshCw, LuPlus, LuSearch, LuLayoutGrid, LuColumns3, LuQrCode,
  LuPrinter, LuDownload, LuDoorClosed, LuX,
} from 'react-icons/lu'
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

// Solid colour per status — dots, bars and the card's top accent.
const STATUS_COLOR = {
  available:   'var(--green)',
  occupied:    'var(--red)',
  maintenance: 'var(--amber)',
  reserved:    'var(--blue)',
}

const STATUSES = ['available', 'occupied', 'reserved', 'maintenance']

const EMPTY_FORM = {
  number: '', type: 'Single', floor: '', maxOccupancy: '',
}

function StatusDot({ status, className = '' }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`} style={{ background: STATUS_COLOR[status] }} aria-hidden />
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ status, rooms, onSelect }) {
  return (
    <div className="bg-surface2 border border-line rounded-xl min-w-0 flex flex-col">
      <div className="px-3.5 py-3 flex items-center gap-2">
        <StatusDot status={status} />
        <span className="t-title">{STATUS_LABEL[status]}</span>
        <span className="ml-auto text-[12px] font-semibold text-ink3">{rooms.length}</span>
      </div>
      <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
        {rooms.length === 0 && (
          <p className="t-xs text-ink3 text-center py-5 m-0 border border-dashed border-line2 rounded-lg">
            No rooms
          </p>
        )}
        {rooms.map(room => (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelect(room)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line text-left cursor-pointer transition-all duration-150 hover:border-gold hover:shadow-[var(--shadow)]"
          >
            <span className="text-[15px] font-bold text-ink tabular-nums">{room.number}</span>
            <span className="t-xs text-ink3 truncate">{room.type}</span>
            <span className="ml-auto t-xs text-ink3 shrink-0">Fl {room.floor}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function RoomDetail({ room, onClose, onStatusChange, onShowQr, onDelete }) {
  if (!room) return null

  // Occupancy is driven by check-in/out, so it isn't offered as a manual choice.
  const choices = STATUSES.filter(s => s !== 'occupied')

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <div className="flex items-center gap-4 rounded-xl border border-line bg-surface2 p-4">
        <span className="w-14 h-14 rounded-xl bg-surface border border-line flex items-center justify-center text-[20px] font-bold text-ink tabular-nums shrink-0">
          {room.number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="t-title">{room.type} room</div>
          <div className="t-xs text-ink3 mt-0.5">Floor {room.floor}</div>
        </div>
        <Badge type={STATUS_BADGE[room.status] || 'grey'}>
          <StatusDot status={room.status} /> {STATUS_LABEL[room.status]}
        </Badge>
      </div>

      {/* Guest info if occupied */}
      {room.status === 'occupied' && room.guest && (
        <div className="bg-danger-bg rounded-xl px-4 py-3.5">
          <p className="t-label text-danger-text mb-2">Current Occupant</p>
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

      {/* Status */}
      <div>
        <p className="t-label mb-2">Set status</p>
        <div className="grid grid-cols-3 gap-2">
          {choices.map(s => {
            const active = room.status === s
            const blocked = room.status === 'occupied' && s === 'reserved'
            return (
              <button
                key={s}
                type="button"
                disabled={active || blocked}
                onClick={() => { onStatusChange(room.id, s); onClose() }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-medium transition-colors duration-150 ${
                  active
                    ? 'border-gold bg-[var(--gold-bg)] text-ink cursor-default'
                    : blocked
                      ? 'border-line bg-surface text-ink3 opacity-50 cursor-not-allowed'
                      : 'border-line bg-surface text-ink2 cursor-pointer hover:border-line2 hover:bg-surface2'
                }`}
              >
                <StatusDot status={s} /> {STATUS_LABEL[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Other actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-line flex-wrap">
        <Button variant="outline" size="sm" onClick={() => onShowQr(room)}>
          <LuQrCode size={15} aria-hidden /> Maintenance QR
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => onDelete(room)}>
          <LuTrash2 size={15} aria-hidden /> Delete room
        </Button>
      </div>
    </div>
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
        <Button variant="primary" onClick={handlePrint}><LuPrinter size={15} aria-hidden /> Print sticker</Button>
        <Button variant="outline" onClick={handleDownload}><LuDownload size={15} aria-hidden /> Download QR</Button>
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
  const [filter, setFilter]           = useState('all')   // 'all' | a status
  const [floor, setFloor]             = useState('all')
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
    const matchesFilter = filter === 'all' || r.status === filter
    const matchesFloor  = floor === 'all' || String(r.floor) === floor
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || r.number.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    return matchesFilter && matchesFloor && matchesSearch
  })
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b)
  const byFloor = floors
    .map(f => ({ floor: f, rooms: filtered.filter(r => r.floor === f) }))
    .filter(g => g.rooms.length)
  const isFiltered = filter !== 'all' || floor !== 'all' || !!search.trim()
  const clearFilters = () => { setFilter('all'); setFloor('all'); setSearch('') }

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
  const counts = Object.fromEntries(STATUSES.map(st => [st, rooms.filter(r => r.status === st).length]))
  const occupancy = rooms.length ? Math.round((counts.occupied / rooms.length) * 100) : 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="t-h1 m-0">Rooms</h1>
          <p className="t-sm text-ink3 mt-1 mb-0">
            {rooms.length ? `${rooms.length} rooms across ${floors.length} floor${floors.length === 1 ? '' : 's'}` : 'Manage room inventory'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <LuRefreshCw size={14} aria-hidden className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <LuPlus size={15} aria-hidden /> Add room
          </Button>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── Status summary — each tile filters the rooms below ─────────────── */}
      <div className="card mb-5">
        <div className="px-5 pt-4 pb-3.5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-ink tabular-nums leading-none">{occupancy}%</span>
              <span className="t-sm text-ink2">occupancy</span>
            </div>
            <span className="t-xs text-ink3">{counts.occupied} of {rooms.length} rooms occupied</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface2 gap-[2px]" role="img"
            aria-label={STATUSES.map(st => `${counts[st]} ${STATUS_LABEL[st].toLowerCase()}`).join(', ')}>
            {rooms.length > 0 && STATUSES.map(st => counts[st] > 0 && (
              <span key={st} style={{ width: `${(counts[st] / rooms.length) * 100}%`, background: STATUS_COLOR[st] }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-line">
          {[{ id: 'all', label: 'All rooms', count: rooms.length }, ...STATUSES.map(st => ({ id: st, label: STATUS_LABEL[st], count: counts[st] }))].map((t, i) => {
            const active = filter === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(active && t.id !== 'all' ? 'all' : t.id)}
                aria-pressed={active}
                className={`relative text-left px-5 py-3.5 border-0 cursor-pointer transition-colors duration-150 ${
                  i > 0 ? 'lg:border-l lg:border-solid lg:border-line' : ''
                } ${active ? 'bg-[var(--gold-bg)]' : 'bg-transparent hover:bg-surface2'}`}
              >
                {active && <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-gold" aria-hidden />}
                <span className="flex items-center gap-1.5 t-xs font-medium text-ink2">
                  {t.id !== 'all' && <StatusDot status={t.id} />}
                  {t.label}
                </span>
                <span className="block text-[20px] font-bold text-ink tabular-nums mt-1 leading-none">{t.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search / floor / view ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <LuSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" aria-hidden />
          <input
            className="form-input pl-9"
            type="search"
            placeholder="Search room number or type"
            aria-label="Search rooms"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="form-select w-auto min-w-[130px]" value={floor} onChange={e => setFloor(e.target.value)} aria-label="Floor">
          <option value="all">All floors</option>
          {floors.map(f => <option key={f} value={String(f)}>Floor {f}</option>)}
        </select>

        {isFiltered && (
          <button type="button" onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-transparent border-0 cursor-pointer t-xs font-medium text-ink2 hover:text-ink">
            <LuX size={13} aria-hidden /> Clear
          </button>
        )}

        <div className="flex-1" />

        <span className="t-xs text-ink3 hidden sm:inline">
          {isFiltered ? `${filtered.length} of ${rooms.length} rooms` : `${rooms.length} rooms`}
        </span>

        <div className="flex bg-surface2 border border-line rounded-lg p-[3px] gap-[3px] shrink-0" role="group" aria-label="View">
          {[
            { key: 'grid',   Icon: LuLayoutGrid, title: 'Floor view'  },
            { key: 'kanban', Icon: LuColumns3,   title: 'Status board' },
          ].map(({ key, Icon: ViewIcon, title }) => {
            const Icon = ViewIcon
            const active = view === key
            return (
              <button
                key={key}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={active}
                onClick={() => setView(key)}
                className={`w-8 h-7 flex items-center justify-center rounded-md border-0 cursor-pointer transition-colors duration-150 ${
                  active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-ink3 hover:text-ink'
                }`}
              >
                <Icon size={15} aria-hidden />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="card py-14 px-6 text-center">
          <span className="w-12 h-12 mx-auto mb-3 rounded-xl bg-surface2 text-ink3 flex items-center justify-center">
            <LuDoorClosed size={22} aria-hidden />
          </span>
          <p className="t-title m-0">{rooms.length ? 'No rooms match these filters' : 'No rooms yet'}</p>
          <p className="t-xs text-ink3 mt-1 mb-4">{rooms.length ? 'Try a different status, floor or search.' : 'Add your first room to start taking bookings.'}</p>
          {rooms.length
            ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            : <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}><LuPlus size={15} aria-hidden /> Add room</Button>}
        </div>
      )}

      {/* ── Floor View ─────────────────────────────────────────────────────── */}
      {view === 'grid' && filtered.length > 0 && (
        <div className="flex flex-col gap-6">
          {byFloor.map(g => {
            const free = g.rooms.filter(r => r.status === 'available').length
            return (
              <section key={g.floor} aria-labelledby={`floor-${g.floor}`}>
                <div className="flex items-baseline gap-2.5 mb-2.5">
                  <h2 id={`floor-${g.floor}`} className="t-h3 m-0">Floor {g.floor}</h2>
                  <span className="t-xs text-ink3">{g.rooms.length} room{g.rooms.length === 1 ? '' : 's'} · {free} available</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
                  {g.rooms.map(room => (
                    <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Status Board ───────────────────────────────────────────────────── */}
      {view === 'kanban' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {STATUSES.map(st => (
            <KanbanColumn
              key={st}
              status={st}
              rooms={filtered.filter(r => r.status === st)}
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
    <button
      type="button"
      onClick={onClick}
      aria-label={`Room ${room.number}, ${room.type}, ${STATUS_LABEL[room.status]}`}
      className="group relative text-left bg-surface border border-line rounded-xl px-3.5 pt-3.5 pb-3 cursor-pointer overflow-hidden transition-all duration-150 hover:border-gold hover:shadow-[var(--shadow)] hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-gold"
    >
      <span className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: STATUS_COLOR[room.status] }} aria-hidden />
      <span className="block text-[20px] font-bold text-ink tabular-nums leading-tight">{room.number}</span>
      <span className="block t-xs text-ink3 mt-0.5 truncate">{room.type}</span>
      <span className="flex items-center gap-1.5 mt-3 text-[12px] font-medium text-ink2">
        <StatusDot status={room.status} />
        {STATUS_LABEL[room.status]}
      </span>
    </button>
  )
}
