import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuWrench, LuCircleDot, LuLoader, LuTriangleAlert, LuPlus, LuRefreshCw } from 'react-icons/lu'
import { PageWrapper, StatCard, Card, FilterTabs, EmptyState } from '../../ui-tw'
import TicketCard from './TicketCard'
import NewTicketModal from './NewTicketModal'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { maintenanceApi } from '../../../api/client'

// Tab ids are the ticket status values, plus 'urgent' (urgent and not yet
// resolved, in any status); labels are translated at render.
const TABS = ['all', 'Open', 'In Progress', 'Resolved', 'urgent']
const isUrgent = (t) => t.priority === 'Urgent' && t.status !== 'Resolved'
const tabLabel = (t, id) => (id === 'all' ? t('common:all') : id === 'urgent' ? t('tabs.urgent') : t(`status.${id}`))

const normalize = (t) => ({ ...t, roomNumber: t.room?.number || t.room || '' })

export default function Maintenance() {
  const { t } = useTranslation('maintenance')
  const toast = useToast()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const { data } = await maintenanceApi.getAll()
      setTickets((data.requests || []).map(normalize))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Lets other pages open the new-ticket dialog remotely
  usePrimaryAction('maintenance', () => setShowNew(true))

  const counts = useMemo(() => ({
    all: tickets.length,
    Open: tickets.filter((t) => t.status === 'Open').length,
    'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
    Resolved: tickets.filter((t) => t.status === 'Resolved').length,
    urgent: tickets.filter(isUrgent).length,
  }), [tickets])

  const filtered = useMemo(() => {
    let list = tickets
    if (tab === 'urgent') list = list.filter(isUrgent)
    else if (tab !== 'all') list = list.filter((t) => t.status === tab)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((t) =>
        t.title?.toLowerCase().includes(q) ||
        String(t.roomNumber || '').includes(q) ||
        t.ticketNo?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q))
    }
    return list
  }, [tickets, tab, query])

  const handleCreate = async (payload) => {
    try {
      const { data } = await maintenanceApi.create(payload)
      setTickets((prev) => [normalize(data.request), ...prev])
      toast(t('toast.created', { ticketNo: data.request.ticketNo, room: data.request.room?.number }))
      setShowNew(false)
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || t('toast.createFailed'), 'error')
    }
  }

  const handleStatus = async (id, status) => {
    setBusyId(id)
    try {
      const { data } = await maintenanceApi.update(id, { status })
      setTickets((prev) => prev.map((t) => (t.id === id ? normalize(data.request) : t)))
      toast(t('toast.marked', { status: t(`status.${status}`, status) }), status === 'Resolved' ? 'success' : 'info')
    } catch (err) {
      toast(err.response?.data?.message || t('toast.updateFailed'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await maintenanceApi.remove(deleteTarget.id)
      setTickets((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      toast(t('toast.deleted', { ticketNo: deleteTarget.ticketNo }))
      setDeleteTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || t('toast.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={{ value: query, onChange: setQuery, placeholder: t('searchPlaceholder') }}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
        { id: 'new', label: t('newTicket'), icon: <LuPlus />, variant: 'primary', onClick: () => setShowNew(true) },
      ]}
      stats={
        <>
          {/* Each card picks the matching tab below. */}
          {[
            { id: 'all', icon: <LuWrench />, tone: 'gold', label: t('stats.total'), value: counts.all },
            { id: 'Open', icon: <LuCircleDot />, tone: 'amber', label: t('status.Open'), value: counts.Open },
            { id: 'In Progress', icon: <LuLoader />, tone: 'blue', label: t('status.In Progress'), value: counts['In Progress'] },
            { id: 'urgent', icon: <LuTriangleAlert />, tone: 'red', label: t('stats.urgent'), value: counts.urgent },
          ].map(({ id, ...k }) => (
            <StatCard key={id} {...k} selected={tab === id} onClick={() => setTab(id)} />
          ))}
        </>
      }
    >
      <Card title={t('tickets')} subtitle={t('shown', { count: filtered.length, total: tickets.length })}>
        {/* Status tabs scroll sideways on phones */}
        <div className="min-w-0 px-4 sm:px-5 py-3 border-b border-line">
          <FilterTabs tabs={TABS.map((id) => ({ id, label: tabLabel(t, id), count: counts[id] }))} active={tab} onChange={setTab} />
        </div>

        <div className="p-3 sm:p-4">
          {error && <div className="text-sm text-danger-text mb-3">{t('loadFailed')}</div>}
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔧"
              title={loading ? t('common:loading') : query ? t('empty.noMatch') : t('empty.none')}
              message={loading ? t('empty.fetching') : query ? t('empty.tryDifferent') : t('empty.createHint')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((t) => (
                <TicketCard key={t.id} ticket={t} busy={busyId === t.id} onStatusChange={handleStatus} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <NewTicketModal isOpen={showNew} onClose={() => setShowNew(false)} onSave={handleCreate} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete.title')}
        message={deleteTarget ? <>{t('delete.before')} <b>{deleteTarget.ticketNo}</b> ({deleteTarget.title}){t('delete.after')}</> : null}
        confirmLabel={t('common:delete')}
        danger
        busy={deleting}
      />
    </PageWrapper>
  )
}
