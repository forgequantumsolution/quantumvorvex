import { DataTable, StatusBadge, Button, EmptyState } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { balance, dateRangeLabel, stayLabel } from '../../../utils/booking'

/** Bookings list. Shows a Cancel action for still-cancellable rows. */
export default function BookingsTable({ bookings, onCancel, emptyMessage }) {
  const columns = [
    {
      key: 'booking',
      header: 'Booking',
      render: (b) => (
        <div>
          <div className="font-medium text-ink">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (b) => (
        <div>
          <div className="text-ink">Room {b.room}</div>
          <div className="text-xs text-ink3 mt-0.5">{b.roomType}</div>
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
        <div>
          <div className="text-ink font-medium">{formatCurrency(b.amount)}</div>
          <div className="text-xs text-ink3 mt-0.5">
            {balance(b) > 0 ? `${formatCurrency(balance(b))} due` : 'Fully paid'}
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
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) =>
        b.status === 'Confirmed' || b.status === 'Pending' ? (
          <Button variant="ghost" size="sm" onClick={() => onCancel(b)}>Cancel</Button>
        ) : b.status === 'CheckedOut' ? (
          <span className="text-xs text-ink3">Out · {formatDate(b.checkedOutAt)}</span>
        ) : null,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      empty={<EmptyState icon="◷" title="No bookings here" message={emptyMessage} />}
    />
  )
}
