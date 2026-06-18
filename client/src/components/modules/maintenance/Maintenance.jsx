import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button, EmptyState } from '../../ui-tw'
import TicketCard from './TicketCard'
import NewTicketModal from './NewTicketModal'
import ConfirmModal from '../../ui/ConfirmModal'
import { useToast } from '../../../hooks/useToast'
import { usePrimaryAction } from '../../../store/hooks'
import { maintenanceApi } from '../../../api/client'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Open', label: 'Open' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Resolved', label: 'Resolved' },
]

const normalize = (t) => ({ ...t, roomNumber: t.room?.number || t.room || '' })

export default function Maintenance() {
  const toast = useToast()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await maintenanceApi.getAll()
      setTickets((data.requests || []).map(normalize))
    } catch {
      setError('Could not load tickets. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Header "New Ticket" button
  usePrimaryAction('maintenance', () => setShowNew(true))

  const counts = useMemo(() => ({
    all: tickets.length,
    Open: tickets.filter((t) => t.status === 'Open').length,
    'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
    Resolved: tickets.filter((t) => t.status === 'Resolved').length,
  }), [tickets])

  const urgent = useMemo(
    () => tickets.filter((t) => t.priority === 'Urgent' && t.status !== 'Resolved').length,
    [tickets],
  )

  const filtered = useMemo(() => {
    let list = tickets
    if (tab !== 'all') list = list.filter((t) => t.status === tab)
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
      toast(`Ticket ${data.request.ticketNo} created for Room ${data.request.room?.number}`)
      setShowNew(false)
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || 'Could not create ticket', 'error')
    }
  }

  const handleStatus = async (id, status) => {
    setBusyId(id)
    try {
      const { data } = await maintenanceApi.update(id, { status })
      setTickets((prev) => prev.map((t) => (t.id === id ? normalize(data.request) : t)))
      toast(`Ticket marked ${status}`, status === 'Resolved' ? 'success' : 'info')
    } catch (err) {
      toast(err.response?.data?.message || 'Update failed', 'error')
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
      toast(`Ticket ${deleteTarget.ticketNo} deleted`)
      setDeleteTarget(null)
    } catch (err) {
      toast(err.response?.data?.message || 'Could not delete ticket', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageWrapper
      actions={
        <div className="flex items-center gap-2">
          <Button icon="＋" onClick={() => setShowNew(true)}>New Ticket</Button>
          <Button variant="ghost" onClick={load} disabled={loading}>↻ Refresh</Button>
        </div>
      }
      stats={
        <>
          <StatCard icon="🔧" tone="gold" label="Total tickets" value={counts.all} />
          <StatCard icon="●" tone="amber" label="Open" value={counts.Open} />
          <StatCard icon="◐" tone="blue" label="In progress" value={counts['In Progress']} />
          <StatCard icon="!" tone="red" label="Urgent unresolved" value={urgent} />
        </>
      }
    >
      <Card
        title="Tickets"
        actions={<SearchInput value={query} onChange={setQuery} placeholder="Search room, title, category" className="w-60" />}
      >
        <div className="px-5 py-3 border-b border-line">
          <FilterTabs tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))} active={tab} onChange={setTab} />
        </div>

        <div className="p-4">
          {error && <div className="text-sm text-danger-text mb-3">{error}</div>}
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔧"
              title={loading ? 'Loading…' : query ? 'No matching tickets' : 'No tickets here'}
              message={loading ? 'Fetching tickets.' : query ? 'Try a different search.' : 'Create a ticket to track an issue.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        title="Delete Ticket"
        message={deleteTarget ? <>Permanently delete ticket <b>{deleteTarget.ticketNo}</b> ({deleteTarget.title})? This cannot be undone.</> : null}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />
    </PageWrapper>
  )
}
