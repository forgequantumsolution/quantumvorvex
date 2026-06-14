import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, SearchInput, EmptyState, Button } from '../../ui-tw'
import ArrivalCard from './ArrivalCard'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { normalizeBooking } from '../../../utils/normalizeBooking'
import { TODAY } from '../../../utils/booking'
import { formatCurrency } from '../../../utils/format'

// "today" prefix match against an ISO datetime string
const isToday = (d) => String(d || '').startsWith(TODAY)

export default function CheckIn() {
  const toast = useToast()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await bookingsApi.getAll()
      setBookings((data.bookings || []).map(normalizeBooking))
    } catch {
      setError('Could not load arrivals. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Expected arrivals = confirmed/pending bookings not yet checked in.
  const arrivals = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending'),
    [bookings],
  )

  const stats = useMemo(() => ({
    expected: arrivals.length,
    today: arrivals.filter((b) => isToday(b.fromDate)).length,
    pendingDues: arrivals.reduce((s, b) => s + (Number(b.balanceDue) || 0), 0),
    inHouse: bookings.filter((b) => b.status === 'CheckedIn').length,
  }), [arrivals, bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? arrivals.filter((b) =>
          b.guestName?.toLowerCase().includes(q) ||
          b.bookingNo?.toLowerCase().includes(q) ||
          String(b.roomNumber || '').includes(q))
      : arrivals
    return [...list].sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)))
  }, [arrivals, query])

  const handleCheckIn = async (booking) => {
    setBusyId(booking.id)
    try {
      const { data } = await bookingsApi.checkIn(booking.id)
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? normalizeBooking(data.booking) : b)))
      toast(`${booking.guestName} checked in to Room ${booking.roomNumber}`)
    } catch (err) {
      toast(err.response?.data?.message || 'Check-in failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Header "Check In" button — checks in the next pending arrival
  usePrimaryAction('checkin', () => {
    if (filtered.length) handleCheckIn(filtered[0])
    else toast('No pending arrivals to check in', 'error')
  })

  return (
    <PageWrapper
      actions={
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search arrivals" className="w-56" />
          <Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>
        </div>
      }
      stats={
        <>
          <StatCard icon="↗" tone="gold" label="Expected arrivals" value={stats.expected} />
          <StatCard icon="📅" tone="blue" label="Arriving today" value={stats.today} />
          <StatCard icon="🏨" tone="green" label="Currently in-house" value={stats.inHouse} />
          <StatCard icon="₹" tone="amber" label="Collectable on arrival" value={formatCurrency(stats.pendingDues)} />
        </>
      }
    >
      {error && (
        <Card><div className="px-5 py-3 text-sm text-danger-text">{error}</div></Card>
      )}

      {!error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="↗"
            title={loading ? 'Loading…' : query ? 'No matching arrivals' : 'No pending arrivals'}
            message={loading ? 'Fetching expected arrivals.' : query ? 'Try a different search.' : 'Everyone expected has already checked in.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <ArrivalCard key={b.id} booking={b} isToday={isToday(b.fromDate)} busy={busyId === b.id} onCheckIn={handleCheckIn} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
