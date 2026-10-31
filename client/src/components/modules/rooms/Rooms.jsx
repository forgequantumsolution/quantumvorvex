import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuTrash2, LuRefreshCw, LuPlus, LuSearch, LuLayoutGrid, LuColumns3, LuQrCode, LuPencil,
  LuPrinter, LuDownload, LuDoorClosed, LuX,
} from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { Pagination } from '../../ui-tw'
import { roomsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { bedFillLabel, bedOccupancy, hasBedStays, isBedRoom } from '../../../utils/beds'
import { formatDate } from '../../../utils/format'

// Flatten an API room (type is a relation object) to the shape the UI renders.
const normalizeRoom = (r) => ({
  id: r.id,
  number: r.number,
  floor: r.floor,
  status: r.status,
  type: r.type?.name || (typeof r.type === 'string' ? r.type : 'Standard'),
  qrToken: r.qrToken,
  bedCount: r.bedCount || 1,
  dailyRate: r.dailyRate,
  monthlyRate: r.monthlyRate,
  bedDailyRate: r.bedDailyRate,
  bedMonthlyRate: r.bedMonthlyRate,
  bookings: r.bookings || [],
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

// Rooms per page (server-paginated): three rows of cards on a laptop screen.
const PAGE_SIZE = 24

const EMPTY_FORM = {
  number: '', type: 'Single', floor: '', dailyRate: '', monthlyRate: '',
  bedCount: '1', bedMonthlyRate: '', bedDailyRate: '',
}

// Per-bed state colours: in-house, booked (not yet arrived), free.
const BED_COLOR = { in: 'var(--red)', booked: 'var(--blue)', free: 'var(--green)' }
const BED_STATE_LABEL = { in: 'Occupied', booked: 'Booked', free: 'Free' }

// One dot per bed of a PG room — the at-a-glance fill level on cards and lists.
function BedDots({ beds }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      {beds.map(b => (
        <span key={b.bedNo} className="w-[7px] h-[7px] rounded-full"
          style={b.state === 'free'
            ? { boxShadow: `inset 0 0 0 1.5px ${BED_COLOR.free}` }
            : { background: BED_COLOR[b.state] }} />
      ))}
    </span>
  )
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
function RoomDetail({ room, onClose, onStatusChange, onShowQr, onDelete, onSaveRoom }) {
  const [editing, setEditing] = useState(false)
  if (!room) return null

  // Occupancy is driven by check-in/out, so it isn't offered as a manual choice.
  const choices = STATUSES.filter(s => s !== 'occupied')

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface2 px-3 py-2.5">
        <span className="w-11 h-11 rounded-lg bg-surface border border-line flex items-center justify-center text-[16px] font-bold text-ink tabular-nums shrink-0">
          {room.number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="t-title">{room.type} room</div>
          <div className="t-xs text-ink3 mt-0.5">
            Floor {room.floor}{isBedRoom(room) ? ` · ${room.bedCount} beds` : ''}
          </div>
        </div>
        <Badge type={STATUS_BADGE[room.status] || 'grey'}>
          <StatusDot status={room.status} /> {STATUS_LABEL[room.status]}
        </Badge>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <LuPencil size={13} aria-hidden /> Edit
          </Button>
        )}
      </div>

      {editing && (
        <RoomEditForm room={room} onCancel={() => setEditing(false)}
          onSave={async (data) => { await onSaveRoom(room.id, data); setEditing(false) }} />
      )}

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

      {isBedRoom(room) && <BedsPanel room={room} />}

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
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors duration-150 ${
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
      <div className="flex items-center gap-2 pt-3 border-t border-line flex-wrap">
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

// ─── Beds of a PG room: who is in each, and until when ────────────────────────
function BedsPanel({ room }) {
  const beds = bedOccupancy(room)
  const free = beds.filter(b => b.state === 'free').length
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="t-label m-0">Beds</p>
        <span className="t-xs text-ink3">{bedFillLabel(free, beds.length)}</span>
      </div>
      <ul className="m-0 p-0 list-none rounded-xl border border-line divide-y divide-line overflow-hidden">
        {beds.map(b => (
          <li key={b.bedNo} className="flex items-center gap-3 px-3.5 py-2.5 bg-surface">
            <span className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center text-[13px] font-bold text-ink shrink-0">
              {b.label}
            </span>
            <div className="flex-1 min-w-0">
              {b.booking ? (
                <>
                  <p className="t-title m-0 truncate">{b.booking.guestName.split(',')[0]}</p>
                  <p className="t-xs text-ink3 mt-0.5 mb-0 truncate">
                    {b.booking.bookingNo}
                    {b.state === 'booked' ? ` · arrives ${formatDate(b.booking.fromDate)}` : ''}
                    {b.booking.toDate ? ` · until ${formatDate(b.booking.toDate)}` : ''}
                    {b.booking.balance > 0 ? ` · ₹${Number(b.booking.balance).toLocaleString('en-IN')} due` : ''}
                  </p>
                </>
              ) : (
                <p className="t-sm text-ink3 m-0">Vacant</p>
              )}
            </div>
            <span className="flex items-center gap-1.5 t-xs font-medium text-ink2 shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: BED_COLOR[b.state] }} aria-hidden />
              {BED_STATE_LABEL[b.state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Edit a room: number, type, floor, beds and per-bed rents ─────────────────
// Whole room or bed by bed is chosen per booking; beds here only say how many
// there are and what a single bed rents for.
const ROOM_TYPES = ['Single', 'Double', 'Suite', 'Deluxe']

function RoomEditForm({ room, onSave, onCancel }) {
  const [form, setForm] = useState({
    number: room.number,
    type: room.type,
    floor: String(room.floor),
    dailyRate: String(room.dailyRate ?? ''),
    monthlyRate: String(room.monthlyRate ?? ''),
    bedCount: String(room.bedCount || 1),
    bedMonthlyRate: String(room.bedMonthlyRate ?? ''),
    bedDailyRate: String(room.bedDailyRate ?? ''),
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors(x => { const n = { ...x }; delete n[k]; return n })
  }
  const types = ROOM_TYPES.includes(form.type) ? ROOM_TYPES : [form.type, ...ROOM_TYPES]

  const save = async () => {
    const errs = addRoomErrors(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await onSave({
        number: form.number.trim(),
        floor: parseInt(form.floor, 10),
        ...(form.type !== room.type && { typeName: form.type }),
        ...pricePayload(form),
        ...bedPayload(form),
      })
    } catch {
      // toast shown by the page; keep the form open to fix it
    } finally {
      setBusy(false)
    }
  }

  const input = (label, key, type = 'text', extra = {}) => (
    <div>
      <label className="form-label block mb-[5px]">{label}</label>
      <input className={`form-input ${errors[key] ? '!border-danger-text' : ''}`} type={type} name={key}
        value={form[key]} onChange={set(key)} aria-invalid={!!errors[key]} {...extra} />
      <FieldError msg={errors[key]} />
    </div>
  )

  return (
    <div className="rounded-xl border border-gold-border bg-[var(--gold-bg)] p-3">
      <div className="grid grid-cols-3 gap-3">
        {input('Room number', 'number', 'text', { maxLength: 10 })}
        <div>
          <label className="form-label block mb-[5px]">Type</label>
          <select className="form-select" value={form.type} onChange={set('type')}>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {input('Floor', 'floor', 'number', { min: 1 })}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {input('Price / day (₹)', 'dailyRate', 'number', { min: 0, placeholder: 'e.g. 1500' })}
        {input('Price / month (₹)', 'monthlyRate', 'number', { min: 0, placeholder: 'Optional' })}
      </div>
      <BedFields form={form} errors={errors} set={set} />
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  )
}

// API fields for the room's own prices (whole room, per day / per month).
// A blank monthly price is left out: new rooms then take their type's rate.
const pricePayload = (form) => ({
  dailyRate: Number(form.dailyRate),
  ...(form.monthlyRate !== '' && { monthlyRate: Number(form.monthlyRate) }),
})

// API fields for the bed setup form.
const bedPayload = (form) => {
  const bedCount = parseInt(form.bedCount, 10) || 1
  return {
    bedCount,
    bedMonthlyRate: bedCount > 1 && form.bedMonthlyRate !== '' ? Number(form.bedMonthlyRate) : null,
    bedDailyRate: bedCount > 1 && form.bedDailyRate !== '' ? Number(form.bedDailyRate) : null,
  }
}

// Bed count + default per-bed rents (shared by Add room and the room detail).
// Per-bed rents only matter once there's more than one bed to let separately.
function BedFields({ form, set, errors = {} }) {
  const input = (label, key, extra) => (
    <div>
      <label className="form-label block mb-[5px]">{label}</label>
      <input className={`form-input ${errors[key] ? '!border-danger-text' : ''}`} type="number" min="0"
        name={key} value={form[key]} onChange={set(key)} aria-invalid={!!errors[key]} {...extra} />
      <FieldError msg={errors[key]} />
    </div>
  )
  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {input('Beds', 'bedCount', { min: 1, max: 50, placeholder: '1' })}
        {Number(form.bedCount) > 1 && input('Rent / bed / month (₹)', 'bedMonthlyRate', { placeholder: 'e.g. 6000' })}
        {Number(form.bedCount) > 1 && input('Rent / bed / night (₹)', 'bedDailyRate', { placeholder: 'Optional' })}
      </div>
      <p className="t-xs text-ink3 mt-1.5 mb-0">
        {Number(form.bedCount) > 1
          ? 'At booking you choose: the whole room, or single beds (PG) — one booking per person.'
          : 'Single bed — always booked as a whole room.'}
      </p>
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
// Field-level problems with the Add room form; empty object when it can be saved.
function addRoomErrors(form) {
  const e = {}
  if (!form.number.trim()) e.number = 'Enter a room number'
  else if (form.number.trim().length > 10) e.number = 'Use at most 10 characters'
  const floor = Number(form.floor)
  if (form.floor === '') e.floor = 'Enter the floor'
  else if (!Number.isInteger(floor) || floor < 1 || floor > 100) e.floor = 'Floor must be 1–100'
  if (!(Number(form.dailyRate) > 0)) e.dailyRate = 'Enter the price per day'
  if (form.monthlyRate !== '' && !(Number(form.monthlyRate) > 0)) e.monthlyRate = 'Must be more than 0'
  const beds = Number(form.bedCount)
  if (!Number.isInteger(beds) || beds < 1 || beds > 50) e.bedCount = 'Beds must be 1–50'
  if (form.bedMonthlyRate !== '' && Number(form.bedMonthlyRate) < 0) e.bedMonthlyRate = 'Can’t be negative'
  if (form.bedDailyRate !== '' && Number(form.bedDailyRate) < 0) e.bedDailyRate = 'Can’t be negative'
  return e
}

function FieldError({ msg }) {
  return msg ? <p className="t-xs text-danger-text mt-1 mb-0">{msg}</p> : null
}

function AddRoomForm({ form, onChange, errors = {}, apiError }) {
  const field = (label, key, type = 'text', extra = {}) => (
    <div key={key}>
      <label className="form-label block mb-[5px]">{label}{extra.required && <span className="text-danger-text"> *</span>}</label>
      <input
        className={`form-input ${errors[key] ? '!border-danger-text' : ''}`}
        type={type}
        name={key}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        aria-invalid={!!errors[key]}
        {...extra}
      />
      <FieldError msg={errors[key]} />
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {apiError && (
        <div className="md:col-span-2 t-sm px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text" role="alert">
          {apiError}
        </div>
      )}
      {field('Room Number', 'number', 'text', { placeholder: 'e.g. 105', required: true })}

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

      {field('Floor', 'floor', 'number', { placeholder: 'e.g. 1', min: 1, required: true })}
      {field('Price / day (₹)', 'dailyRate', 'number', { placeholder: 'e.g. 1500', min: 0, required: true })}
      {field('Price / month (₹)', 'monthlyRate', 'number', { placeholder: 'Optional — for monthly stays', min: 0 })}

      <div className="md:col-span-2 -mt-3">
        <BedFields form={form} errors={errors} set={k => e => onChange(k, e.target.value)} />
      </div>
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
  const [addErrors, setAddErrors]     = useState({})
  const [addApiError, setAddApiError] = useState('')
  const [adding, setAdding]           = useState(false)

  // Server pagination: `rooms` is the current page (already filtered by status,
  // floor and search on the server); `stats` covers every room for the header.
  const [page, setPage]   = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, counts: {}, floors: [], beds: { total: 0, taken: 0 } })
  const [query, setQuery] = useState('')   // debounced `search`

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])
  // Any filter change starts again from the first page.
  useEffect(() => { setPage(1) }, [filter, floor, query])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await roomsApi.getAll({
        page, pageSize: PAGE_SIZE,
        ...(filter !== 'all' && { status: filter }),
        ...(floor !== 'all' && { floor }),
        ...(query && { q: query }),
      })
      setRooms((data.rooms || []).map(normalizeRoom))
      setTotal(data.total ?? 0)
      if (data.stats) setStats(data.stats)
    } catch {
      setError('Could not load rooms. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [page, filter, floor, query])

  useEffect(() => { load() }, [load])

  // ── Grouping (the current page, by floor) ──────────────────────────────────
  const filtered = rooms
  const floors = stats.floors
  const byFloor = [...new Set(rooms.map(r => r.floor))]
    .sort((a, b) => a - b)
    .map(f => ({ floor: f, rooms: rooms.filter(r => r.floor === f) }))
  const isFiltered = filter !== 'all' || floor !== 'all' || !!search.trim()
  const clearFilters = () => { setFilter('all'); setFloor('all'); setSearch('') }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    const prev = rooms
    setRooms(rs => rs.map(r => r.id === id ? { ...r, status: newStatus } : r))
    try {
      await roomsApi.update(id, { status: newStatus })
      load()   // refresh the header counts (and the page, if a filter is on)
    } catch {
      setRooms(prev)
      addToast('Could not update room status', 'danger')
    }
  }

  const closeAddModal = () => {
    setShowAddModal(false); setAddForm(EMPTY_FORM); setAddErrors({}); setAddApiError('')
  }

  const handleAddRoom = async () => {
    const errs = addRoomErrors(addForm)
    setAddErrors(errs)
    setAddApiError('')
    const first = Object.keys(errs)[0]
    if (first) {
      addToast(errs[first], 'danger')
      document.querySelector(`[name="${first}"]`)?.focus()
      return
    }
    setAdding(true)
    try {
      await roomsApi.create({
        number: addForm.number.trim(),
        typeName: addForm.type,
        floor: parseInt(addForm.floor, 10),
        status: 'available',
        ...pricePayload(addForm),
        ...bedPayload(addForm),
      })
      addToast(`Room ${addForm.number.trim()} added`, 'success')
      closeAddModal()
      load()
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error
        || (err.response ? 'Could not add room' : 'Could not reach the server — is the backend running?')
      setAddApiError(msg)
      addToast(msg, 'danger')
    } finally {
      setAdding(false)
    }
  }

  // Room detail → Edit: number, type, floor, beds and per-bed rents.
  const handleSaveRoom = async (id, data) => {
    try {
      const { data: res } = await roomsApi.update(id, data)
      addToast(`Room ${res.room.number} updated`, 'success')
      const next = normalizeRoom({ ...res.room, bookings: rooms.find(r => r.id === id)?.bookings })
      setRooms(rs => rs.map(r => r.id === id ? next : r))
      setSelectedRoom(next)
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not update the room', 'danger')
      throw err
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
      addToast(err.response?.data?.message || 'Could not delete room', 'danger')
    } finally {
      setDeleting(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  // Whole-property figures from the server, not just the visible page.
  const roomCount = stats.total
  const counts = Object.fromEntries(STATUSES.map(st => [st, stats.counts[st] || 0]))
  const occupancy = roomCount ? Math.round((counts.occupied / roomCount) * 100) : 0
  // Rooms let bed by bed are also counted in beds.
  const bedsTotal = stats.beds.total
  const bedsTaken = stats.beds.taken

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Header ── title, counts and actions on one line */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="t-h2 m-0">Rooms</h1>
          <span className="t-xs text-ink3 truncate">
            {roomCount ? `${roomCount} room${roomCount === 1 ? '' : 's'} · ${floors.length} floor${floors.length === 1 ? '' : 's'}` : 'Manage room inventory'}
          </span>
        </div>
        {/* Search, floor and view sit on the header line, beside Add room. */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative w-[220px] max-w-full">
            <LuSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" aria-hidden />
            <input
              className="form-input h-8 py-1 pl-8 text-[13px]"
              type="search"
              placeholder="Search number or type"
              aria-label="Search rooms"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className="form-select h-8 py-1 text-[13px] w-auto min-w-[120px]" value={floor} onChange={e => setFloor(e.target.value)} aria-label="Floor">
            <option value="all">All floors</option>
            {floors.map(f => <option key={f} value={String(f)}>Floor {f}</option>)}
          </select>

          {isFiltered && (
            <button type="button" onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 bg-transparent border-0 cursor-pointer t-xs font-medium text-ink2 hover:text-ink">
              <LuX size={13} aria-hidden /> Clear
            </button>
          )}

          {isFiltered && <span className="t-xs text-ink3 hidden sm:inline">{total} of {roomCount}</span>}

          <div className="flex bg-surface2 border border-line rounded-lg p-[2px] gap-[2px] shrink-0" role="group" aria-label="View">
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
                  className={`w-7 h-6 flex items-center justify-center rounded-md border-0 cursor-pointer transition-colors duration-150 ${
                    active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-ink3 hover:text-ink'
                  }`}
                >
                  <Icon size={14} aria-hidden />
                </button>
              )
            })}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
            <LuRefreshCw size={14} aria-hidden className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <LuPlus size={15} aria-hidden /> Add room
          </Button>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-3 px-3 py-2 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── One control bar: occupancy, status filters, search / floor / view ── */}
      <div className="card mb-4">
        <div className="flex items-center gap-x-4 gap-y-2 px-3.5 py-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 shrink-0" title={`${counts.occupied} of ${roomCount} rooms occupied`}>
            <span className="text-[17px] font-bold text-ink tabular-nums leading-none">{occupancy}%</span>
            <span className="t-xs text-ink3">occupied</span>
            <div className="flex w-24 h-1.5 rounded-full overflow-hidden bg-surface2 gap-px" role="img"
              aria-label={STATUSES.map(st => `${counts[st]} ${STATUS_LABEL[st].toLowerCase()}`).join(', ')}>
              {roomCount > 0 && STATUSES.map(st => counts[st] > 0 && (
                <span key={st} style={{ width: `${(counts[st] / roomCount) * 100}%`, background: STATUS_COLOR[st] }} />
              ))}
            </div>
            {bedsTotal > 0 && <span className="t-xs text-ink3">· beds {bedsTaken}/{bedsTotal}</span>}
          </div>

          {/* Status chips — each filters the rooms below. */}
          <div className="flex items-center gap-1 flex-wrap">
            {[{ id: 'all', label: 'All', count: roomCount }, ...STATUSES.map(st => ({ id: st, label: STATUS_LABEL[st], count: counts[st] }))].map(t => {
              const active = filter === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(active && t.id !== 'all' ? 'all' : t.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium cursor-pointer transition-colors duration-150 ${
                    active ? 'border-gold bg-[var(--gold-bg)] text-ink' : 'border-line bg-surface text-ink2 hover:border-line2'
                  }`}
                >
                  {t.id !== 'all' && <StatusDot status={t.id} />}
                  {t.label}
                  <span className="tabular-nums text-ink3">{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="card py-10 px-6 text-center">
          <span className="w-12 h-12 mx-auto mb-3 rounded-xl bg-surface2 text-ink3 flex items-center justify-center">
            <LuDoorClosed size={22} aria-hidden />
          </span>
          <p className="t-title m-0">{roomCount ? 'No rooms match these filters' : 'No rooms yet'}</p>
          <p className="t-xs text-ink3 mt-1 mb-4">{roomCount ? 'Try a different status, floor or search.' : 'Add your first room to start taking bookings.'}</p>
          {roomCount
            ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            : <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}><LuPlus size={15} aria-hidden /> Add room</Button>}
        </div>
      )}

      {/* ── Floor View ─────────────────────────────────────────────────────── */}
      {view === 'grid' && filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {byFloor.map(g => {
            const free = g.rooms.filter(r => r.status === 'available').length
            return (
              <section key={g.floor} aria-labelledby={`floor-${g.floor}`}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <h2 id={`floor-${g.floor}`} className="text-[13px] font-semibold text-ink m-0">Floor {g.floor}</h2>
                  <span className="t-xs text-ink3">{g.rooms.length} room{g.rooms.length === 1 ? '' : 's'} · {free} available</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
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

      {/* ── Pages (server-side) ── */}
      <Pagination className="mt-4" page={page} pageSize={PAGE_SIZE} total={total}
                  disabled={loading} onChange={setPage} />

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
          onSaveRoom={handleSaveRoom}
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
        onClose={closeAddModal}
        title="Add New Room"
        footer={
          <>
            <Button variant="outline" onClick={closeAddModal} disabled={adding}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddRoom} disabled={adding}>
              {adding ? 'Saving…' : 'Save Room'}
            </Button>
          </>
        }
      >
        <AddRoomForm
          form={addForm}
          errors={addErrors}
          apiError={addApiError}
          onChange={(key, val) => {
            setAddForm(p => ({ ...p, [key]: val }))
            // Clear a field's error as soon as it's edited.
            if (addErrors[key]) setAddErrors(e => { const n = { ...e }; delete n[key]; return n })
          }}
        />
      </Modal>
    </div>
  )
}

// ─── Room Card ────────────────────────────────────────────────────────────────
function RoomCard({ room, onClick }) {
  // Bed-by-bed fill only while the room is actually let that way.
  const label = hasBedStays(room)
    ? bedFillLabel(bedOccupancy(room).filter(b => b.state === 'free').length, room.bedCount)
    : STATUS_LABEL[room.status]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Room ${room.number}, ${room.type}, ${label}`}
      className="group relative text-left bg-surface border border-line rounded-xl px-5 pt-5 pb-4 min-h-[150px] flex flex-col cursor-pointer overflow-hidden transition-all duration-150 hover:border-gold hover:shadow-[var(--shadow)] hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-gold"
    >
      <span className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: STATUS_COLOR[room.status] }} aria-hidden />
      <span className="block text-[26px] font-bold text-ink tabular-nums leading-none">{room.number}</span>
      <span className="block text-[13px] text-ink2 mt-1.5 truncate">
        {room.type}{isBedRoom(room) ? ` · ${room.bedCount} beds` : ''}
      </span>
      {(room.dailyRate || room.bedMonthlyRate) && (
        <span className="block t-xs text-ink3 mt-0.5 truncate">
          {room.dailyRate ? `₹${Number(room.dailyRate).toLocaleString('en-IN')}/night` : ''}
          {room.dailyRate && room.bedMonthlyRate ? ' · ' : ''}
          {room.bedMonthlyRate ? `₹${Number(room.bedMonthlyRate).toLocaleString('en-IN')}/bed/mo` : ''}
        </span>
      )}
      {hasBedStays(room) ? (
        <BedSummary room={room} />
      ) : (
        <span className="flex items-center gap-1.5 mt-auto pt-3 text-[13px] font-medium text-ink2">
          <StatusDot status={room.status} />
          {STATUS_LABEL[room.status]}
        </span>
      )}
    </button>
  )
}

// Bed fill of a PG room on its card: one dot per bed + "1 of 3 free".
function BedSummary({ room }) {
  const beds = bedOccupancy(room)
  const free = beds.filter(b => b.state === 'free').length
  // Maintenance still overrides — a room out of service has no free beds to sell.
  if (room.status === 'maintenance') {
    return (
      <span className="flex items-center gap-1.5 mt-auto pt-2.5 text-[12.5px] font-medium text-ink2">
        <StatusDot status="maintenance" /> {STATUS_LABEL.maintenance}
      </span>
    )
  }
  return (
    // Dots on their own line: beside the label they force a wrap at card width.
    <span className="flex flex-col items-start gap-1 mt-auto pt-2.5 text-[12.5px] font-medium text-ink2 whitespace-nowrap">
      <BedDots beds={beds} />
      {bedFillLabel(free, beds.length)}
    </span>
  )
}
