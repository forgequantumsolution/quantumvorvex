import { useMemo, useState } from 'react'
import { PageWrapper, StatCard, Card, FilterTabs, SearchInput, Button, EmptyState } from '../../ui-tw'
import TicketCard from './TicketCard'
import NewTicketModal from './NewTicketModal'
import { useAppSelector, useOpsActions } from '../../../store/hooks'
import { useToast } from '../../../hooks/useToast'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Open', label: 'Open' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Resolved', label: 'Resolved' },
]

export default function Maintenance() {
  const tickets = useAppSelector((s) => s.ops.tickets)
  const { addTicket, updateTicketStatus } = useOpsActions()
  const toast = useToast()

  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)

  const counts = useMemo(
    () => ({
      all: tickets.length,
      Open: tickets.filter((t) => t.status === 'Open').length,
      'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
      Resolved: tickets.filter((t) => t.status === 'Resolved').length,
    }),
    [tickets],
  )

  const urgent = useMemo(
    () => tickets.filter((t) => t.priority === 'Urgent' && t.status !== 'Resolved').length,
    [tickets],
  )

  const filtered = useMemo(() => {
    let list = tickets
    if (tab !== 'all') list = list.filter((t) => t.status === tab)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.room.includes(q) ||
          t.ticketNo.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
    }
    return list
  }, [tickets, tab, query])

  const handleCreate = (ticket) => {
    addTicket(ticket)
    toast(`Ticket ${ticket.ticketNo} created for Room ${ticket.room}`)
    setShowNew(false)
  }

  const handleStatus = (id, status) => {
    updateTicketStatus({ id, status })
    toast(`Ticket marked ${status}`, status === 'Resolved' ? 'success' : 'info')
  }

  return (
    <PageWrapper
      title="Maintenance"
      subtitle="Track and resolve property maintenance issues"
      icon="🔧"
      actions={<Button icon="＋" onClick={() => setShowNew(true)}>New Ticket</Button>}
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
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔧"
              title={query ? 'No matching tickets' : 'No tickets here'}
              message={query ? 'Try a different search.' : 'Create a ticket to track an issue.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <TicketCard key={t.id} ticket={t} onStatusChange={handleStatus} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <NewTicketModal isOpen={showNew} existing={tickets} onClose={() => setShowNew(false)} onSave={handleCreate} />
    </PageWrapper>
  )
}
