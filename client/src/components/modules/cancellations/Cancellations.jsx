import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { LuTrash2, LuBan, LuPercent, LuIndianRupee, LuClock, LuRefreshCw } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, DataTable, Button, EmptyState } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import CancelModal from './CancelModal'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { bookingsApi } from '../../../api/client'
import { normalizeBooking } from '../../../utils/normalizeBooking'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dateRangeLabel } from '../../../utils/booking'

export default function Cancellations() {
  const { t } = useTranslation('cancellations')
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
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const cancelled = useMemo(() => bookings.filter((b) => b.status === 'Cancelled'), [bookings])
  const cancellable = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending' || b.status === 'CheckedIn'),
    [bookings],
  )

  // Opens the cancel dialog: the header's primary button, and any other page
  // that triggers the 'cancellations' primary action remotely.
  const openCancel = () => {
    if (cancellable.length) setShowCancel(true)
    else toast(t('noneEligible'), 'error')
  }
  usePrimaryAction('cancellations', openCancel)

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
      toast(t('toast.cancelled', { no: b?.bookingNo || '' }), 'error')
      setShowCancel(false)
    } catch (err) {
      toast(err.response?.data?.message || t('toast.cancelFailed'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await bookingsApi.remove(deleteTarget.id)
      setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      toast(t('toast.deleted', { no: deleteTarget.bookingNo }))
      setDeleteTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || t('toast.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'booking', header: t('columns.booking'),
      render: (b) => (
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{b.guestName}</div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{b.bookingNo}</div>
        </div>
      ),
    },
    { key: 'room', header: t('common:room'), render: (b) => `${b.roomNumber} · ${b.roomType}` },
    { key: 'stay', header: t('columns.plannedStay'), render: (b) => dateRangeLabel(b) },
    { key: 'reason', header: t('columns.reason'), className: 'md:whitespace-normal md:min-w-[160px]', render: (b) => <span className="text-ink2">{b.cancelReason || '—'}</span> },
    {
      key: 'cancelledAt', header: t('columns.cancelled'), align: 'right', primary: true,
      render: (b) => (
        <div className="text-right">
          <div className="text-ink">{formatDate(b.cancelledAt)}</div>
          <div className="text-xs text-ink3 mt-0.5">{t('value', { amount: formatCurrency(b.amount) })}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (b) => (
        <Button variant="danger" size="sm" title={t('deleteOne')} aria-label={t('deleteOne')} onClick={() => setDeleteTarget(b)}>
          <LuTrash2 size={14} /><span className="lg:hidden">{t('common:delete')}</span>
        </Button>
      ),
    },
  ]

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={{ value: query, onChange: setQuery, placeholder: t('searchPlaceholder') }}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
        { id: 'cancel', label: t('cancelBooking'), icon: <LuBan />, variant: 'primary', disabled: !cancellable.length, onClick: openCancel },
      ]}
      stats={
        <>
          <StatCard icon={<LuBan />} tone="red" label={t('stats.cancelled')} value={stats.cancelled} />
          <StatCard icon={<LuPercent />} tone="amber" label={t('stats.rate')} value={`${stats.rate}%`} />
          <StatCard icon={<LuIndianRupee />} tone="grey" label={t('stats.lost')} value={formatCurrency(stats.lostRevenue)} />
          <StatCard icon={<LuClock />} tone="blue" label={t('stats.cancellable')} value={stats.cancellable} />
        </>
      }
    >
      <Card>
        <div className="px-4 sm:px-5 py-3 border-b border-line">
          <h3 className="font-display font-semibold text-ink text-[15px] leading-tight">{t('listTitle')}</h3>
        </div>
        {error && <div className="px-5 py-3 text-sm text-danger-text border-b border-line">{error}</div>}
        <DataTable
          columns={columns}
          rows={filtered}
          tableFrom="lg"
          empty={
            <EmptyState
              icon="✓"
              title={loading ? t('common:loading') : query ? t('empty.noMatch') : t('empty.none')}
              message={loading ? t('empty.fetching') : query ? t('empty.tryAgain') : t('empty.hint')}
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
        title={t('delete.title')}
        message={deleteTarget ? (
          <Trans t={t} i18nKey="delete.message" values={{ no: deleteTarget.bookingNo, name: deleteTarget.guestName }}
                 components={{ b: <b /> }} />
        ) : null}
        confirmLabel={t('common:delete')}
        cancelLabel={t('common:cancel')}
        danger
        busy={deleting}
      />
    </PageWrapper>
  )
}
