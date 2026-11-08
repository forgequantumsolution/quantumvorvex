import { useCallback, useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { LuTable2, LuLayoutGrid, LuCalendarDays, LuCalendarCheck, LuBedDouble, LuCircleAlert, LuPlus, LuRefreshCw, LuX } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, FilterTabs, Pagination, WhatsAppOffer, useWhatsAppComposer } from '../../ui-tw'
import BookingsTable from './BookingsTable'
import BookingForm from './BookingForm'
import CancelModal from '../cancellations/CancelModal'
import CheckOutModal from '../checkout/CheckOutModal'
import ExtendStayModal from './ExtendStayModal'
import EditBookingModal from './EditBookingModal'
import InvoiceModal from './InvoiceModal'
import CollectRentModal from './CollectRentModal'
import RefundModal from './RefundModal'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector, usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { splitNames, stayLabel } from '../../../utils/booking'
import { useBreakpoint, useMinWidth } from '../../../hooks/useMediaQuery'
import { bedLabel } from '../../../utils/beds'
import { normalizeBooking as normalize } from '../../../utils/normalizeBooking'

// Labels come from bookings:tabs.<id> at render time.
const TAB_IDS = ['all', 'Upcoming', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'Dues']
const PAGE_SIZE = 8
const EMPTY_COUNTS = { all: 0, Upcoming: 0, Confirmed: 0, CheckedIn: 0, CheckedOut: 0, Cancelled: 0, Dues: 0 }

const VIEWS = [
  { id: 'table', labelKey: 'page.tableView', icon: <LuTable2 /> },
  { id: 'cards', labelKey: 'page.cardView', icon: <LuLayoutGrid /> },
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
function updateErrorMessage(t, err, fallback) {
  const data = err.response?.data
  const c = data?.conflict
  if (c?.type === 'booking') {
    const vars = { no: c.bookingNo, date: formatDate(c.fromDate) }
    return c.bedNo ? t('conflict.bedBooked', { ...vars, bed: bedLabel(c.bedNo) }) : t('conflict.roomBooked', vars)
  }
  if (c?.type === 'guest') return t('conflict.guest', { name: c.name })
  return data?.message || fallback
}

// The composer request for a WhatsApp message about booking `b` (normalized).
// A tenancy links its rent month (billing invoice): the oldest unpaid month when
// asking for money, else the latest. A day booking links its own tax invoice.
function bookingMessage(b, template) {
  // A confirmation with money still owed also carries the pay link.
  const wantsLink = ['payment', 'invoice', 'thanks'].includes(template) || (template === 'confirmation' && Number(b.balanceDue) > 0)
  const invoiceLink = !b.tenancy && wantsLink
    && ['Confirmed', 'CheckedIn', 'CheckedOut'].includes(b.status)
    ? () => bookingsApi.shareLink(b.id).then(({ data }) => data.url)
    : undefined
  const invoiceId = b.tenancy && wantsLink
    ? async () => {
      const { data } = await bookingsApi.rentAccount(b.id)
      const list = data.invoices || []
      const unpaid = list.find((i) => i.status !== 'Paid')
      return (['payment', 'confirmation'].includes(template) && unpaid ? unpaid : list[list.length - 1])?.id || null
    }
    : undefined
  return {
    phone: b.guestPhone,
    guestId: b.guestId || b.guest?.id,
    name: `${b.guestName} · ${b.bookingNo}`,
    template,
    invoiceId,
    invoiceLink,
    vars: {
      name: splitNames(b.guestName)[0] || b.guestName,
      bookingNo: b.bookingNo,
      room: `${b.roomNumber || ''}${b.bed ? ` (${b.bed})` : ''}`,
      fromDate: b.fromDate,
      toDate: b.tenancy ? null : b.toDate,
      nights: b.stayType === 'monthly' ? 0 : b.nights,
      months: b.tenancy ? 0 : b.stayType === 'monthly' ? b.months : 0,
      tenancy: b.tenancy,
      amount: b.tenancy ? b.roomRate : b.amount,
      paid: b.advance,
      due: b.balanceDue,
    },
  }
}

export default function Bookings() {
  const { t } = useTranslation('bookings')
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
  const [refundTarget, setRefundTarget] = useState(null)
  const [extendTarget, setExtendTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [invoiceTarget, setInvoiceTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  // WhatsApp: the composer, and a follow-up offered after a create / check-out.
  const wa = useWhatsAppComposer()
  const [waOffer, setWaOffer] = useState(null) // { message, actionLabel, booking, template }
  const openWhatsApp = (b, template) => wa.open(bookingMessage(b, template))
  const [view, setView] = useState(storedView)
  // On a phone the four stat tiles fill the first screen — while the New
  // Booking form is open they only push it down, so they step aside.
  const { isPhone } = useBreakpoint()
  // The table only renders from 2xl (see BookingsTable), so the view switch does too.
  const canTable = useMinWidth('2xl')

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
      setError(t('page.loadError'))
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, tab, page, t])

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
        ? t('toast.created', { no: booking.bookings[0].bookingNo, name: booking.bookings[0].guestName })
        : t('toast.groupCreated', { count: n, room: booking.roomNumber }))
      const first = normalize(booking.bookings[0])
      if (first) setWaOffer({
        message: n === 1 ? t('whatsapp:offer.created', { no: first.bookingNo, name: first.guestName }) : t('whatsapp:offer.createdGroup', { count: n, room: booking.roomNumber }),
        actionLabel: t('whatsapp:offer.sendConfirmation'), booking: first, template: 'confirmation',
      })
    } else {
      toast(t('toast.created', { no: booking.bookingNo, name: booking.guestName }))
      const nb = normalize(booking)
      setWaOffer({ message: t('whatsapp:offer.created', { no: nb.bookingNo, name: nb.guestName }), actionLabel: t('whatsapp:offer.sendConfirmation'), booking: nb, template: 'confirmation' })
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
      toast(err.response?.data?.message || t('toast.actionFailed'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCheckIn  = (b) => runAction(b.id, () => bookingsApi.checkIn(b.id), t('toast.checkedIn', { name: b.guestName }))
  const handleConfirm  = (b) => runAction(b.id, () => bookingsApi.confirm(b.id), t('toast.confirmed', { no: b.bookingNo }))

  // A tenancy's rent is cut to the days stayed at move-out, so show that bill.
  const openCheckOut = async (b) => {
    if (!b.tenancy) { setCheckOutTarget(b); return }
    setBusyId(b.id)
    try {
      const { data } = await bookingsApi.rentAccount(b.id)
      setCheckOutTarget({ ...b, amount: data.moveOut.amount, balanceDue: data.moveOut.due, rentCredit: data.moveOut.credit })
    } catch (err) {
      toast(err.response?.data?.message || t('toast.rentAccountError'), 'error')
    } finally {
      setBusyId(null)
    }
  }

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
      const { data } = await bookingsApi.checkOut(id, { finalPayment, extraCharges, paymentMethod, paymentReference })
      toast(t('toast.checkedOut', { name: b.guestName || t('common:guest') }))
      setCheckOutTarget(null)
      // Money to hand back: go straight to the refund (it can also wait).
      const left = normalize(data.booking)
      if (left?.refundable > 0) setRefundTarget(left)
      // Offer the invoice & thank-you message on WhatsApp.
      const gone = left || b
      setWaOffer({ message: t('whatsapp:offer.checkedOut', { name: gone.guestName || t('common:guest') }), actionLabel: t('whatsapp:offer.sendThanks'), booking: { ...b, ...gone, roomNumber: gone.roomNumber || b.roomNumber }, template: 'thanks' })
      reload()
    } catch (err) {
      toast(err.response?.data?.message || t('toast.checkOutFailed'), 'error')
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
      toast(t('toast.extended', { name: b.guestName }))
      setExtendTarget(null)
      reload()
    } catch (err) {
      toast(updateErrorMessage(t, err, t('toast.extendFailed')), 'error')
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
      toast(t('toast.updated', { no: b.bookingNo }))
      setEditTarget(null)
      reload()
    } catch (err) {
      toast(updateErrorMessage(t, err, t('toast.saveFailed')), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    await runAction(id, () => bookingsApi.cancel(id, { reason }), t('toast.cancelled', { no: b?.bookingNo || '' }), 'error')
    setCancelTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await runAction(deleteTarget.id, () => bookingsApi.remove(deleteTarget.id), t('toast.deleted', { no: deleteTarget.bookingNo }), 'error')
    setDeleteTarget(null)
  }

  return (
    <PageWrapper
      title={showNew ? t('page.newTitle') : t('page.title')}
      subtitle={showNew ? t('page.newSubtitle') : t('page.subtitle')}
      search={showNew ? null : { value: query, onChange: setQuery, placeholder: t('page.searchPlaceholder') }}
      headerActions={showNew ? [
        { id: 'close', label: t('common:close'), icon: <LuX />, onClick: () => setShowNew(false) },
      ] : [
        ...(canTable ? VIEWS.map((v) => ({ id: v.id, label: t(v.labelKey), icon: v.icon, variant: 'icon', active: view === v.id, onClick: () => changeView(v.id) })) : []),
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: reload },
        { id: 'new', label: t('page.newBooking'), icon: <LuPlus />, variant: 'primary', onClick: () => setShowNew(true) },
      ]}
      stats={showNew && isPhone ? null : (
        <>
          {/* Each card filters the list below to the bookings it counts. */}
          {[
            { tab: 'all', icon: <LuCalendarDays />, tone: 'gold', label: t('stats.total'), value: stats.total, hint: t('stats.upcomingHint', { count: stats.upcoming ?? 0 }) },
            { tab: 'Confirmed', icon: <LuCalendarCheck />, tone: 'blue', label: t('stats.confirmed'), value: stats.confirmed, hint: t('stats.pendingHint', { count: stats.pending ?? 0 }) },
            { tab: 'CheckedIn', icon: <LuBedDouble />, tone: 'green', label: t('stats.inHouse'), value: stats.checkedIn, hint: t('stats.activeValueHint', { amount: formatCurrency(stats.revenue) }) },
            { tab: 'Dues', icon: <LuCircleAlert />, tone: 'amber', label: t('stats.dues'), value: formatCurrency(stats.dues), hint: t('stats.duesHint', { count: stats.withDues ?? 0 }) },
          ].map((k) => (
            <StatCard key={k.tab} {...k} selected={tab === k.tab} onClick={() => { handleTabChange(k.tab); setShowNew(false) }} />
          ))}
        </>
      )}
    >
      {waOffer && !showNew && (
        <WhatsAppOffer
          message={waOffer.message}
          actionLabel={waOffer.actionLabel}
          phone={waOffer.booking.guestPhone}
          onSend={() => { openWhatsApp(waOffer.booking, waOffer.template); setWaOffer(null) }}
          onDismiss={() => setWaOffer(null)}
        />
      )}
      {showNew ? (
        <Card
          // The form's summary rail is sticky, which an overflow-hidden ancestor breaks.
          clip={false}
        >
          <BookingForm onSaved={handleCreated} onCancel={() => setShowNew(false)} />
        </Card>
      ) : (
        <Card>
          {/* Status tabs. Search, refresh, the view switch and New booking live in
              the page header bar. The tab strip scrolls sideways on its own. */}
          <div className="px-3 sm:px-5 py-3 border-b border-line min-w-0">
            <FilterTabs wrap={false} tabs={TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`), count: counts[id] }))}
                        active={tab} onChange={handleTabChange} />
          </div>

          {error && (
            <div className="px-4 sm:px-5 py-3 text-sm text-danger-text bg-danger-bg border-b border-line">{error}</div>
          )}

          <BookingsTable
            bookings={bookings}
            loading={loading}
            busyId={busyId}
            onCheckIn={handleCheckIn}
            onCheckOut={openCheckOut}
            onConfirm={handleConfirm}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onRent={setRentTarget}
            onRefund={setRefundTarget}
            onInvoice={setInvoiceTarget}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            onWhatsApp={openWhatsApp}
            view={view}
            emptyMessage={debouncedQuery ? t('page.emptySearch') : t('page.emptyStart')}
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
          room={`${checkOutTarget.roomNumber}${checkOutTarget.bed ? ` · ${t('bedN', { bed: checkOutTarget.bed })}` : ''} · ${checkOutTarget.roomType}`}
          stayPeriod={`${formatDate(checkOutTarget.checkedInAt || checkOutTarget.fromDate)} · ${stayLabel(checkOutTarget)}`}
          lineItems={[[checkOutTarget.tenancy ? t('checkOut.rentToToday') : t('checkOut.totalAmount'), checkOutTarget.amount]]}
          advance={checkOutTarget.advance}
          balanceDue={checkOutTarget.balanceDue}
          defaultPayment={Math.max(0, checkOutTarget.balanceDue - (checkOutTarget.securityDeposit || 0))}
          allowExtraCharges
          allowPartialPayment
          footnote={[
            checkOutTarget.bed
              ? t('checkOut.releasesBed', { bed: checkOutTarget.bed, room: checkOutTarget.roomNumber })
              : t('checkOut.releasesRoom', { room: checkOutTarget.roomNumber }),
            // A PG deposit is held, not billed — remind the desk to settle it.
            checkOutTarget.securityDeposit > 0 && t('checkOut.depositHeld', { amount: formatCurrency(checkOutTarget.securityDeposit) }),
            checkOutTarget.rentCredit > 0 && t('checkOut.creditRefund', { amount: formatCurrency(checkOutTarget.rentCredit) }),
          ].filter(Boolean).join(' ')}
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
      {refundTarget && (
        <RefundModal
          booking={refundTarget}
          onClose={() => { setRefundTarget(null); reload() }}
          onRefunded={(amount) => {
            toast(amount > 0 ? t('toast.refundRecorded', { amount: formatCurrency(amount), name: refundTarget.guestName.split(',')[0] }) : t('toast.deductionSaved'))
            setRefundTarget(null)
            reload()
          }}
        />
      )}
      {rentTarget && (
        <CollectRentModal
          booking={rentTarget}
          onClose={() => setRentTarget(null)}
          onCollected={(_, amount) => {
            toast(t('toast.rentCollected', { amount: formatCurrency(amount), name: rentTarget.guestName.split(',')[0] }))
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
        title={t('delete.title')}
        message={deleteTarget ? (
          <Trans t={t} i18nKey="delete.message" values={{ no: deleteTarget.bookingNo, name: deleteTarget.guestName }}
                 components={{ b: <b /> }} />
        ) : null}
        confirmLabel={t('common:delete')}
        cancelLabel={t('common:cancel')}
        danger
        busy={busyId === deleteTarget?.id}
      />
      {wa.composer}
    </PageWrapper>
  )
}
