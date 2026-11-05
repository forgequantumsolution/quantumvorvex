import { useTranslation } from 'react-i18next'
import {
  LuTrash2, LuPencil, LuDownload, LuCalendarPlus, LuX, LuCheck, LuReceipt, LuLogOut, LuUndo2,
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
function Actions({ b, busy, h }) {
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
    <div className="flex items-center justify-end gap-2">
      {primary && (
        <Button size="sm" disabled={busy} onClick={primary.onClick}>
          {busy ? '…' : primary.label}
        </Button>
      )}
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

/**
 * One booking as a card. `boxed` gives it its own border for the grid layout;
 * without it the cards sit in a divided list (the phone fallback). Guest and
 * status lead, room + stay sit side by side, and the money shares the footer
 * with the actions so the primary button is always on the card's last line.
 */
function BookingCard({ b, busy, h, boxed }) {
  const { t } = useTranslation('bookings')
  return (
    <article className={boxed ? 'rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line2 min-w-0' : 'px-4 py-4 min-w-0'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0"><Guest b={b} /></div>
        <div className="shrink-0"><StatusBadge status={b.status} /></div>
      </div>
      <StatusNote b={b} className="mt-1.5 pl-12" />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wider text-ink3 mb-1">{t('table.columns.room')}</dt>
          <dd className="min-w-0"><Room b={b} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wider text-ink3 mb-1">{t('table.columns.stay')}</dt>
          <dd className="text-[13px]"><Stay b={b} nowrap={false} /></dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mt-3.5 pt-3 border-t border-line">
        <div className="min-w-0"><Amount b={b} align="left" /></div>
        <div className="ml-auto"><Actions b={b} busy={busy} h={h} /></div>
      </div>
    </article>
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
 * the table is only ever used from 2xl (1536px) up — its six columns need ~1100px,
 * which a 1280–1440 laptop with the full sidebar doesn't have, and a sideways-
 * scrolling table hides the actions. Narrower screens fall back to cards
 * (phones) or three-column rows (tablets and laptops).
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

      {/* ── Cards: the chosen view at any width ── */}
      {asCards && (
        <div className="grid gap-3 p-3 sm:p-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? <CardSkeletons count={6} boxed />
            : bookings.map((b) => (
                <BookingCard key={b.id} b={b} busy={busyId === b.id} h={h} boxed />
              ))}
        </div>
      )}

      {/* ── Table view below 2xl: cards on phones, three-column rows from sm ── */}
      {!asCards && (
        <div className="2xl:hidden divide-y divide-line">
          {loading
            ? <CardSkeletons count={4} />
            : bookings.map((b) => (
                <div key={b.id}>
                  <div className="sm:hidden"><BookingCard b={b} busy={busyId === b.id} h={h} /></div>
                  <div className="hidden sm:block"><BookingRow b={b} busy={busyId === b.id} h={h} /></div>
                </div>
              ))}
        </div>
      )}
    </>
  )
}
