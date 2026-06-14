import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, DataTable, StatusBadge, SearchInput, Button, EmptyState } from '../../ui-tw'
import CheckOutModal from './CheckOutModal'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { normalizeBooking } from '../../../utils/normalizeBooking'
import { formatCurrency, formatDate } from '../../../utils/format'
import { stayLabel } from '../../../utils/booking'

export default function CheckOut() {
  const toast = useToast()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await bookingsApi.getAll({ status: 'CheckedIn' })
      setBookings((data.bookings || []).map(normalizeBooking))
    } catch {
      setError('Could not load in-house guests. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    inHouse: bookings.length,
    dueAmount: bookings.reduce((s, b) => s + (Number(b.balanceDue) || 0), 0),
    withBalance: bookings.filter((b) => Number(b.balanceDue) > 0).length,
    settled: bookings.filter((b) => Number(b.balanceDue) <= 0).length,
  }), [bookings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bookings
    return bookings.filter((b) =>
      b.guestName?.toLowerCase().includes(q) ||
      b.bookingNo?.toLowerCase().includes(q) ||
      String(b.roomNumber || '').includes(q))
  }, [bookings, query])

  // Header "Check Out" button — opens checkout for the next in-house guest
  usePrimaryAction('checkout', () => {
    if (filtered.length) setTarget(filtered[0])
    else toast('No in-house guests to check out', 'error')
  })

  const handleCheckOut = async ({ id, finalPayment, extraCharges, paymentMethod, paymentReference, proofFile }) => {
    setSubmitting(true)
    const b = bookings.find((x) => x.id === id)
    try {
      // Attach the payment screenshot first (while the booking is still in-house),
      // so a failed upload aborts the check-out instead of orphaning the proof.
      if (proofFile) {
        const form = new FormData()
        form.append('documents', proofFile)
        form.append('docTypes', JSON.stringify(['payment_proof']))
        await bookingsApi.uploadDocuments(id, form)
      }
      await bookingsApi.checkOut(id, { finalPayment, extraCharges, paymentMethod, paymentReference })
      setBookings((prev) => prev.filter((x) => x.id !== id))   // leaves the in-house list
      toast(`${b?.guestName || 'Guest'} checked out from Room ${b?.roomNumber}`)
      setTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'guest', header: 'Guest',
      render: (b) => (
        <div>
          <div className="font-medium text-ink">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
        </div>
      ),
    },
    { key: 'room', header: 'Room', render: (b) => `${b.roomNumber} · ${b.roomType}` },
    {
      key: 'stay', header: 'Stay',
      render: (b) => (
        <div>
          <div className="text-ink">{stayLabel(b)}</div>
          <div className="text-xs text-ink3 mt-0.5">In: {formatDate(b.checkedInAt || b.fromDate)}</div>
        </div>
      ),
    },
    {
      key: 'balance', header: 'Balance', align: 'right',
      render: (b) =>
        Number(b.balanceDue) > 0
          ? <span className="text-danger-text font-semibold">{formatCurrency(b.balanceDue)}</span>
          : <StatusBadge status="Resolved" label="Settled" dot={false} />,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (b) => (
        <Button variant="success" size="sm" icon="✓" onClick={() => setTarget(b)}>Check Out</Button>
      ),
    },
  ]

  return (
    <PageWrapper
      actions={
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search in-house" className="w-56" />
          <Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>
        </div>
      }
      stats={
        <>
          <StatCard icon="🏨" tone="gold" label="In-house guests" value={stats.inHouse} />
          <StatCard icon="!" tone="amber" label="With balance due" value={stats.withBalance} />
          <StatCard icon="₹" tone="red" label="Total collectable" value={formatCurrency(stats.dueAmount)} />
          <StatCard icon="✓" tone="green" label="Fully settled" value={stats.settled} />
        </>
      }
    >
      <Card title="In-House Guests">
        {error && <div className="px-5 py-3 text-sm text-danger-text border-b border-line">{error}</div>}
        <DataTable
          columns={columns}
          rows={filtered}
          empty={
            <EmptyState
              icon="↘"
              title={loading ? 'Loading…' : query ? 'No matching guests' : 'No guests in-house'}
              message={loading ? 'Fetching in-house guests.' : query ? 'Try a different search.' : 'Check in a guest to see them here.'}
            />
          }
        />
      </Card>

      <CheckOutModal
        isOpen={!!target}
        booking={target}
        submitting={submitting}
        onClose={() => setTarget(null)}
        onConfirm={handleCheckOut}
      />
    </PageWrapper>
  )
}
