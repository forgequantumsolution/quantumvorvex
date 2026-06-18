import { DataTable, StatusBadge, Button, EmptyState } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel, stayLabel } from '../../../utils/booking'

/**
 * Bookings list (API-backed). Shows guest, room, stay, pricing + payment, status,
 * and the lifecycle actions valid for each row's status.
 */
export default function BookingsTable({
  bookings, loading, busyId,
  onConfirm, onCheckIn, onCheckOut, onCancel, onInvoice, onDelete, emptyMessage,
}) {
  const columns = [
    {
      key: 'booking',
      header: 'Booking',
      render: (b) => (
        <div>
          <div className="font-medium text-ink">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
          {b.guestPhone && <div className="text-xs text-ink3 mt-0.5">{b.guestPhone}</div>}
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (b) => (
        <div>
          <div className="text-ink">Room {b.roomNumber}</div>
          <div className="text-xs text-ink3 mt-0.5">
            {b.roomType}{(b.adults || b.children) ? ` · ${b.adults || 1}A${b.children ? ` ${b.children}C` : ''}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      render: (b) => (
        <div>
          <div className="text-ink">{dateRangeLabel(b)}</div>
          <div className="text-xs text-ink3 mt-0.5 capitalize">{b.stayType} · {stayLabel(b)}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (b) => (
        <div className="flex flex-col items-end gap-1">
          <div className="text-ink font-medium">{formatCurrency(b.amount)}</div>
          <StatusBadge status={b.paymentStatus} dot={false} />
          <div className="text-xs text-ink3">
            {Number(b.balanceDue) > 0 ? `${formatCurrency(b.balanceDue)} due` : 'Fully paid'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
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
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) => {
        const busy = busyId === b.id
        return (
          <div className="flex items-center justify-end gap-1.5">
            {b.status === 'Pending' && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onConfirm(b)}>Confirm</Button>
            )}
            {(b.status === 'Confirmed' || b.status === 'Pending') && (
              <Button size="sm" disabled={busy} onClick={() => onCheckIn(b)}>Check-in</Button>
            )}
            {b.status === 'CheckedIn' && (
              <Button size="sm" disabled={busy} onClick={() => onCheckOut(b)}>Check-out</Button>
            )}
            {['Pending', 'Confirmed'].includes(b.status) && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(b)}>Cancel</Button>
            )}
            {onInvoice && ['Confirmed', 'CheckedIn', 'CheckedOut'].includes(b.status) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onInvoice(b)}
                title="Download tax invoice"
              >
                ⤓ Invoice
              </Button>
            )}
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => onDelete(b)}
                title="Delete booking permanently"
              >
                🗑
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      loading={loading}
      empty={<EmptyState icon="◷" title="No bookings here" message={emptyMessage} />}
    />
  )
}
