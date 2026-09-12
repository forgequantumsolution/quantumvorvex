import { useEffect, useRef, useState } from 'react'
import {
  LuTrash2, LuPencil, LuEllipsisVertical, LuDownload, LuCalendarPlus, LuX, LuCheck,
} from 'react-icons/lu'
import { StatusBadge, Button, EmptyState } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel, splitNames, splitPhones, stayLabel } from '../../../utils/booking'

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

// Statuses the server still accepts a general edit for (see updateBooking).
const EDITABLE = ['Pending', 'Confirmed', 'CheckedIn']

/**
 * Overflow ("⋮") menu for a row's secondary actions. The list is rendered
 * `position: fixed` and anchored to the button so it escapes the table's
 * horizontal scroll container, which would otherwise clip it; that also means it
 * can't follow the row, so any scroll or resize closes it.
 */
function RowMenu({ items, disabled }) {
  const visible = items.filter(Boolean)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!visible.length) return null

  const toggle = () => {
    const r = btnRef.current.getBoundingClientRect()
    const h = visible.length * 34 + 10
    const room = window.innerHeight - r.bottom
    setPos({
      top: room < h + 12 ? Math.max(8, r.top - h - 6) : r.bottom + 6,
      right: Math.max(8, window.innerWidth - r.right),
    })
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label="More actions"
        aria-expanded={open}
        className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed ${
                      open ? 'border-gold text-gold bg-gold-bg' : 'border-line2 text-ink3 hover:text-ink hover:border-line2'
                    }`}
      >
        <LuEllipsisVertical size={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[300] min-w-[180px] py-1 rounded-xl border border-line bg-surface shadow-lift
                     animate-[menuIn_.12s_ease-out]"
        >
          {visible.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => { setOpen(false); it.onClick() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors ${
                it.danger ? 'text-danger-text hover:bg-danger-bg' : 'text-ink2 hover:bg-surface2 hover:text-ink'
              }`}
            >
              <span className="text-ink3 shrink-0">{it.icon}</span>
              {it.label}
            </button>
          ))}
          <style>{`@keyframes menuIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }`}</style>
        </div>
      )}
    </>
  )
}

// ── Cell pieces, shared by the desktop table and the mobile cards ──

function Guest({ b }) {
  const phones = splitPhones(b.guestPhone)
  // A booking can name several occupants; the first is who it is billed to.
  const names = splitNames(b.guestName)
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="shrink-0 w-9 h-9 rounded-full bg-gold-bg border border-gold-border text-gold
                       flex items-center justify-center text-[12px] font-semibold">
        {initials(b.guestName)}
      </span>
      <div className="min-w-0">
        <div className="font-medium text-ink truncate" title={names.join(', ')}>
          {names[0] || b.guestName}
          {names.length > 1 && (
            <span className="ml-1 text-[11px] font-normal text-ink3">+{names.length - 1}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink3 whitespace-nowrap">
          <span className="font-mono">{b.bookingNo}</span>
          {phones[0] && (
            <span className="truncate" title={phones.join(', ')}>
              · {phones[0]}{phones.length > 1 ? ` +${phones.length - 1}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Room({ b }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 inline-flex items-center rounded-md border border-line bg-surface2
                       px-2 py-0.5 font-mono text-[12.5px] text-ink">
        {b.roomNumber}
      </span>
      <span className="text-xs text-ink3 truncate">
        {b.roomType}{(b.adults || b.children) ? ` · ${b.adults || 1}A${b.children ? ` ${b.children}C` : ''}` : ''}
      </span>
    </div>
  )
}

// `nowrap` keeps the range on one line in the table; cards are narrower, so there
// the dates are allowed to break rather than run past the card's edge.
function Stay({ b, nowrap = true }) {
  return (
    <div className="min-w-0">
      <div className={`text-ink ${nowrap ? 'whitespace-nowrap' : ''}`}>{dateRangeLabel(b)}</div>
      <div className="text-xs text-ink3 mt-0.5 capitalize">{b.stayType} · {stayLabel(b)}</div>
    </div>
  )
}

function Amount({ b, align = 'right' }) {
  const due = Number(b.balanceDue) > 0
  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="text-ink font-medium tabular-nums">{formatCurrency(b.amount)}</span>
        <StatusBadge status={b.paymentStatus} dot={false} />
      </div>
      <div className={`text-xs ${due ? 'text-warning-text' : 'text-ink3'}`}>
        {due ? `${formatCurrency(b.balanceDue)} due` : 'Fully paid'}
      </div>
    </div>
  )
}

function Status({ b }) {
  return (
    <div>
      <StatusBadge status={b.status} />
      {b.status === 'Cancelled' && b.cancelReason && (
        <div className="text-[11px] text-ink3 mt-1 max-w-[160px] truncate" title={b.cancelReason}>
          {b.cancelReason}
        </div>
      )}
      {b.status === 'CheckedOut' && b.checkedOutAt && (
        <div className="text-[11px] text-ink3 mt-1">Out · {formatDate(b.checkedOutAt)}</div>
      )}
    </div>
  )
}

/**
 * One primary button (the action staff reach for on this status) plus every other
 * valid action behind a "⋮" menu — five buttons per row was what made the list
 * feel cramped and impossible to fit on a laptop.
 */
function Actions({ b, busy, h }) {
  const primary =
    b.status === 'CheckedIn'
      ? { label: 'Check-out', onClick: () => h.onCheckOut(b) }
      : ['Pending', 'Confirmed'].includes(b.status)
        ? { label: 'Check-in', onClick: () => h.onCheckIn(b) }
        : null

  const menu = [
    b.status === 'Pending' && h.onConfirm &&
      { label: 'Confirm booking', icon: <LuCheck size={14} />, onClick: () => h.onConfirm(b) },
    h.onEdit && EDITABLE.includes(b.status) &&
      { label: 'Edit details', icon: <LuPencil size={14} />, onClick: () => h.onEdit(b) },
    h.onExtend && ['Confirmed', 'CheckedIn'].includes(b.status) &&
      { label: 'Extend stay', icon: <LuCalendarPlus size={14} />, onClick: () => h.onExtend(b) },
    h.onInvoice && ['Confirmed', 'CheckedIn', 'CheckedOut'].includes(b.status) &&
      { label: 'Download invoice', icon: <LuDownload size={14} />, onClick: () => h.onInvoice(b) },
    h.onCancel && ['Pending', 'Confirmed'].includes(b.status) &&
      { label: 'Cancel booking', icon: <LuX size={14} />, onClick: () => h.onCancel(b), danger: true },
    h.onDelete &&
      { label: 'Delete booking', icon: <LuTrash2 size={14} />, onClick: () => h.onDelete(b), danger: true },
  ]

  return (
    <div className="flex items-center justify-end gap-2">
      {primary && (
        <Button size="sm" disabled={busy} onClick={primary.onClick}>
          {busy ? '…' : primary.label}
        </Button>
      )}
      <RowMenu items={menu} disabled={busy} />
    </div>
  )
}

const COLUMNS = ['Booking', 'Room', 'Stay', 'Amount', 'Status', '']

function SkeletonRows({ rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} className="border-b border-line last:border-0">
      {COLUMNS.map((_c, j) => (
        <td key={j} className="px-5 py-4">
          <div className="h-3.5 rounded bg-surface2 animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  ))
}

/**
 * One booking as a card. `boxed` gives it its own border for the grid layout;
 * without it the cards sit in a divided list (the narrow-screen fallback).
 */
function BookingCard({ b, busy, h, boxed }) {
  return (
    <article className={boxed ? 'rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line2' : 'p-4'}>
      <div className="flex items-start justify-between gap-3">
        <Guest b={b} />
        <div className="shrink-0"><Status b={b} /></div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3.5 pt-3.5 border-t border-line">
        <div className="min-w-0">
          <dt className="text-[10.5px] uppercase tracking-wider text-ink3 mb-1">Room</dt>
          <dd><Room b={b} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10.5px] uppercase tracking-wider text-ink3 mb-1">Stay</dt>
          <dd className="text-[13px]"><Stay b={b} nowrap={false} /></dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10.5px] uppercase tracking-wider text-ink3 mb-1">Amount</dt>
          <dd><Amount b={b} align="left" /></dd>
        </div>
      </dl>

      <div className="mt-3.5"><Actions b={b} busy={busy} h={h} /></div>
    </article>
  )
}

function CardSkeletons({ count, boxed }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className={`space-y-2.5 p-4 ${boxed ? 'rounded-xl border border-line' : ''}`}>
      <div className="h-4 w-1/2 rounded bg-surface2 animate-pulse" />
      <div className="h-3 w-3/4 rounded bg-surface2 animate-pulse" />
      <div className="h-3 w-2/3 rounded bg-surface2 animate-pulse" />
    </div>
  ))
}

/**
 * Bookings list (API-backed). Shows guest, room, stay, pricing + payment, status,
 * and the lifecycle actions valid for each row's status.
 *
 * One set of cell components feeds both layouts. `view` picks between them, but
 * the table is only ever used from `lg` up — a six-column table on a phone is a
 * horizontal-scroll trap, so narrow screens always fall back to the cards.
 */
export default function BookingsTable({
  bookings, loading, busyId, view = 'table',
  onConfirm, onCheckIn, onCheckOut, onCancel, onExtend, onInvoice, onEdit, onDelete, emptyMessage,
}) {
  const h = { onConfirm, onCheckIn, onCheckOut, onCancel, onExtend, onInvoice, onEdit, onDelete }
  const asCards = view === 'cards'

  if (!loading && !bookings.length) {
    return <EmptyState icon="◷" title="No bookings here" message={emptyMessage} />
  }

  return (
    <>
      {/* ── Table (lg and up, when it's the chosen view) ── */}
      {!asCards && (
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="border-b border-line bg-surface2/60">
                {COLUMNS.map((c, i) => (
                  <th
                    key={c || i}
                    className={`px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-ink3 whitespace-nowrap ${
                      i === 3 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows /> : bookings.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 transition-colors hover:bg-surface2/70">
                  <td className="px-5 py-3.5 max-w-[280px]"><Guest b={b} /></td>
                  <td className="px-5 py-3.5"><Room b={b} /></td>
                  <td className="px-5 py-3.5"><Stay b={b} /></td>
                  <td className="px-5 py-3.5 text-right"><Amount b={b} /></td>
                  <td className="px-5 py-3.5"><Status b={b} /></td>
                  <td className="px-5 py-3.5 text-right"><Actions b={b} busy={busyId === b.id} h={h} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cards: the chosen view at any width, or the fallback below lg ── */}
      <div
        className={
          asCards
            ? 'grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3'
            : 'lg:hidden divide-y divide-line'
        }
      >
        {loading
          ? <CardSkeletons count={asCards ? 6 : 4} boxed={asCards} />
          : bookings.map((b) => (
              <BookingCard key={b.id} b={b} busy={busyId === b.id} h={h} boxed={asCards} />
            ))}
      </div>
    </>
  )
}
