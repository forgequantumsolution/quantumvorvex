import { useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, DataTable, StatusBadge, SearchInput, Button, EmptyState } from '../../ui-tw'
import CancelModal from './CancelModal'
import { useAppSelector, useOpsActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel } from '../../../utils/booking'

export default function Cancellations() {
  const bookings = useAppSelector((s) => s.ops.bookings)
  const { cancelBooking } = useOpsActions()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const cancelled = useMemo(() => bookings.filter((b) => b.status === 'Cancelled'), [bookings])

  // Bookings that can still be cancelled (for the picker).
  const cancellable = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending'),
    [bookings],
  )

  const stats = useMemo(() => {
    const lostRevenue = cancelled.reduce((s, b) => s + (Number(b.amount) || 0), 0)
    const rate = bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0
    return {
      cancelled: cancelled.length,
      cancellable: cancellable.length,
      lostRevenue,
      rate,
    }
  }, [cancelled, cancellable, bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cancelled
    return cancelled.filter(
      (b) =>
        b.guestName.toLowerCase().includes(q) ||
        b.bookingNo.toLowerCase().includes(q) ||
        (b.cancelReason || '').toLowerCase().includes(q),
    )
  }, [cancelled, query])

  const handleCancel = ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    cancelBooking({ id, reason })
    toast(`Booking ${b?.bookingNo || ''} cancelled`, 'error')
    setShowCancel(false)
  }

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
    { key: 'room', header: 'Room', render: (b) => `${b.room} · ${b.roomType}` },
    { key: 'stay', header: 'Planned stay', render: (b) => dateRangeLabel(b) },
    {
      key: 'reason',
      header: 'Reason',
      render: (b) => <span className="text-ink2">{b.cancelReason || '—'}</span>,
    },
    {
      key: 'cancelledAt',
      header: 'Cancelled',
      align: 'right',
      render: (b) => (
        <div>
          <div className="text-ink">{formatDate(b.cancelledAt)}</div>
          <div className="text-xs text-ink3 mt-0.5">{formatCurrency(b.amount)} value</div>
        </div>
      ),
    },
  ]

  return (
    <PageWrapper
      title="Cancellations"
      subtitle="Review cancelled bookings and cancel reservations"
      icon="✕"
      actions={
        <Button variant="danger" icon="✕" onClick={() => setShowCancel(true)} disabled={!cancellable.length}>
          Cancel a Booking
        </Button>
      }
      stats={
        <>
          <StatCard icon="✕" tone="red" label="Cancelled bookings" value={stats.cancelled} />
          <StatCard icon="%" tone="amber" label="Cancellation rate" value={`${stats.rate}%`} />
          <StatCard icon="₹" tone="grey" label="Lost value" value={formatCurrency(stats.lostRevenue)} />
          <StatCard icon="◷" tone="blue" label="Still cancellable" value={stats.cancellable} />
        </>
      }
    >
      <Card
        title="Cancelled Bookings"
        actions={<SearchInput value={query} onChange={setQuery} placeholder="Search name, no. or reason" className="w-60" />}
      >
        <DataTable
          columns={columns}
          rows={filtered}
          empty={
            <EmptyState
              icon="✓"
              title={query ? 'No matching cancellations' : 'No cancellations'}
              message={query ? 'Try a different search.' : 'Cancelled bookings will appear here.'}
            />
          }
        />
      </Card>

      <CancelModal
        isOpen={showCancel}
        bookings={cancellable}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
      />
    </PageWrapper>
  )
}
