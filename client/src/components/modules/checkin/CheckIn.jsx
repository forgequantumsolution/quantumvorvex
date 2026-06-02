import { useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, SearchInput, EmptyState } from '../../ui-tw'
import ArrivalCard from './ArrivalCard'
import { useAppSelector, useOpsActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'
import { TODAY, balance } from '../../../utils/booking'
import { formatCurrency } from '../../../utils/format'

export default function CheckIn() {
  const bookings = useAppSelector((s) => s.ops.bookings)
  const { checkInBooking } = useOpsActions()
  const toast = useToast()
  const [query, setQuery] = useState('')

  // Expected arrivals = confirmed/pending bookings not yet checked in.
  const arrivals = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending'),
    [bookings],
  )

  const stats = useMemo(() => {
    const today = arrivals.filter((b) => b.fromDate === TODAY)
    return {
      expected: arrivals.length,
      today: today.length,
      pendingDues: arrivals.reduce((s, b) => s + balance(b), 0),
      inHouse: bookings.filter((b) => b.status === 'CheckedIn').length,
    }
  }, [arrivals, bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? arrivals.filter(
          (b) =>
            b.guestName.toLowerCase().includes(q) ||
            b.bookingNo.toLowerCase().includes(q) ||
            b.room.includes(q),
        )
      : arrivals
    // Show today's arrivals first, then by arrival date.
    return [...list].sort((a, b) => a.fromDate.localeCompare(b.fromDate))
  }, [arrivals, query])

  const handleCheckIn = (booking) => {
    checkInBooking(booking.id)
    toast(`${booking.guestName} checked in to Room ${booking.room}`)
  }

  return (
    <PageWrapper
      title="Check-In"
      subtitle="Welcome arriving guests and assign their rooms"
      icon="↗"
      actions={<SearchInput value={query} onChange={setQuery} placeholder="Search arrivals" className="w-56" />}
      stats={
        <>
          <StatCard icon="↗" tone="gold" label="Expected arrivals" value={stats.expected} />
          <StatCard icon="📅" tone="blue" label="Arriving today" value={stats.today} />
          <StatCard icon="🏨" tone="green" label="Currently in-house" value={stats.inHouse} />
          <StatCard icon="₹" tone="amber" label="Collectable on arrival" value={formatCurrency(stats.pendingDues)} />
        </>
      }
    >
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="↗"
            title={query ? 'No matching arrivals' : 'No pending arrivals'}
            message={query ? 'Try a different search.' : 'Everyone expected has already checked in.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <ArrivalCard key={b.id} booking={b} isToday={b.fromDate === TODAY} onCheckIn={handleCheckIn} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
