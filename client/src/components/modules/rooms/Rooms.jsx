import { useState, useEffect, useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import {
  LuTrash2, LuRefreshCw, LuPlus, LuLayoutGrid, LuColumns3, LuQrCode, LuPencil,
  LuPrinter, LuDownload, LuDoorClosed, LuX,
} from 'react-icons/lu'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import { Pagination } from '../../ui-tw'
import { roomsApi } from '../../../api/client'
import { useToast } from '../../../hooks/useToast'
import { usePageHeader } from '../../../store/hooks'
import { bedOccupancy, hasBedStays, isBedRoom } from '../../../utils/beds'
import { formatDate } from '../../../utils/format'
import { appLocale } from '../../../i18n'

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

// Display labels are translated at render time: t(`status.${status}`).

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

// Fill level of a PG room, in one wording everywhere: "2/3 beds free" / "Full · 3/3 beds".
const bedFill = (t, free, total) =>
  free > 0 ? t('beds.free', { free, total }) : t('beds.full', { total })

// Room type names come from the server; the four built-in ones get a translated label.
const typeLabel = (t, type) => t(`type.${type}`, { defaultValue: type })

function StatusDot({ status, className = '' }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`} style={{ background: STATUS_COLOR[status] }} aria-hidden />
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ status, rooms, onSelect }) {
  const { t } = useTranslation('rooms')
  return (
    <div className="bg-surface2 border border-line rounded-xl min-w-0 flex flex-col">
      <div className="px-3.5 py-3 flex items-center gap-2">
        <StatusDot status={status} />
        <span className="t-title">{t(`status.${status}`)}</span>
        <span className="ml-auto text-[12px] font-semibold text-ink3">{rooms.length}</span>
      </div>
      <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
        {rooms.length === 0 && (
          <p className="t-xs text-ink3 text-center py-5 m-0 border border-dashed border-line2 rounded-lg">
            {t('noRooms')}
          </p>
        )}
        {rooms.map(room => (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelect(room)}
            className="w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line text-left cursor-pointer transition-all duration-150 hover:border-gold hover:shadow-[var(--shadow)]"
          >
            <span className="text-[15px] font-bold text-ink tabular-nums">{room.number}</span>
            <span className="t-xs text-ink3 truncate min-w-0">{typeLabel(t, room.type)}</span>
            <span className="ml-auto t-xs text-ink3 shrink-0">{t('floorShort', { floor: room.floor })}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Room Detail Modal Content ────────────────────────────────────────────────
function RoomDetail({ room, onClose, onStatusChange, onShowQr, onDelete, onSaveRoom }) {
  const { t } = useTranslation('rooms')
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
          <div className="t-title truncate">{t('detail.typeRoom', { type: typeLabel(t, room.type) })}</div>
          <div className="t-xs text-ink3 mt-0.5">
            {t('floor', { floor: room.floor })}{isBedRoom(room) ? ` · ${t('bedsCount', { count: room.bedCount })}` : ''}
          </div>
          {/* Phones: the badge drops under the name so Edit keeps its room. */}
          <div className="mt-1.5 sm:hidden">
            <Badge type={STATUS_BADGE[room.status] || 'grey'}>
              <StatusDot status={room.status} /> {t(`status.${room.status}`)}
            </Badge>
          </div>
        </div>
        <span className="hidden sm:inline-flex shrink-0">
          <Badge type={STATUS_BADGE[room.status] || 'grey'}>
            <StatusDot status={room.status} /> {t(`status.${room.status}`)}
          </Badge>
        </span>
        {!editing && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            <LuPencil size={13} aria-hidden /> {t('common:edit')}
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
          <p className="t-label text-danger-text mb-2">{t('detail.currentOccupant')}</p>
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
        <p className="t-label mb-2">{t('detail.setStatus')}</p>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2">
          {choices.map(s => {
            const active = room.status === s
            const blocked = room.status === 'occupied' && s === 'reserved'
            return (
              <button
                key={s}
                type="button"
                disabled={active || blocked}
                onClick={() => { onStatusChange(room.id, s); onClose() }}
                className={`flex items-center justify-center gap-2 px-2.5 py-2 min-h-11 sm:min-h-0 rounded-lg border text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
                  active
                    ? 'border-gold bg-[var(--gold-bg)] text-ink cursor-default'
                    : blocked
                      ? 'border-line bg-surface text-ink3 opacity-50 cursor-not-allowed'
                      : 'border-line bg-surface text-ink2 cursor-pointer hover:border-line2 hover:bg-surface2'
                }`}
              >
                <StatusDot status={s} /> {t(`status.${s}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Other actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-line flex-wrap">
        <Button variant="outline" size="sm" onClick={() => onShowQr(room)}>
          <LuQrCode size={15} aria-hidden /> {t('qr.button')}
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => onDelete(room)}>
          <LuTrash2 size={15} aria-hidden /> {t('detail.deleteRoom')}
        </Button>
      </div>
    </div>
  )
}

// ─── Beds of a PG room: who is in each, and until when ────────────────────────
function BedsPanel({ room }) {
  const { t } = useTranslation('rooms')
  const beds = bedOccupancy(room)
  const free = beds.filter(b => b.state === 'free').length
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="t-label m-0">{t('beds.title')}</p>
        <span className="t-xs text-ink3">{bedFill(t, free, beds.length)}</span>
      </div>
      <ul className="m-0 p-0 list-none rounded-xl border border-line divide-y divide-line overflow-hidden">
        {beds.map(b => (
          <li key={b.bedNo} className="flex items-center gap-3 px-3 sm:px-3.5 py-2.5 bg-surface">
            <span className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center text-[13px] font-bold text-ink shrink-0">
              {b.label}
            </span>
            <div className="flex-1 min-w-0">
              {b.booking ? (
                <>
                  <p className="t-title m-0 truncate">{b.booking.guestName.split(',')[0]}</p>
                  <p className="t-xs text-ink3 mt-0.5 mb-0 truncate">
                    {b.booking.bookingNo}
                    {b.state === 'booked' ? ` · ${t('beds.arrives', { date: formatDate(b.booking.fromDate) })}` : ''}
                    {b.booking.toDate ? ` · ${t('beds.until', { date: formatDate(b.booking.toDate) })}` : ''}
                    {b.booking.balance > 0 ? ` · ${t('beds.due', { amount: `₹${Number(b.booking.balance).toLocaleString(appLocale())}` })}` : ''}
                  </p>
                </>
              ) : (
                <p className="t-sm text-ink3 m-0">{t('beds.vacant')}</p>
              )}
            </div>
            <span className="flex items-center gap-1.5 t-xs font-medium text-ink2 shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: BED_COLOR[b.state] }} aria-hidden />
              {t(`beds.state.${b.state}`)}
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
  const { t } = useTranslation('rooms')
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
    const errs = addRoomErrors(form, t)
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {input(t('form.roomNumber'), 'number', 'text', { maxLength: 10 })}
        <div>
          <label className="form-label block mb-[5px]">{t('form.type')}</label>
          <select className="form-select" value={form.type} onChange={set('type')}>
            {types.map(ty => <option key={ty} value={ty}>{typeLabel(t, ty)}</option>)}
          </select>
        </div>
        {input(t('form.floor'), 'floor', 'number', { min: 1 })}
      </div>
      <BedAndPriceFields form={form} errors={errors} set={set} />
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={onCancel} disabled={busy}>{t('common:cancel')}</Button>
        <Button variant="primary" size="sm" className="flex-1 sm:flex-none" onClick={save} disabled={busy}>{busy ? t('common:saving') : t('common:saveChanges')}</Button>
      </div>
    </div>
  )
}

// API fields for the room's own prices (whole room, per day / per month).
// A blank price is left out: new rooms then take their type's rate.
const pricePayload = (form) => ({
  ...(form.dailyRate !== '' && { dailyRate: Number(form.dailyRate) }),
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

// Bed count + prices (shared by Add room and the room detail). Per-bed rents only
// matter once there's more than one bed to let separately. No single price is
// required, so a PG can set monthly rent only; addRoomErrors wants at least one.
function BedAndPriceFields({ form, set, errors = {} }) {
  const { t } = useTranslation('rooms')
  const hasBeds = Number(form.bedCount) > 1
  const input = (label, key, extra) => (
    <div>
      <label className="form-label block mb-[5px]">{label}</label>
      <input className={`form-input ${errors[key] ? '!border-danger-text' : ''}`} type="number" min="0"
        name={key} value={form[key]} onChange={set(key)} aria-invalid={!!errors[key]} {...extra} />
      <FieldError msg={errors[key]} />
    </div>
  )
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <div className="grid grid-cols-2 gap-3">
          {input(t('beds.title'), 'bedCount', { min: 1, max: 50, placeholder: '1' })}
        </div>
        <p className="t-xs text-ink3 mt-1.5 mb-0">
          {hasBeds ? t('form.bedsHint') : t('form.singleBedHint')}
        </p>
      </div>
      {hasBeds && (
        <div className="grid grid-cols-2 gap-3 items-end">
          {input(t('form.bedMonthly'), 'bedMonthlyRate', { placeholder: t('form.eg', { v: 6000 }) })}
          {input(t('form.bedDaily'), 'bedDailyRate', { placeholder: t('common:optional') })}
        </div>
      )}
      {/* Prices pair up even on phones; items-end keeps the inputs level when a
          longer label wraps. */}
      <div className="grid grid-cols-2 gap-3 items-end">
        {input(hasBeds ? t('form.wholeMonthly') : t('form.priceMonthly'), 'monthlyRate', { placeholder: hasBeds ? t('common:optional') : t('form.eg', { v: 9000 }) })}
        {input(hasBeds ? t('form.wholeDaily') : t('form.priceDaily'), 'dailyRate', { placeholder: hasBeds ? t('common:optional') : t('form.eg', { v: 1500 }) })}
      </div>
      <p className="t-xs text-ink3 m-0">
        {hasBeds ? t('form.priceHintBeds') : t('form.priceHint')}
      </p>
    </div>
  )
}

// ─── Room QR Code (maintenance) ───────────────────────────────────────────────
function RoomQrCode({ room }) {
  const { t } = useTranslation('rooms')
  if (!room) return null

  if (!room.qrToken) {
    return (
      <p className="t-sm text-ink3 text-center py-6 m-0">
        {t('qr.noToken')}
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
        <head><title>${t('roomNo', { number: room.number })} — ${t('qr.reportIssue')}</title></head>
        <body style="margin:0;font-family:system-ui,sans-serif;text-align:center;padding:40px">
          <h2 style="margin:0 0 4px">${t('roomNo', { number: room.number })}</h2>
          <p style="margin:0 0 24px;color:#555;font-size:14px">${t('qr.scanToReport')}</p>
          ${svg}
          <p style="margin:24px 0 0;color:#888;font-size:11px">${t('qr.noLogin')}</p>
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
      ctx.fillText(t('roomNo', { number: room.number }), W / 2, PAD + TITLE_H / 2)

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
        {t('qr.help')}
      </p>
      <div className="inline-flex max-w-full bg-white p-3 sm:p-4 rounded-lg border border-line">
        <QRCodeSVG id="room-qr-svg" value={url} size={200} level="M" includeMargin />
      </div>
      <p className="t-xs text-ink3 break-all mt-3">{url}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={handlePrint}><LuPrinter size={15} aria-hidden /> {t('qr.print')}</Button>
        <Button variant="outline" onClick={handleDownload}><LuDownload size={15} aria-hidden /> {t('qr.download')}</Button>
      </div>
    </div>
  )
}

// ─── Add Room Form ────────────────────────────────────────────────────────────
// Field-level problems with the Add room form; empty object when it can be saved.
function addRoomErrors(form, t) {
  const e = {}
  if (!form.number.trim()) e.number = t('errors.numberRequired')
  else if (form.number.trim().length > 10) e.number = t('errors.numberTooLong')
  const floor = Number(form.floor)
  if (form.floor === '') e.floor = t('errors.floorRequired')
  else if (!Number.isInteger(floor) || floor < 1 || floor > 100) e.floor = t('errors.floorRange')
  if (form.dailyRate !== '' && !(Number(form.dailyRate) > 0)) e.dailyRate = t('errors.moreThanZero')
  if (form.monthlyRate !== '' && !(Number(form.monthlyRate) > 0)) e.monthlyRate = t('errors.moreThanZero')
  const beds = Number(form.bedCount)
  if (!Number.isInteger(beds) || beds < 1 || beds > 50) e.bedCount = t('errors.bedsRange')
  if (form.bedMonthlyRate !== '' && Number(form.bedMonthlyRate) < 0) e.bedMonthlyRate = t('errors.negative')
  if (form.bedDailyRate !== '' && Number(form.bedDailyRate) < 0) e.bedDailyRate = t('errors.negative')
  // Any one price is enough. Bed rents only count while the room has several beds.
  const prices = [form.dailyRate, form.monthlyRate, ...(beds > 1 ? [form.bedMonthlyRate, form.bedDailyRate] : [])]
  if (!prices.some(p => Number(p) > 0) && !e.dailyRate && !e.monthlyRate) {
    e[beds > 1 ? 'bedMonthlyRate' : 'monthlyRate'] = t('errors.priceRequired')
  }
  return e
}

function FieldError({ msg }) {
  return msg ? <p className="t-xs text-danger-text mt-1 mb-0">{msg}</p> : null
}

function AddRoomForm({ form, onChange, errors = {}, apiError }) {
  const { t } = useTranslation('rooms')
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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-3.5">
      {apiError && (
        <div className="col-span-2 md:col-span-3 t-sm px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text" role="alert">
          {apiError}
        </div>
      )}
      {field(t('form.roomNumber'), 'number', 'text', { placeholder: t('form.eg', { v: 105 }), required: true })}

      {/* Room Type select */}
      <div>
        <label className="form-label block mb-[5px]">{t('form.roomType')}</label>
        <select
          className="form-select"
          value={form.type}
          onChange={e => onChange('type', e.target.value)}
        >
          {ROOM_TYPES.map(ty => (
            <option key={ty} value={ty}>{typeLabel(t, ty)}</option>
          ))}
        </select>
      </div>

      {field(t('form.floor'), 'floor', 'number', { placeholder: t('form.eg', { v: 1 }), min: 1, required: true })}

      <div className="col-span-2 md:col-span-3 -mt-3">
        <BedAndPriceFields form={form} errors={errors} set={k => e => onChange(k, e.target.value)} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Rooms() {
  const { t } = useTranslation('rooms')
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
      setError(t('errors.load'))
    } finally {
      setLoading(false)
    }
  }, [page, filter, floor, query, t])

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
      addToast(t('toast.statusFailed'), 'danger')
    }
  }

  const closeAddModal = () => {
    setShowAddModal(false); setAddForm(EMPTY_FORM); setAddErrors({}); setAddApiError('')
  }

  const handleAddRoom = async () => {
    const errs = addRoomErrors(addForm, t)
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
      addToast(t('toast.added', { number: addForm.number.trim() }), 'success')
      closeAddModal()
      load()
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error
        || (err.response ? t('toast.addFailed') : t('toast.unreachable'))
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
      addToast(t('toast.updated', { number: res.room.number }), 'success')
      const next = normalizeRoom({ ...res.room, bookings: rooms.find(r => r.id === id)?.bookings })
      setRooms(rs => rs.map(r => r.id === id ? next : r))
      setSelectedRoom(next)
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.updateFailed'), 'danger')
      throw err
    }
  }

  const handleDeleteRoom = async () => {
    if (!deleteRoom) return
    setDeleting(true)
    try {
      await roomsApi.delete(deleteRoom.id)
      addToast(t('toast.deleted', { number: deleteRoom.number }), 'success')
      setDeleteRoom(null)
      load()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.deleteFailed'), 'danger')
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

  usePageHeader({
    title: t('title'),
    subtitle: roomCount ? `${t('roomsCount', { count: roomCount })} · ${t('floorsCount', { count: floors.length })}` : t('subtitleEmpty'),
    search: { value: search, onChange: setSearch, placeholder: t('searchPlaceholder') },
    actions: [
      { id: 'view-grid', label: t('view.floor'), icon: <LuLayoutGrid />, variant: 'icon', active: view === 'grid', onClick: () => setView('grid') },
      { id: 'view-kanban', label: t('view.board'), icon: <LuColumns3 />, variant: 'icon', active: view === 'kanban', onClick: () => setView('kanban') },
      { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
      { id: 'add', label: t('addRoom'), icon: <LuPlus />, variant: 'primary', onClick: () => setShowAddModal(true) },
    ],
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {error && (
        <div className="t-sm mb-3 px-3 py-2 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* ── One control bar: occupancy, status filters, floor ── */}
      <div className="card mb-4">
        <div className="flex items-center gap-x-4 gap-y-2 px-3 sm:px-3.5 py-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap" title={t('occupiedTitle', { occupied: counts.occupied, total: roomCount })}>
            <span className="text-[17px] font-bold text-ink tabular-nums leading-none">{occupancy}%</span>
            <span className="t-xs text-ink3">{t('occupiedWord')}</span>
            <div className="flex w-24 h-1.5 rounded-full overflow-hidden bg-surface2 gap-px" role="img"
              aria-label={STATUSES.map(st => `${counts[st]} ${t(`status.${st}`)}`).join(', ')}>
              {roomCount > 0 && STATUSES.map(st => counts[st] > 0 && (
                <span key={st} style={{ width: `${(counts[st] / roomCount) * 100}%`, background: STATUS_COLOR[st] }} />
              ))}
            </div>
            {bedsTotal > 0 && <span className="t-xs text-ink3">· {t('bedsTaken', { taken: bedsTaken, total: bedsTotal })}</span>}
          </div>

          {/* Status chips — each filters the rooms below. One sideways-scrolling
              line on phones, wrapping from sm. */}
          <div className="flex items-center gap-1 w-full sm:w-auto -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none sm:overflow-visible sm:flex-wrap">
            {[{ id: 'all', label: t('common:all'), count: roomCount }, ...STATUSES.map(st => ({ id: st, label: t(`status.${st}`), count: counts[st] }))].map(chip => {
              const active = filter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(active && chip.id !== 'all' ? 'all' : chip.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 h-9 sm:h-7 px-2.5 shrink-0 whitespace-nowrap rounded-full border text-[13px] sm:text-[12px] font-medium cursor-pointer transition-colors duration-150 ${
                    active ? 'border-gold bg-[var(--gold-bg)] text-ink' : 'border-line bg-surface text-ink2 hover:border-line2'
                  }`}
                >
                  {chip.id !== 'all' && <StatusDot status={chip.id} />}
                  {chip.label}
                  <span className="tabular-nums text-ink3">{chip.count}</span>
                </button>
              )
            })}
          </div>

          {/* Floor filter */}
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            <select className="form-select h-11 md:h-8 md:pointer-coarse:h-11 py-1 text-[13px] w-auto min-w-[120px] focus:ring-gold/20 focus:border-gold"
              value={floor} onChange={e => setFloor(e.target.value)} aria-label={t('form.floor')}>
              <option value="all">{t('allFloors')}</option>
              {floors.map(f => <option key={f} value={String(f)}>{t('floor', { floor: f })}</option>)}
            </select>

            {isFiltered && (
              <button type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1 min-h-11 md:min-h-0 bg-transparent border-0 cursor-pointer t-xs font-medium text-ink2 hover:text-ink">
                <LuX size={13} aria-hidden /> {t('clear')}
              </button>
            )}

            {isFiltered && <span className="t-xs text-ink3 hidden sm:inline">{t('nOfTotal', { n: total, total: roomCount })}</span>}
          </div>
        </div>

      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="card py-10 px-6 text-center">
          <span className="w-12 h-12 mx-auto mb-3 rounded-xl bg-surface2 text-ink3 flex items-center justify-center">
            <LuDoorClosed size={22} aria-hidden />
          </span>
          <p className="t-title m-0">{roomCount ? t('empty.filteredTitle') : t('empty.title')}</p>
          <p className="t-xs text-ink3 mt-1 mb-4">{roomCount ? t('empty.filteredMessage') : t('empty.message')}</p>
          {roomCount
            ? <Button variant="outline" size="sm" onClick={clearFilters}>{t('clearFilters')}</Button>
            : <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}><LuPlus size={15} aria-hidden /> {t('addRoom')}</Button>}
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
                  <h2 id={`floor-${g.floor}`} className="text-[13px] font-semibold text-ink m-0">{t('floor', { floor: g.floor })}</h2>
                  <span className="t-xs text-ink3">{t('roomsCount', { count: g.rooms.length })} · {t('availableCount', { count: free })}</span>
                </div>
                {/* Two-up on phones; from sm as many ~190px cards as fit. */}
                <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5 sm:gap-3.5">
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
        title={selectedRoom ? t('roomNo', { number: selectedRoom.number }) : ''}
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
        title={t('delete.title')}
        message={deleteRoom ? <Trans t={t} i18nKey="delete.message" values={{ number: deleteRoom.number }} components={{ b: <b /> }} /> : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deleting}
      />

      {/* ── Maintenance QR Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={!!qrRoom}
        onClose={() => setQrRoom(null)}
        title={qrRoom ? `${t('roomNo', { number: qrRoom.number })} — ${t('qr.button')}` : ''}
      >
        <RoomQrCode room={qrRoom} />
      </Modal>

      {/* ── Add Room Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title={t('add.title')}
        footer={
          <>
            <Button variant="outline" onClick={closeAddModal} disabled={adding}>
              {t('common:cancel')}
            </Button>
            <Button variant="primary" onClick={handleAddRoom} disabled={adding}>
              {adding ? t('common:saving') : t('add.save')}
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
// A room with bed rents shows those; any other room shows its own prices.
const roomPriceLabel = (room, t) => {
  const inr = (n) => `₹${Number(n).toLocaleString(appLocale())}`
  const bed = [
    room.bedMonthlyRate && t('price.bedMonth', { price: inr(room.bedMonthlyRate) }),
    room.bedDailyRate && t('price.bedDay', { price: inr(room.bedDailyRate) }),
  ].filter(Boolean)
  if (isBedRoom(room) && bed.length) return bed.join(' · ')
  return [
    room.monthlyRate && t('price.month', { price: inr(room.monthlyRate) }),
    room.dailyRate && t('price.day', { price: inr(room.dailyRate) }),
  ].filter(Boolean).join(' · ')
}

function RoomCard({ room, onClick }) {
  const { t } = useTranslation('rooms')
  // Bed-by-bed fill only while the room is actually let that way.
  const label = hasBedStays(room)
    ? bedFill(t, bedOccupancy(room).filter(b => b.state === 'free').length, room.bedCount)
    : t(`status.${room.status}`)
  const price = roomPriceLabel(room, t)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${t('roomNo', { number: room.number })}, ${typeLabel(t, room.type)}, ${label}`}
      className="group relative min-w-0 text-left bg-surface border border-line rounded-xl px-3.5 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 min-h-[124px] sm:min-h-[150px] flex flex-col cursor-pointer overflow-hidden transition-all duration-150 hover:border-gold hover:shadow-[var(--shadow)] hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-gold"
    >
      <span className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: STATUS_COLOR[room.status] }} aria-hidden />
      <span className="block text-[22px] sm:text-[26px] font-bold text-ink tabular-nums leading-none truncate">{room.number}</span>
      <span className="block text-[13px] text-ink2 mt-1.5 truncate">
        {typeLabel(t, room.type)}{isBedRoom(room) ? ` · ${t('bedsCount', { count: room.bedCount })}` : ''}
      </span>
      {price && (
        <span className="block t-xs text-ink3 mt-0.5 line-clamp-2 sm:line-clamp-none sm:truncate">{price}</span>
      )}
      {hasBedStays(room) ? (
        <BedSummary room={room} />
      ) : (
        <span className="flex items-center gap-1.5 mt-auto pt-3 text-[13px] font-medium text-ink2">
          <StatusDot status={room.status} />
          {t(`status.${room.status}`)}
        </span>
      )}
    </button>
  )
}

// Bed fill of a PG room on its card: one dot per bed + "1 of 3 free".
function BedSummary({ room }) {
  const { t } = useTranslation('rooms')
  const beds = bedOccupancy(room)
  const free = beds.filter(b => b.state === 'free').length
  // Maintenance still overrides — a room out of service has no free beds to sell.
  if (room.status === 'maintenance') {
    return (
      <span className="flex items-center gap-1.5 mt-auto pt-2.5 text-[13px] font-medium text-ink2">
        <StatusDot status="maintenance" /> {t('status.maintenance')}
      </span>
    )
  }
  return (
    // Dots on their own line: beside the label they force a wrap at card width.
    <span className="flex flex-col items-start gap-1 mt-auto pt-2.5 text-[13px] font-medium text-ink2 whitespace-nowrap">
      <BedDots beds={beds} />
      {bedFill(t, free, beds.length)}
    </span>
  )
}
