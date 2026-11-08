import { useTranslation } from 'react-i18next'
import {
  LuTrash2, LuPencil, LuDownload, LuCalendarPlus, LuX, LuCheck, LuReceipt, LuLogOut, LuUndo2, LuArrowRight, LuMoon,
} from 'react-icons/lu'
import { StatusBadge, Button, EmptyState, ActionMenu } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel, splitNames, splitPhones, stayLabel } from '../../../utils/booking'

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

// Statuses the server still accepts a general edit for (see updateBooking).
const EDITABLE = ['Pending', 'Confirmed', 'CheckedIn']

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
            <span className="ml-1 text-xs font-normal text-ink3">+{names.length - 1}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink3 whitespace-nowrap min-w-0">
          <span className="font-mono shrink-0">{b.bookingNo}</span>
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
  const { t } = useTranslation('bookings')
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 inline-flex items-center rounded-md border border-line bg-surface2
                       px-2 py-0.5 font-mono text-[12.5px] text-ink">
        {b.roomNumber}
      </span>
      {b.bed ? (
        // PG bed stay: the bed is what was let, so it replaces the head count.
        <span className="text-xs text-ink3 truncate">
          <span className="font-medium text-gold">{t('bedN', { bed: b.bed })}</span> · {b.roomType}
        </span>
      ) : (
        <span className="text-xs text-ink3 truncate">
          {b.roomType}{(b.adults || b.children)
            ? ` · ${t('table.adultsShort', { count: b.adults || 1 })}${b.children ? ` ${t('table.childrenShort', { count: b.children })}` : ''}`
            : ''}
        </span>
      )}
    </div>
  )
}

// `nowrap` keeps the range on one line in the table; cards are narrower, so there
// the dates are allowed to break rather than run past the card's edge.
function Stay({ b, nowrap = true }) {
  const { t } = useTranslation('bookings')
  return (
    <div className="min-w-0">
      <div className={`text-ink ${nowrap ? 'whitespace-nowrap' : ''}`}>{dateRangeLabel(b)}</div>
      <div className={`text-xs text-ink3 mt-0.5 ${b.tenancy ? '' : 'capitalize'}`}>
        {b.tenancy ? stayLabel(b) : `${t(`stayType.${b.stayType}`, { defaultValue: b.stayType })} · ${stayLabel(b)}`}
      </div>
    </div>
  )
}

// After move-out: money still to hand back, or what was handed back.
function RefundNote({ b }) {
  const { t } = useTranslation('bookings')
  if (b.refundable > 0) return <div className="text-xs text-warning-text font-medium">{t('table.refundPending', { amount: formatCurrency(b.refundable) })}</div>
  if (b.refundAmount > 0) return <div className="text-xs text-ink3">{t('table.refunded', { amount: formatCurrency(b.refundAmount) })}</div>
  return null
}

function Amount({ b, align = 'right' }) {
  const { t } = useTranslation('bookings')
  const due = Number(b.balanceDue) > 0
  if (b.tenancy) {
    // A tenancy has no stay total: show the monthly rent and the running dues.
    return (
      <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
        <span className="text-ink font-medium tabular-nums">
          {formatCurrency(b.roomRate)}<span className="text-xs font-normal text-ink3">{t('table.perMonth')}</span>
        </span>
        <div className={`text-xs ${b.rentOverdue > 0 ? 'text-danger-text font-medium' : due ? 'text-warning-text' : 'text-ink3'}`}>
          {b.rentOverdue > 0
            ? t('table.overdue', { amount: formatCurrency(b.rentOverdue), days: b.overdueDays })
            : due ? t('table.rentDue', { amount: formatCurrency(b.balanceDue) })
            : b.status === 'CheckedIn' ? t('table.rentUpToDate')
              : b.status === 'CheckedOut' ? t('table.settled')
              : b.advance > 0 ? t('table.advance', { amount: formatCurrency(b.advance) }) : t('table.billedFromMoveIn')}
        </div>
        <RefundNote b={b} />
      </div>
    )
  }
  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="text-ink font-medium tabular-nums">{formatCurrency(b.amount)}</span>
        <StatusBadge status={b.paymentStatus} dot={false} />
      </div>
      <div className={`text-xs ${due ? 'text-warning-text' : 'text-ink3'}`}>
        {due ? t('table.due', { amount: formatCurrency(b.balanceDue) }) : t('table.fullyPaid')}
      </div>
      <RefundNote b={b} />
    </div>
  )
}

// Why/when a booking ended — under the badge in the table, on its own line in cards.
function StatusNote({ b, className = '' }) {
  const { t } = useTranslation('bookings')
  if (b.status === 'Cancelled' && b.cancelReason) {
    return <div className={`text-xs text-ink3 truncate ${className}`} title={b.cancelReason}>{b.cancelReason}</div>
  }
  if (b.status === 'CheckedOut' && b.checkedOutAt) {
    return <div className={`text-xs text-ink3 ${className}`}>{t('table.outOn', { date: formatDate(b.checkedOutAt) })}</div>
  }
  return null
}

function Status({ b }) {
  return (
    <div>
      <StatusBadge status={b.status} />
      <StatusNote b={b} className="mt-1 max-w-[160px]" />
    </div>
  )
}

/**
 * One primary button (the action staff reach for on this status) plus every other
 * valid action behind a "⋮" menu — five buttons per row was what made the list
 * feel cramped and impossible to fit on a laptop.
 */
function Actions({ b, busy, h, stretch = false }) {
  const { t } = useTranslation('bookings')
  // A monthly tenancy with rent owing: collecting it is the everyday action.
  const rentDue = b.tenancy && b.status === 'CheckedIn' && Number(b.balanceDue) > 0 && h.onRent
  const primary =
    rentDue
      ? { label: t('actions.collectRent'), onClick: () => h.onRent(b) }
      : b.status === 'CheckedIn'
      ? { label: t('actions.checkOut'), onClick: () => h.onCheckOut(b) }
      : ['Pending', 'Confirmed'].includes(b.status)
        ? { label: t('actions.checkIn'), onClick: () => h.onCheckIn(b) }
        : b.refundable > 0 && h.onRefund
          ? { label: t('actions.refund'), icon: <LuUndo2 size={14} />, onClick: () => h.onRefund(b) }
          : null

  const menu = [
    // Rent is collected while the tenant lives here; after move-out the invoice says it all.
    b.tenancy && h.onRent && b.status === 'CheckedIn' && !rentDue &&
      { label: t('actions.rentPayments'), icon: <LuReceipt size={14} />, onClick: () => h.onRent(b) },
    rentDue &&
      { label: t('actions.checkOut'), icon: <LuLogOut size={14} />, onClick: () => h.onCheckOut(b) },
    b.status === 'Pending' && h.onConfirm &&
      { label: t('actions.confirm'), icon: <LuCheck size={14} />, onClick: () => h.onConfirm(b) },
    h.onEdit && EDITABLE.includes(b.status) &&
      { label: t('actions.edit'), icon: <LuPencil size={14} />, onClick: () => h.onEdit(b) },
    // A tenancy has no end date to extend — it runs until move-out.
    h.onExtend && !b.tenancy && ['Confirmed', 'CheckedIn'].includes(b.status) &&
      { label: t('actions.extend'), icon: <LuCalendarPlus size={14} />, onClick: () => h.onExtend(b) },
    // A tenancy's invoice lists each rent month billed (once it has been billed).
    h.onInvoice && (b.tenancy ? ['CheckedIn', 'CheckedOut'] : ['Confirmed', 'CheckedIn', 'CheckedOut']).includes(b.status) &&
      { label: t('actions.invoice'), icon: <LuDownload size={14} />, onClick: () => h.onInvoice(b) },
    h.onCancel && ['Pending', 'Confirmed'].includes(b.status) &&
      { label: t('actions.cancel'), icon: <LuX size={14} />, onClick: () => h.onCancel(b), danger: true },
    h.onDelete &&
      { label: t('actions.delete'), icon: <LuTrash2 size={14} />, onClick: () => h.onDelete(b), danger: true },
  ]

  return (
    <div className={`flex items-center gap-2 ${stretch ? '' : 'justify-end'}`}>
      {primary && (
        <Button size="sm" disabled={busy} onClick={primary.onClick} icon={primary.icon}
          className={stretch ? 'flex-1 !py-2.5 !text-[13px]' : ''}>
          {busy ? '…' : primary.label}
        </Button>
      )}
      {stretch && !primary && <span className="flex-1" />}
      <ActionMenu items={menu} disabled={busy} />
    </div>
  )
}

// Header keys in bookings:table.columns; the last column (actions) has no header.
const COLUMNS = ['booking', 'room', 'stay', 'amount', 'status', '']

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

// Status colours for the card: a strip along the top and the guest's avatar.
const STATUS_STRIP = {
  Pending: 'bg-warning', Confirmed: 'bg-info', CheckedIn: 'bg-success',
  CheckedOut: 'bg-ink3', Cancelled: 'bg-danger', NoShow: 'bg-danger',
}
const STATUS_AVATAR = {
  Pending: 'bg-warning-bg text-warning-text', Confirmed: 'bg-info-bg text-info-text', CheckedIn: 'bg-success-bg text-success-text',
  CheckedOut: 'bg-surface2 text-ink2', Cancelled: 'bg-danger-bg text-danger-text', NoShow: 'bg-danger-bg text-danger-text',
}

const DAY_MS = 24 * 60 * 60 * 1000
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const daysFrom = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS)
const shortDate = (d) => (d ? formatDate(d, { weekday: 'short', year: undefined }) : '—')

// Check-in → check-out (or move-in for a tenancy), the length of the stay, and
// where the stay is now: arriving in N days, night 2 of 3, leaving today.
function StayPanel({ b }) {
  const { t } = useTranslation('bookings')
  const today = new Date()
  const toArrival = daysFrom(b.fromDate, today)
  const live = ['Pending', 'Confirmed'].includes(b.status)
  const nights = b.toDate ? Math.max(1, daysFrom(b.toDate, b.fromDate)) : 0
  const inHouseDaily = b.status === 'CheckedIn' && !b.tenancy && nights > 0
  const night = inHouseDaily ? Math.min(nights, Math.max(1, daysFrom(today, b.fromDate) + 1)) : 0
  const leavesToday = inHouseDaily && b.toDate && daysFrom(b.toDate, today) === 0

  const timing = live && toArrival > 0 ? t('card.arrivesIn', { count: toArrival })
    : live && toArrival === 0 ? t('card.arrivesToday')
      : leavesToday ? t('card.leavesToday')
        : null

  return (
    <div className="rounded-xl bg-surface2 px-3 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0">
          <div className="text-xs text-ink3">{b.tenancy ? t('card.moveIn') : t('card.checkIn')}</div>
          <div className="text-[13px] font-semibold text-ink truncate">{shortDate(b.fromDate)}</div>
        </div>
        <LuArrowRight size={14} className="text-ink3 shrink-0" aria-hidden />
        <div className="min-w-0 text-right">
          <div className="text-xs text-ink3">{t('card.checkOut')}</div>
          <div className="text-[13px] font-semibold text-ink truncate">
            {b.tenancy ? t('card.untilMoveOut') : b.toDate ? shortDate(b.toDate) : '—'}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 text-xs">
        <span className="inline-flex items-center gap-1 text-ink2 min-w-0 truncate">
          <LuMoon size={12} className="text-ink3 shrink-0" aria-hidden />
          {b.tenancy ? stayLabel(b) : nights ? t('common:nightCount', { count: nights }) : stayLabel(b)}
        </span>
        {timing && <span className={`font-semibold shrink-0 ${leavesToday ? 'text-warning-text' : 'text-info-text'}`}>{timing}</span>}
        {inHouseDaily && !leavesToday && <span className="font-semibold text-success-text shrink-0">{t('card.nightOf', { n: night, total: nights })}</span>}
      </div>
      {inHouseDaily && (
        <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden" role="presentation">
          <div className="h-full rounded-full bg-success" style={{ width: `${(night / nights) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

// What the stay costs and how much is paid, with a bar for the share received.
function MoneyPanel({ b }) {
  const { t } = useTranslation('bookings')
  const due = Number(b.balanceDue) > 0
  if (b.tenancy) {
    return (
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-[18px] font-bold text-ink tabular-nums">{formatCurrency(b.roomRate)}</span>
          <span className="text-xs text-ink3">{t('card.perMonth')}</span>
        </div>
        <div className={`text-xs mt-0.5 ${b.rentOverdue > 0 ? 'text-danger-text font-semibold' : due ? 'text-warning-text font-medium' : 'text-ink3'}`}>
          {b.rentOverdue > 0
            ? t('table.overdue', { amount: formatCurrency(b.rentOverdue), days: b.overdueDays })
            : due ? t('table.rentDue', { amount: formatCurrency(b.balanceDue) })
              : b.status === 'CheckedIn' ? t('table.rentUpToDate') : t('table.settled')}
        </div>
        <RefundNote b={b} />
      </div>
    )
  }
  const amount = Number(b.amount) || 0
  const paid = Math.max(0, Math.min(amount, Number(b.advance) || 0))
  const pct = amount ? Math.round((paid / amount) * 100) : 0
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[18px] font-bold text-ink tabular-nums">{formatCurrency(amount)}</span>
        <StatusBadge status={b.paymentStatus} dot={false} />
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-surface2 overflow-hidden" role="presentation">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5 text-xs">
        <span className="text-ink3">{t('card.paid', { amount: formatCurrency(paid) })}</span>
        <span className={due ? 'text-warning-text font-semibold' : 'text-success-text font-medium'}>
          {due ? t('table.due', { amount: formatCurrency(b.balanceDue) }) : t('table.fullyPaid')}
        </span>
      </div>
      <RefundNote b={b} />
    </div>
  )
}

/**
 * One booking as a card (phones, tablets, and the Cards view everywhere): a
 * status strip, the guest and status, room, a dates panel that says where the
 * stay is now, a payment bar, and the main action as a full-width button.
 */
function BookingCard({ b, busy, h }) {
  const names = splitNames(b.guestName)
  const phones = splitPhones(b.guestPhone)
  return (
    <article className="relative min-w-0 flex flex-col rounded-2xl border border-line bg-surface shadow-soft overflow-hidden
                        transition-[box-shadow,border-color] duration-150 hover:shadow-lift hover:border-line2">
      <span className={`absolute inset-x-0 top-0 h-1 ${STATUS_STRIP[b.status] || 'bg-line2'}`} aria-hidden />
      <div className="p-4 pt-5 flex flex-col gap-3.5 flex-1">
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold ${STATUS_AVATAR[b.status] || 'bg-surface2 text-ink2'}`}>
            {initials(b.guestName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[15px] text-ink truncate" title={names.join(', ')}>
              {names[0] || b.guestName}
              {names.length > 1 && <span className="ml-1 text-xs font-normal text-ink3">+{names.length - 1}</span>}
            </div>
            <div className="text-xs text-ink3 truncate mt-0.5">
              <span className="font-mono">{b.bookingNo}</span>{phones[0] ? ` · ${phones[0]}` : ''}
            </div>
          </div>
          <div className="shrink-0"><StatusBadge status={b.status} /></div>
        </div>
        <StatusNote b={b} className="-mt-2 pl-14" />

        <Room b={b} />
        <StayPanel b={b} />
        <MoneyPanel b={b} />
      </div>
      <div className="px-4 pb-4 pt-0 mt-auto">
        <Actions b={b} busy={busy} h={h} stretch />
      </div>
    </article>
  )
}

function CardGrid({ bookings, loading, busyId, h, className = '' }) {
  return (
    <div className={`grid gap-3 sm:gap-4 p-3 sm:p-4 grid-cols-1 md:grid-cols-2 ${className}`}>
      {loading
        ? <CardSkeletons count={4} />
        : bookings.map((b) => <BookingCard key={b.id} b={b} busy={busyId === b.id} h={h} />)}
    </div>
  )
}

/**
 * Tablet/laptop layout of the list view (sm → 2xl): one row per booking in three
 * columns, so a portrait tablet reads like the table without its sixth column.
 */
function BookingRow({ b, busy, h }) {
  return (
    <article className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] gap-x-5 items-center px-5 py-3.5 text-sm
                        transition-colors hover:bg-surface2/70">
      <div className="min-w-0">
        <Guest b={b} />
        <div className="mt-1.5 pl-12"><Status b={b} /></div>
      </div>
      <div className="min-w-0 space-y-1.5">
        <Room b={b} />
        <div className="text-[13px]"><Stay b={b} nowrap={false} /></div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Amount b={b} />
        <Actions b={b} busy={busy} h={h} />
      </div>
    </article>
  )
}

function CardSkeletons({ count }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="space-y-2.5 p-4 rounded-2xl border border-line">
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
 * Layouts: phones and tablets (below xl) always get booking cards — one column,
 * two from md. From xl the List view shows three-column rows, and the full table
 * from 2xl (its six columns need ~1100px). The Cards view shows cards at any width.
 */
export default function BookingsTable({
  bookings, loading, busyId, view = 'table',
  onConfirm, onCheckIn, onCheckOut, onCancel, onExtend, onInvoice, onEdit, onDelete, onRent, onRefund, emptyMessage,
}) {
  const { t } = useTranslation('bookings')
  const h = { onConfirm, onCheckIn, onCheckOut, onCancel, onExtend, onInvoice, onEdit, onDelete, onRent, onRefund }
  const asCards = view === 'cards'

  if (!loading && !bookings.length) {
    return <EmptyState icon="◷" title={t('page.emptyTitle')} message={emptyMessage} />
  }

  return (
    <>
      {/* ── Table (2xl and up, when it's the chosen view) ── */}
      {!asCards && (
        <div className="hidden 2xl:block overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="border-b border-line bg-surface2/60">
                {COLUMNS.map((c, i) => (
                  <th
                    key={c || i}
                    className={`px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-ink3 whitespace-nowrap ${
                      i === 3 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c && t(`table.columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows /> : bookings.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 transition-colors hover:bg-surface2/70">
                  <td className="px-4 py-3.5 max-w-[260px]"><Guest b={b} /></td>
                  <td className="px-4 py-3.5"><Room b={b} /></td>
                  <td className="px-4 py-3.5"><Stay b={b} /></td>
                  <td className="px-4 py-3.5 text-right"><Amount b={b} /></td>
                  <td className="px-4 py-3.5"><Status b={b} /></td>
                  <td className="px-4 py-3.5 text-right"><Actions b={b} busy={busyId === b.id} h={h} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cards: phones and tablets always; any width in the Cards view ── */}
      <CardGrid bookings={bookings} loading={loading} busyId={busyId} h={h}
        className={asCards ? 'xl:grid-cols-3' : 'xl:hidden'} />

      {/* ── List view on laptops (xl → 2xl): three-column rows ── */}
      {!asCards && (
        <div className="hidden xl:block 2xl:hidden divide-y divide-line">
          {loading
            ? <CardSkeletons count={4} />
            : bookings.map((b) => <BookingRow key={b.id} b={b} busy={busyId === b.id} h={h} />)}
        </div>
      )}
    </>
  )
}
