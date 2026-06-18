import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, DataTable, SearchInput, Button, EmptyState } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import CancelModal from './CancelModal'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { normalizeBooking } from '../../../utils/normalizeBooking'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel } from '../../../utils/booking'

export default function Cancellations() {
  const toast = useToast()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await bookingsApi.getAll()
      setBookings((data.bookings || []).map(normalizeBooking))
    } catch {
      setError('Could not load bookings. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cancelled = useMemo(() => bookings.filter((b) => b.status === 'Cancelled'), [bookings])
  const cancellable = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending' || b.status === 'CheckedIn'),
    [bookings],
  )

  // Header "Cancel Booking" button
  usePrimaryAction('cancellations', () => {
    if (cancellable.length) setShowCancel(true)
    else toast('No bookings are eligible to cancel', 'error')
  })

  const stats = useMemo(() => {
    const lostRevenue = cancelled.reduce((s, b) => s + (Number(b.amount) || 0), 0)
    const rate = bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0
    return { cancelled: cancelled.length, cancellable: cancellable.length, lostRevenue, rate }
  }, [cancelled, cancellable, bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cancelled
    return cancelled.filter((b) =>
      b.guestName?.toLowerCase().includes(q) ||
      b.bookingNo?.toLowerCase().includes(q) ||
      (b.cancelReason || '').toLowerCase().includes(q))
  }, [cancelled, query])

  const handleCancel = async ({ id, reason }) => {
    const b = bookings.find((x) => x.id === id)
    try {
      const { data } = await bookingsApi.cancel(id, { reason })
      setBookings((prev) => prev.map((x) => (x.id === id ? normalizeBooking(data.booking) : x)))
      toast(`Booking ${b?.bookingNo || ''} cancelled`, 'error')
      setShowCancel(false)
    } catch (err) {
      toast(err.response?.data?.message || 'Cancellation failed', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await bookingsApi.remove(deleteTarget.id)
      setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      toast(`Booking ${deleteTarget.bookingNo} deleted`)
      setDeleteTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || 'Could not delete booking', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'booking', header: 'Booking',
      render: (b) => (
        <div>
          <div className="font-medium text-ink">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
        </div>
      ),
    },
    { key: 'room', header: 'Room', render: (b) => `${b.roomNumber} · ${b.roomType}` },
    { key: 'stay', header: 'Planned stay', render: (b) => dateRangeLabel(b) },
    { key: 'reason', header: 'Reason', render: (b) => <span className="text-ink2">{b.cancelReason || '—'}</span> },
    {
      key: 'cancelledAt', header: 'Cancelled', align: 'right',
      render: (b) => (
        <div>
          <div className="text-ink">{formatDate(b.cancelledAt)}</div>
          <div className="text-xs text-ink3 mt-0.5">{formatCurrency(b.amount)} value</div>
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (b) => (
        <Button variant="danger" size="sm" title="Delete cancellation" onClick={() => setDeleteTarget(b)}>
          <LuTrash2 size={14} />
        </Button>
      ),
    },
  ]

  return (
    <PageWrapper
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>
          <Button variant="danger" icon="✕" onClick={() => setShowCancel(true)} disabled={!cancellable.length}>
            Cancel a Booking
          </Button>
        </div>
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
        {error && <div className="px-5 py-3 text-sm text-danger-text border-b border-line">{error}</div>}
        <DataTable
          columns={columns}
          rows={filtered}
          empty={
            <EmptyState
              icon="✓"
              title={loading ? 'Loading…' : query ? 'No matching cancellations' : 'No cancellations'}
              message={loading ? 'Fetching bookings.' : query ? 'Try a different search.' : 'Cancelled bookings will appear here.'}
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Cancellation"
        message={deleteTarget ? <>Permanently delete the cancelled booking <b>{deleteTarget.bookingNo}</b> for <b>{deleteTarget.guestName}</b>? It will be removed from this list. This cannot be undone.</> : null}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />
    </PageWrapper>
  )
}
