import { useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, DataTable, StatusBadge, SearchInput, Button, EmptyState } from '../../ui-tw'
import CheckOutModal from './CheckOutModal'
import { useAppSelector, useOpsActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatDate } from '../../../utils/format'
import { balance, stayLabel } from '../../../utils/booking'

export default function CheckOut() {
  const bookings = useAppSelector((s) => s.ops.bookings)
  const { checkOutBooking } = useOpsActions()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)

  // In-house guests = currently checked in.
  const inHouse = useMemo(() => bookings.filter((b) => b.status === 'CheckedIn'), [bookings])

  const stats = useMemo(
    () => ({
      inHouse: inHouse.length,
      dueAmount: inHouse.reduce((s, b) => s + balance(b), 0),
      departedToday: bookings.filter((b) => b.status === 'CheckedOut' && b.checkedOutAt).length,
      withBalance: inHouse.filter((b) => balance(b) > 0).length,
    }),
    [inHouse, bookings],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return inHouse
    return inHouse.filter(
      (b) =>
        b.guestName.toLowerCase().includes(q) ||
        b.bookingNo.toLowerCase().includes(q) ||
        b.room.includes(q),
    )
  }, [inHouse, query])

  const handleCheckOut = (booking) => {
    checkOutBooking(booking.id)
    toast(`${booking.guestName} checked out from Room ${booking.room}`)
    setTarget(null)
  }

  const columns = [
    {
      key: 'guest',
      header: 'Guest',
      render: (b) => (
        <div>
          <div className="font-medium text-ink">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
        </div>
      ),
    },
    { key: 'room', header: 'Room', render: (b) => `${b.room} · ${b.roomType}` },
    {
      key: 'stay',
      header: 'Stay',
      render: (b) => (
        <div>
          <div className="text-ink">{stayLabel(b)}</div>
          <div className="text-xs text-ink3 mt-0.5">In: {formatDate(b.checkedInAt || b.fromDate)}</div>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (b) =>
        balance(b) > 0 ? (
          <span className="text-danger-text font-semibold">{formatCurrency(balance(b))}</span>
        ) : (
          <StatusBadge status="Resolved" label="Settled" dot={false} />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) => (
        <Button variant="success" size="sm" icon="✓" onClick={() => setTarget(b)}>
          Check Out
        </Button>
      ),
    },
  ]

  return (
    <PageWrapper
      title="Check-Out"
      subtitle="Settle bills and release rooms for departing guests"
      icon="↘"
      actions={<SearchInput value={query} onChange={setQuery} placeholder="Search in-house" className="w-56" />}
      stats={
        <>
          <StatCard icon="🏨" tone="gold" label="In-house guests" value={stats.inHouse} />
          <StatCard icon="!" tone="amber" label="With balance due" value={stats.withBalance} />
          <StatCard icon="₹" tone="red" label="Total collectable" value={formatCurrency(stats.dueAmount)} />
          <StatCard icon="✓" tone="green" label="Checked out" value={stats.departedToday} />
        </>
      }
    >
      <Card title="In-House Guests">
        <DataTable
          columns={columns}
          rows={filtered}
          empty={
            <EmptyState
              icon="↘"
              title={query ? 'No matching guests' : 'No guests in-house'}
              message={query ? 'Try a different search.' : 'Check in a guest to see them here.'}
            />
          }
        />
      </Card>

      <CheckOutModal isOpen={!!target} booking={target} onClose={() => setTarget(null)} onConfirm={handleCheckOut} />
    </PageWrapper>
  )
}
