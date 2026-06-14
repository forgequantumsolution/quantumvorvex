import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button } from '../../ui-tw'
import BookingsTable from './BookingsTable'
import BookingForm from './BookingForm'
import CancelModal from '../cancellations/CancelModal'
import CheckOutModal from '../checkout/CheckOutModal'
import InvoiceModal from './InvoiceModal'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { isUpcoming } from '../../../utils/booking'
import { normalizeBooking as normalize } from '../../../utils/normalizeBooking'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Confirmed', label: 'Confirmed' },
  { id: 'CheckedIn', label: 'Checked In' },
  { id: 'CheckedOut', label: 'Checked Out' },
  { id: 'Cancelled', label: 'Cancelled' },
]
const TAB_IDS = TABS.map((t) => t.id)

export default function Bookings() {
  const toast = useToast()

  // Today (and other panels) can deep-link to a specific status tab via navigateTo.
  const navTab = useAppSelector((s) => s.ui.activePanelParams?.tab)

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(() => (TAB_IDS.includes(navTab) ? navTab : 'all'))
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [checkOutTarget, setCheckOutTarget] = useState(null)
  const [invoiceTarget, setInvoiceTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await bookingsApi.getAll()
      setBookings((data.bookings || []).map(normalize))
    } catch {
      setError('Could not load bookings. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Follow a deep-link tab if the panel was opened with one (e.g. from Today).
  useEffect(() => {
    if (TAB_IDS.includes(navTab)) setTab(navTab)
  }, [navTab])

  // Open the New Booking form when the header's contextual button fires
  usePrimaryAction('bookings', () => setShowNew(true))

  // Stats
  const stats = useMemo(() => {
    const active = bookings.filter((b) => !['Cancelled', 'CheckedOut', 'NoShow'].includes(b.status))
    return {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
      checkedIn: bookings.filter((b) => b.status === 'CheckedIn').length,
      revenue: active.reduce((s, b) => s + (Number(b.amount) || 0), 0),
      dues: active.reduce((s, b) => s + (Number(b.balanceDue) || 0), 0),
    }
  }, [bookings])

  const counts = useMemo(() => ({
    all: bookings.length,
    Upcoming: bookings.filter(isUpcoming).length,
    Confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
    CheckedIn: bookings.filter((b) => b.status === 'CheckedIn').length,
    CheckedOut: bookings.filter((b) => b.status === 'CheckedOut').length,
    Cancelled: bookings.filter((b) => b.status === 'Cancelled').length,
  }), [bookings])

  const filtered = useMemo(() => {
    let list = bookings
    if (tab === 'Upcoming') list = list.filter(isUpcoming)
    else if (tab !== 'all') list = list.filter((b) => b.status === tab)

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((b) =>
        b.guestName?.toLowerCase().includes(q) ||
        b.bookingNo?.toLowerCase().includes(q) ||
        String(b.roomNumber || '').includes(q))
    }
    return list
  }, [bookings, tab, query])

  // ── Actions ──
  const handleCreated = (booking) => {
    setBookings((prev) => [normalize(booking), ...prev])
    toast(`Booking ${booking.bookingNo} created for ${booking.guestName}`)
    setShowNew(false)
  }

  const runAction = async (id, fn, successMsg, tone) => {
    setBusyId(id)
    try {
      const { data } = await fn()
      setBookings((prev) => prev.map((b) => (b.id === id ? normalize(data.booking) : b)))
      toast(successMsg, tone)
    } catch (err) {
      toast(err.response?.data?.message || 'Action failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCheckIn  = (b) => runAction(b.id, () => bookingsApi.checkIn(b.id), `${b.guestName} checked in`)
  const handleConfirm  = (b) => runAction(b.id, () => bookingsApi.confirm(b.id), `Booking ${b.bookingNo} confirmed`)

  // Settle the bill + (optional) payment proof, then check out — via the modal.
  const handleCheckOut = async ({ id, finalPayment, extraCharges, paymentMethod, paymentReference, proofFile }) => {
    const b = bookings.find((x) => x.id === id)
    setBusyId(id)
    try {
      // Attach the payment screenshot first so a failed upload aborts the check-out.
      if (proofFile) {
        const form = new FormData()
        form.append('documents', proofFile)
        form.append('docTypes', JSON.stringify(['payment_proof']))
        await bookingsApi.uploadDocuments(id, form)
      }
      const { data } = await bookingsApi.checkOut(id, { finalPayment, extraCharges, paymentMethod, paymentReference })
      setBookings((prev) => prev.map((x) => (x.id === id ? normalize(data.booking) : x)))
      toast(`${b?.guestName || 'Guest'} checked out`)
      setCheckOutTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    await runAction(id, () => bookingsApi.cancel(id, { reason }), `Booking ${b?.bookingNo || ''} cancelled`, 'error')
    setCancelTarget(null)
  }

  return (
    <PageWrapper
      stats={
        <>
          <StatCard icon="◷" tone="gold" label="Total bookings" value={stats.total} />
          <StatCard icon="✓" tone="blue" label="Confirmed" value={stats.confirmed} hint={`${stats.checkedIn} checked in`} />
          <StatCard icon="₹" tone="green" label="Active value" value={formatCurrency(stats.revenue)} />
          <StatCard icon="!" tone="amber" label="Outstanding dues" value={formatCurrency(stats.dues)} />
        </>
      }
    >
      {showNew ? (
        <Card
          title="New Booking"
          subtitle="Reserve a room and capture guest details"
          actions={
            <Button variant="ghost" onClick={() => setShowNew(false)}>✕ Close</Button>
          }
        >
          <BookingForm onSaved={handleCreated} onCancel={() => setShowNew(false)} />
        </Card>
      ) : (
        <Card
          title="All Bookings"
          actions={
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} placeholder="Search name, no. or room" className="w-56" />
              <Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>
            </div>
          }
        >
          <div className="px-5 py-3 border-b border-line">
            <FilterTabs tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))} active={tab} onChange={setTab} />
          </div>

          {error && (
            <div className="px-5 py-3 text-sm text-danger-text bg-danger-bg border-b border-line">{error}</div>
          )}

          <BookingsTable
            bookings={filtered}
            loading={loading}
            busyId={busyId}
            onCheckIn={handleCheckIn}
            onCheckOut={setCheckOutTarget}
            onConfirm={handleConfirm}
            onCancel={setCancelTarget}
            onInvoice={setInvoiceTarget}
            emptyMessage={query ? 'No bookings match your search.' : 'Create a booking to get started.'}
          />
        </Card>
      )}
      <CancelModal
        isOpen={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
      />
      <CheckOutModal
        isOpen={!!checkOutTarget}
        booking={checkOutTarget}
        submitting={busyId === checkOutTarget?.id}
        onClose={() => setCheckOutTarget(null)}
        onConfirm={handleCheckOut}
      />
      <InvoiceModal
        isOpen={!!invoiceTarget}
        booking={invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
      />
    </PageWrapper>
  )
}
