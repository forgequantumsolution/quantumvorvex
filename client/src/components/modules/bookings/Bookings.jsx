import { useCallback, useEffect, useState } from 'react'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button } from '../../ui-tw'
import BookingsTable from './BookingsTable'
import BookingForm from './BookingForm'
import CancelModal from '../cancellations/CancelModal'
import CheckOutModal from '../checkout/CheckOutModal'
import ExtendStayModal from './ExtendStayModal'
import InvoiceModal from './InvoiceModal'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { stayLabel } from '../../../utils/booking'
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
const PAGE_SIZE = 20
const EMPTY_COUNTS = { all: 0, Upcoming: 0, Confirmed: 0, CheckedIn: 0, CheckedOut: 0, Cancelled: 0 }

export default function Bookings() {
  const toast = useToast()

  // Today (and other panels) can deep-link to a specific status tab via navigateTo.
  const navTab = useAppSelector((s) => s.ui.activePanelParams?.tab)

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(() => (TAB_IDS.includes(navTab) ? navTab : 'all'))
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  // Full-dataset aggregates served by /bookings/stats — independent of the
  // current search/tab/page so the stat cards and tab counts always show totals.
  const [stats, setStats] = useState({ total: 0, confirmed: 0, checkedIn: 0, revenue: 0, dues: 0 })
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [showNew, setShowNew] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [checkOutTarget, setCheckOutTarget] = useState(null)
  const [extendTarget, setExtendTarget] = useState(null)
  const [invoiceTarget, setInvoiceTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Debounce the search box so we hit the API at most once per pause in typing.
  // A new query always resets back to the first page.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  // The list is now server-driven: search (q), tab (status) and pagination all
  // run on the backend, so we only ever hold one page in memory.
  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await bookingsApi.getAll({
        q: debouncedQuery || undefined,
        status: tab,
        page,
        pageSize: PAGE_SIZE,
      })
      setBookings((data.bookings || []).map(normalize))
      setTotal(data.total ?? 0)
    } catch {
      setError('Could not load bookings. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, tab, page])

  const loadStats = useCallback(async () => {
    try {
      const { data } = await bookingsApi.getStats()
      if (data.stats) setStats(data.stats)
      setCounts({ ...EMPTY_COUNTS, ...(data.counts || {}) })
    } catch {
      /* stats are non-critical; the list error banner already covers outages */
    }
  }, [])

  // Re-fetch the visible page whenever search / tab / page changes.
  useEffect(() => { loadList() }, [loadList])
  // Aggregates only need refreshing on mount and after mutations.
  useEffect(() => { loadStats() }, [loadStats])

  // After any action that can change a booking's status/amounts, both the list
  // and the aggregates may shift — reload both rather than patching in place.
  const reload = useCallback(() => { loadList(); loadStats() }, [loadList, loadStats])

  // Follow a deep-link tab if the panel was opened with one (e.g. from Today).
  useEffect(() => {
    if (TAB_IDS.includes(navTab)) { setTab(navTab); setPage(1) }
  }, [navTab])

  // Open the New Booking form when the header's contextual button fires
  usePrimaryAction('bookings', () => setShowNew(true))

  const handleTabChange = (next) => { setTab(next); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Actions ──
  const handleCreated = (booking) => {
    toast(`Booking ${booking.bookingNo} created for ${booking.guestName}`)
    setShowNew(false)
    reload()
  }

  const runAction = async (id, fn, successMsg, tone) => {
    setBusyId(id)
    try {
      await fn()
      toast(successMsg, tone)
      reload()
    } catch (err) {
      toast(err.response?.data?.message || 'Action failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCheckIn  = (b) => runAction(b.id, () => bookingsApi.checkIn(b.id), `${b.guestName} checked in`)
  const handleConfirm  = (b) => runAction(b.id, () => bookingsApi.confirm(b.id), `Booking ${b.bookingNo} confirmed`)

  // Settle the bill + (optional) payment proof, then check out — via the modal.
  // The modal returns raw inputs; map `extra` onto the booking's existing charges.
  const handleCheckOut = async ({ extra, finalPayment, paymentMethod, paymentReference, proofFile }) => {
    const b = checkOutTarget
    if (!b) return
    const id = b.id
    setBusyId(id)
    try {
      // Attach the payment screenshot first so a failed upload aborts the check-out.
      if (proofFile) {
        const form = new FormData()
        form.append('documents', proofFile)
        form.append('docTypes', JSON.stringify(['payment_proof']))
        await bookingsApi.uploadDocuments(id, form)
      }
      const extraCharges = (Number(b.extraCharges) || 0) + (Number(extra) || 0)
      await bookingsApi.checkOut(id, { finalPayment, extraCharges, paymentMethod, paymentReference })
      toast(`${b.guestName || 'Guest'} checked out`)
      setCheckOutTarget(null)
      reload()
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Extend an active stay: PUT the new toDate/months — the server re-checks room
  // availability and recomputes the total + balance.
  const handleExtend = async (payload) => {
    const b = extendTarget
    if (!b) return
    setBusyId(b.id)
    try {
      await bookingsApi.update(b.id, payload)
      toast(`Stay extended for ${b.guestName}`)
      setExtendTarget(null)
      reload()
    } catch (err) {
      // On a room clash the API returns the blocking record — name it so staff know
      // who/what is in the way instead of a generic "unavailable".
      const data = err.response?.data
      const c = data?.conflict
      const msg =
        c?.type === 'booking'
          ? `Room already booked (${c.bookingNo}) from ${formatDate(c.fromDate)}. Pick an earlier date.`
          : c?.type === 'guest'
            ? `Room is occupied by ${c.name}. Pick an earlier date.`
            : data?.message || 'Could not extend the stay'
      toast(msg, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    await runAction(id, () => bookingsApi.cancel(id, { reason }), `Booking ${b?.bookingNo || ''} cancelled`, 'error')
    setCancelTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await runAction(deleteTarget.id, () => bookingsApi.remove(deleteTarget.id), `Booking ${deleteTarget.bookingNo} deleted`, 'error')
    setDeleteTarget(null)
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
              <Button variant="ghost" onClick={reload} disabled={loading}>↻ Refresh</Button>
            </div>
          }
        >
          <div className="px-5 py-3 border-b border-line">
            <FilterTabs tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))} active={tab} onChange={handleTabChange} />
          </div>

          {error && (
            <div className="px-5 py-3 text-sm text-danger-text bg-danger-bg border-b border-line">{error}</div>
          )}

          <BookingsTable
            bookings={bookings}
            loading={loading}
            busyId={busyId}
            onCheckIn={handleCheckIn}
            onCheckOut={setCheckOutTarget}
            onConfirm={handleConfirm}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onInvoice={setInvoiceTarget}
            onDelete={setDeleteTarget}
            emptyMessage={debouncedQuery ? 'No bookings match your search.' : 'Create a booking to get started.'}
          />

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-line text-sm text-muted">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Prev
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
      <CancelModal
        isOpen={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
      />
      {checkOutTarget && (
        <CheckOutModal
          isOpen
          guestName={checkOutTarget.guestName}
          folio={checkOutTarget.bookingNo}
          room={`${checkOutTarget.roomNumber} · ${checkOutTarget.roomType}`}
          stayPeriod={`${formatDate(checkOutTarget.checkedInAt || checkOutTarget.fromDate)} · ${stayLabel(checkOutTarget)}`}
          lineItems={[['Total amount', checkOutTarget.amount]]}
          advance={checkOutTarget.advance}
          balanceDue={checkOutTarget.balanceDue}
          allowExtraCharges
          allowPartialPayment
          footnote={`Confirming releases Room ${checkOutTarget.roomNumber} and moves the guest to checked-out history.`}
          submitting={busyId === checkOutTarget.id}
          onClose={() => setCheckOutTarget(null)}
          onConfirm={handleCheckOut}
        />
      )}
      {extendTarget && (
        <ExtendStayModal
          isOpen
          booking={extendTarget}
          submitting={busyId === extendTarget.id}
          onClose={() => setExtendTarget(null)}
          onConfirm={handleExtend}
        />
      )}
      <InvoiceModal
        isOpen={!!invoiceTarget}
        booking={invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Booking"
        message={deleteTarget ? <>Permanently delete booking <b>{deleteTarget.bookingNo}</b> for <b>{deleteTarget.guestName}</b>? This cannot be undone.</> : null}
        confirmLabel="Delete"
        danger
        busy={busyId === deleteTarget?.id}
      />
    </PageWrapper>
  )
}
