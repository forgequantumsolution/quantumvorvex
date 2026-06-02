import { useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button } from '../../ui-tw'
import BookingsTable from './BookingsTable'
import NewBookingModal from './NewBookingModal'
import CancelModal from '../cancellations/CancelModal'
import { useAppSelector, useOpsActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'
import { isUpcoming, balance } from '../../../utils/booking'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Cancelled', label: 'Cancelled' },
]

export default function Bookings() {
  const bookings = useAppSelector((s) => s.ops.bookings)
  const { addBooking, cancelBooking } = useOpsActions()
  const toast = useToast()

  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)

  // Stats
  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Cancelled' && b.status !== 'CheckedOut')
    return {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
      pending: bookings.filter((b) => b.status === 'Pending').length,
      revenue: active.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      dues: active.reduce((sum, b) => sum + balance(b), 0),
    }
  }, [bookings])

  // Tab counts
  const counts = useMemo(
    () => ({
      all: bookings.length,
      Upcoming: bookings.filter(isUpcoming).length,
      Confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
      Pending: bookings.filter((b) => b.status === 'Pending').length,
      Cancelled: bookings.filter((b) => b.status === 'Cancelled').length,
    }),
    [bookings],
  )

  const filtered = useMemo(() => {
    let list = bookings
    if (tab === 'Upcoming') list = list.filter(isUpcoming)
    else if (tab !== 'all') list = list.filter((b) => b.status === tab)

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (b) =>
          b.guestName.toLowerCase().includes(q) ||
          b.bookingNo.toLowerCase().includes(q) ||
          b.room.includes(q),
      )
    }
    return list
  }, [bookings, tab, query])

  const handleCreate = (booking) => {
    addBooking(booking)
    toast(`Booking ${booking.bookingNo} created for ${booking.guestName}`)
    setShowNew(false)
  }

  const handleCancel = ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    cancelBooking({ id, reason })
    toast(`Booking ${b?.bookingNo || ''} cancelled`, 'error')
    setCancelTarget(null)
  }

  return (
    <PageWrapper
      title="Bookings"
      subtitle="Create and manage room reservations"
      icon="◷"
      actions={<Button icon="＋" onClick={() => setShowNew(true)}>New Booking</Button>}
      stats={
        <>
          <StatCard icon="◷" tone="gold" label="Total bookings" value={stats.total} />
          <StatCard icon="✓" tone="blue" label="Confirmed" value={stats.confirmed} hint={`${stats.pending} pending`} />
          <StatCard icon="₹" tone="green" label="Active value" value={formatCurrency(stats.revenue)} />
          <StatCard icon="!" tone="amber" label="Outstanding dues" value={formatCurrency(stats.dues)} />
        </>
      }
    >
      <Card
        title="All Bookings"
        actions={
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, no. or room" className="w-56" />
        }
      >
        <div className="px-5 py-3 border-b border-line">
          <FilterTabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
            active={tab}
            onChange={setTab}
          />
        </div>
        <BookingsTable
          bookings={filtered}
          onCancel={setCancelTarget}
          emptyMessage={query ? 'No bookings match your search.' : 'Create a booking to get started.'}
        />
      </Card>

      <NewBookingModal isOpen={showNew} onClose={() => setShowNew(false)} onSave={handleCreate} />
      <CancelModal
        isOpen={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
      />
    </PageWrapper>
  )
}
