import { useCallback, useEffect, useState } from 'react'
import { LuTable2, LuLayoutGrid } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button, Pagination, ViewToggle } from '../../ui-tw'
import BookingsTable from './BookingsTable'
import BookingForm from './BookingForm'
import CancelModal from '../cancellations/CancelModal'
import CheckOutModal from '../checkout/CheckOutModal'
import ExtendStayModal from './ExtendStayModal'
import EditBookingModal from './EditBookingModal'
import InvoiceModal from './InvoiceModal'
import CollectRentModal from './CollectRentModal'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { stayLabel } from '../../../utils/booking'
import { bedLabel } from '../../../utils/beds'
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
const PAGE_SIZE = 8
const EMPTY_COUNTS = { all: 0, Upcoming: 0, Confirmed: 0, CheckedIn: 0, CheckedOut: 0, Cancelled: 0 }

const VIEWS = [
  { id: 'table', label: 'Table', icon: <LuTable2 size={14} /> },
  { id: 'cards', label: 'Cards', icon: <LuLayoutGrid size={14} /> },
]
// Remembered per browser — whichever layout someone works in, they land back in it.
const VIEW_KEY = 'bookings:view'
const storedView = () => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return VIEWS.some((x) => x.id === v) ? v : 'table'
  } catch { return 'table' }
}

// On a room clash PUT /bookings/:id returns the blocking record — name it so staff
// know who/what is in the way instead of a generic "unavailable".
function updateErrorMessage(err, fallback) {
  const data = err.response?.data
  const c = data?.conflict
  if (c?.type === 'booking') return `${c.bedNo ? `Bed ${bedLabel(c.bedNo)}` : 'Room'} already booked (${c.bookingNo}) from ${formatDate(c.fromDate)}. Pick other dates.`
  if (c?.type === 'guest') return `Room is occupied by ${c.name}. Pick other dates.`
  return data?.message || fallback
}

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
  const [rentTarget, setRentTarget] = useState(null)
  const [extendTarget, setExtendTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [invoiceTarget, setInvoiceTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [view, setView] = useState(storedView)

  const changeView = (next) => {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* private mode — the session default is fine */ }
  }

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

  // Deleting or filtering away the last row of the final page leaves us past the
  // end of the list — fall back to page 1 rather than showing an empty table.
  useEffect(() => {
    if (!loading && !error && !bookings.length && page > 1) setPage(1)
  }, [loading, error, bookings.length, page])

  // Follow a deep-link tab if the panel was opened with one (e.g. from Today).
  useEffect(() => {
    if (TAB_IDS.includes(navTab)) { setTab(navTab); setPage(1) }
  }, [navTab])

  // Open the New Booking form when the header's contextual button fires
  usePrimaryAction('bookings', () => setShowNew(true))

  const handleTabChange = (next) => { setTab(next); setPage(1) }


  // ── Actions ──
  const handleCreated = (booking) => {
    if (booking.group) {
      // PG: one booking per bed, created together.
      const n = booking.bookings.length
      toast(n === 1
        ? `Booking ${booking.bookings[0].bookingNo} created for ${booking.bookings[0].guestName}`
        : `${n} bed bookings created in Room ${booking.roomNumber}`)
    } else {
      toast(`Booking ${booking.bookingNo} created for ${booking.guestName}`)
    }
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
  const handleCheckOut = async ({ extra, finalPayment, paymentMethod, paymentReference, proofFile, photoFile }) => {
    const b = checkOutTarget
    if (!b) return
    const id = b.id
    setBusyId(id)
    try {
      // Attach the payment screenshot and check-out photo first so a failed
      // upload aborts the check-out (labels stay aligned with the file order).
      const attachments = []
      if (proofFile) attachments.push(['payment_proof', proofFile])
      if (photoFile) attachments.push(['checkout_photo', photoFile])
      if (attachments.length) {
        const form = new FormData()
        attachments.forEach(([, file]) => form.append('documents', file))
        form.append('docTypes', JSON.stringify(attachments.map(([label]) => label)))
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
      toast(updateErrorMessage(err, 'Could not extend the stay'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Correct a booking that was entered wrong. Same PUT as an extension, so a date
  // change is re-checked against the room's other bookings by the server.
  const handleEdit = async (payload) => {
    const b = editTarget
    if (!b) return
    setBusyId(b.id)
    try {
      await bookingsApi.update(b.id, payload)
      toast(`Booking ${b.bookingNo} updated`)
      setEditTarget(null)
      reload()
    } catch (err) {
      toast(updateErrorMessage(err, 'Could not save the changes'), 'error')
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
          // The form's summary rail is sticky, which an overflow-hidden ancestor breaks.
          clip={false}
          title="New Booking"
          subtitle="Reserve a room and capture guest details"
          actions={
            <Button variant="ghost" onClick={() => setShowNew(false)}>✕ Close</Button>
          }
        >
          <BookingForm onSaved={handleCreated} onCancel={() => setShowNew(false)} />
        </Card>
      ) : (
        <Card>
          {/* One toolbar line: status tabs on the left, search + refresh on the
              right. The tabs already name the view, so a separate "All Bookings"
              title row would only cost a line. If the two halves stop fitting the
              search group wraps to its own line — the tab strip is never clipped,
              and on a phone it scrolls sideways instead of stacking three rows. */}
          <div className="flex flex-wrap items-center justify-between gap-2.5
                          px-4 sm:px-5 py-3 border-b border-line">
            <div className="max-w-full shrink-0 -mx-1 px-1 overflow-x-auto
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterTabs wrap={false} tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
                          active={tab} onChange={handleTabChange} />
            </div>
            <div className="flex items-center gap-2 ml-auto grow sm:grow-0">
              <SearchInput value={query} onChange={setQuery} placeholder="Search name, no. or room"
                           className="grow sm:grow-0 sm:w-44 xl:w-52" />
              <ViewToggle options={VIEWS} value={view} onChange={changeView} />
              {/* Icon-only: with the tabs, search and view switch sharing this
                  one line, a "Refresh" label is what tips it onto a second row. */}
              <Button variant="ghost" onClick={reload} disabled={loading}
                      title="Refresh" aria-label="Refresh bookings" className="px-2.5">↻</Button>
            </div>
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
            onRent={setRentTarget}
            onInvoice={setInvoiceTarget}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            view={view}
            emptyMessage={debouncedQuery ? 'No bookings match your search.' : 'Create a booking to get started.'}
          />

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} disabled={loading}
                      onChange={setPage} />
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
          room={`${checkOutTarget.roomNumber}${checkOutTarget.bed ? ` · Bed ${checkOutTarget.bed}` : ''} · ${checkOutTarget.roomType}`}
          stayPeriod={`${formatDate(checkOutTarget.checkedInAt || checkOutTarget.fromDate)} · ${stayLabel(checkOutTarget)}`}
          lineItems={[[checkOutTarget.tenancy ? 'Rent billed so far' : 'Total amount', checkOutTarget.amount]]}
          advance={checkOutTarget.advance}
          balanceDue={checkOutTarget.balanceDue}
          allowExtraCharges
          allowPartialPayment
          footnote={`Confirming releases ${checkOutTarget.bed ? `Bed ${checkOutTarget.bed} of ` : ''}Room ${checkOutTarget.roomNumber} and moves the guest to checked-out history.${
            // A PG deposit is held, not billed — remind the desk to settle it.
            checkOutTarget.securityDeposit > 0 ? ` Security deposit of ${formatCurrency(checkOutTarget.securityDeposit)} is held — refund it, less any dues.` : ''}`}
          submitting={busyId === checkOutTarget.id}
          onClose={() => setCheckOutTarget(null)}
          onConfirm={handleCheckOut}
        />
      )}
      {editTarget && (
        <EditBookingModal
          isOpen
          booking={editTarget}
          submitting={busyId === editTarget.id}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
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
      {rentTarget && (
        <CollectRentModal
          booking={rentTarget}
          onClose={() => setRentTarget(null)}
          onCollected={(_, amount) => {
            toast(`${formatCurrency(amount)} rent collected from ${rentTarget.guestName.split(',')[0]}`)
            setRentTarget(null)
            reload()
          }}
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
