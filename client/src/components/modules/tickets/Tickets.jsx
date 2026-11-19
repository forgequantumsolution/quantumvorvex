import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  LuPlus, LuRefreshCw, LuDownload, LuList, LuSquareKanban, LuUserCheck, LuInbox, LuAlarmClock, LuClipboardCheck,
  LuEye, LuPlay, LuCircleCheck, LuCircleCheckBig, LuHand, LuFlag, LuUsers, LuCheck, LuListChecks, LuMessageSquare,
} from 'react-icons/lu'
import { PageWrapper, StatCard, TableCard, DataTable, Button, EmptyState } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import TicketModal from './TicketModal'
import TicketDetail from './TicketDetail'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'
import { usePrimaryAction } from '../../../store/hooks'
import { ticketsApi } from '../../../api/client'
import { downloadCsv } from '../expenses/expenseUtils'
import { PRIORITIES, BOARD_COLUMNS, STATUS_DOT, isOverdue, timeAgo } from './ticketUtils'
import { Avatar, StatusPill, PriorityPill, Due } from './TicketBits'

const PAGE_SIZE = 25
const TABS = ['mine', 'created', 'open', 'unassigned', 'overdue', 'verify', 'closed', 'all']
const POLL_MS = 30000
const VIEW_KEY = 'qv-tickets-view'

const ACTION_TONE = {
  view:    'text-info-text hover:bg-info-bg',
  take:    'text-gold hover:bg-gold-bg',
  start:   'text-gold hover:bg-gold-bg',
  resolve: 'text-success-text hover:bg-success-bg',
  verify:  'text-success-text hover:bg-success-bg',
}

// Quick actions in the row; the full set (with notes) is in the ticket view.
// Mirrors the server's rules for the common case.
function quickActions(tk, meId, isAdmin) {
  const mine = tk.assigneeId === meId
  const raiser = tk.createdById === meId
  const active = ['open', 'in_progress', 'on_hold'].includes(tk.status)
  return {
    take: !tk.assigneeId && active,
    start: (mine || isAdmin) && tk.status === 'open' && !!tk.assigneeId,
    resolve: (mine || isAdmin) && tk.status === 'in_progress',
    verify: (raiser || isAdmin) && tk.status === 'resolved',
  }
}

function RowActions({ tk, busy, h }) {
  const { t } = useTranslation('tickets')
  const q = h.quick(tk)
  const items = [
    { id: 'view', label: t('actions.view'), icon: <LuEye size={15} />, onClick: () => h.open(tk) },
    h.canManage && q.take && { id: 'take', label: t('actions.take'), icon: <LuHand size={15} />, onClick: () => h.take(tk) },
    h.canManage && q.start && { id: 'start', label: t('actions.start'), icon: <LuPlay size={15} />, onClick: () => h.status(tk, 'start') },
    h.canManage && q.resolve && { id: 'resolve', label: t('actions.resolve'), icon: <LuCircleCheck size={15} />, onClick: () => h.status(tk, 'resolve') },
    h.canManage && q.verify && { id: 'verify', label: t('actions.verify'), icon: <LuCircleCheckBig size={15} />, onClick: () => h.status(tk, 'verify') },
  ].filter(Boolean)
  return (
    <div role="group" aria-label={t('table.actions')}
      className="inline-flex items-stretch rounded-lg border border-line bg-surface shadow-soft overflow-hidden divide-x divide-line"
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {items.map((i) => (
        <button key={i.id} type="button" disabled={busy} onClick={i.onClick} title={i.label} aria-label={i.label}
          className={`w-[34px] h-[34px] inline-flex items-center justify-center bg-transparent border-0 cursor-pointer transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${ACTION_TONE[i.id]}`}>
          {i.icon}
        </button>
      ))}
    </div>
  )
}

// Checklist progress + comment count, shown under the title and on cards.
function Signals({ tk }) {
  if (!tk.checklistTotal && !tk.comments) return null
  return (
    <span className="inline-flex items-center gap-2.5 text-[11.5px] text-ink3">
      {tk.checklistTotal > 0 && (
        <span className={`inline-flex items-center gap-1 ${tk.checklistDone === tk.checklistTotal ? 'text-success-text' : ''}`}>
          <LuListChecks size={12} aria-hidden />{tk.checklistDone}/{tk.checklistTotal}
        </span>
      )}
      {tk.comments > 0 && <span className="inline-flex items-center gap-1"><LuMessageSquare size={12} aria-hidden />{tk.comments}</span>}
    </span>
  )
}

function TicketCell({ tk }) {
  const { t } = useTranslation('tickets')
  return (
    <div className="min-w-0 leading-tight">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[11.5px] text-ink3 shrink-0">{tk.ticketNo}</span>
        <span className="font-semibold text-[14px] text-ink truncate max-w-[340px]">{tk.title}</span>
      </div>
      <div className="flex items-center gap-2.5 mt-1 text-xs text-ink3 min-w-0">
        <span className="truncate">{t(`categories.${tk.category}`, { defaultValue: tk.category })}{tk.roomNumber ? ` · ${t('table.room', { room: tk.roomNumber })}` : ''}</span>
        <Signals tk={tk} />
      </div>
    </div>
  )
}

function Board({ tickets, loading, onOpen }) {
  const { t } = useTranslation('tickets')
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {BOARD_COLUMNS.map((col) => {
          const items = tickets.filter((tk) => tk.status === col)
          return (
            <section key={col} className="rounded-xl bg-surface2/70 border border-line p-2.5 min-h-[160px]">
              <h3 className="m-0 px-1.5 pb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink2">
                <span aria-hidden className={`w-2 h-2 rounded-full ${STATUS_DOT[col]}`} />
                {t(`status.${col}`)}
                <span className="ml-auto text-xs font-medium text-ink3">{items.length}</span>
              </h3>
              <ul className="m-0 p-0 list-none space-y-2">
                {loading && !items.length && [0, 1].map((i) => <li key={i} className="h-20 rounded-lg bg-line animate-pulse" />)}
                {!loading && !items.length && <li className="text-center text-xs text-ink3 py-6">{t('board.empty')}</li>}
                {items.map((tk) => (
                  <li key={tk.id}>
                    <button type="button" onClick={() => onOpen(tk)}
                      className={`w-full text-left bg-surface border rounded-lg p-3 cursor-pointer shadow-soft hover:border-gold transition-colors ${isOverdue(tk) ? 'border-danger/50' : 'border-line'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ink3">{tk.ticketNo}</span>
                        <PriorityPill priority={tk.priority} />
                      </div>
                      <div className="mt-1.5 text-[13.5px] font-semibold text-ink leading-snug line-clamp-2 break-words">{tk.title}</div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0 text-xs text-ink2">
                          <Avatar name={tk.assigneeName} size={22} muted={!tk.assigneeId} />
                          <span className="truncate">{tk.assigneeName || t('table.unassigned')}</span>
                        </span>
                        <Due ticket={tk} compact />
                      </div>
                      <div className="mt-1.5"><Signals tk={tk} /></div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <p className="m-0 mt-3 text-xs text-ink3">{t('board.closedNote')}</p>
    </div>
  )
}

/**
 * Ticket tracker: raise work, assign it, follow it to done and verify it.
 * List (tabs + filters + pagination) or board (active work by status).
 * Refreshes every 30s while visible so new assignments show up.
 */
export default function Tickets() {
  const { t } = useTranslation('tickets')
  const toast = useToast()
  const canManage = useCan('tickets', 'MANAGE')

  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || 'list' } catch { return 'list' } })
  const [tab, setTab] = useState('mine')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ tickets: [], total: 0, counts: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [people, setPeople] = useState({ assignees: [], me: null })
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState(null) // {} new · ticket edit
  const [viewingId, setViewingId] = useState(null)
  const [detailKey, setDetailKey] = useState(0)
  const [deleting, setDeleting] = useState(null)
  const firstLoad = useRef(true)

  useEffect(() => {
    ticketsApi.assignees().then(({ data }) => setPeople(data)).catch(() => {})
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const reqId = useRef(0)
  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    // The board shows every active ticket the user can see.
    const params = view === 'board'
      ? { tab: 'all', limit: 200 }
      : { tab, page, limit: PAGE_SIZE }
    try {
      const { data } = await ticketsApi.list({
        ...params, search: search || undefined, priority: priority || undefined, assignee: assignee || undefined,
      })
      if (id !== reqId.current) return
      setList(data); setError('')
      // First visit: nothing assigned to me → start on the open queue.
      if (firstLoad.current && view === 'list' && tab === 'mine' && data.total === 0 && data.counts.open > 0) {
        firstLoad.current = false
        setTab('open')
        return
      }
      firstLoad.current = false
    } catch (e) {
      if (id === reqId.current && !quiet) setError(e.response?.data?.message || t('toast.failed'))
    } finally {
      if (id === reqId.current && !quiet) setLoading(false)
    }
  }, [view, tab, page, search, priority, assignee, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && load({ quiet: true }), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const openNew = () => canManage && setEditing({})
  usePrimaryAction('tickets', openNew)

  const changeTab = (next) => { setTab(next); setPage(1); if (view !== 'list') switchView('list') }
  const switchView = (v) => { setView(v); setPage(1); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }


  const act = async (tk, call, msg) => {
    setBusyId(tk.id)
    try {
      const { data } = await call()
      toast(typeof msg === 'function' ? msg(data) : msg)
    } catch (e) {
      toast(e.response?.data?.message || t('toast.failed'), 'error')
    } finally {
      setBusyId(null)
      load({ quiet: true })
    }
  }

  const h = {
    canManage,
    quick: (tk) => quickActions(tk, people.me, !!people.admin),
    open: (tk) => { setViewingId(tk.id); setDetailKey((k) => k + 1) },
    take: (tk) => act(tk, () => ticketsApi.assign(tk.id, people.me), t('toast.taken', { no: tk.ticketNo })),
    status: (tk, action) => act(tk, () => ticketsApi.status(tk.id, action),
      (d) => t('toast.status', { no: tk.ticketNo, status: t(`status.${d.ticket.status}`) })),
  }

  const onSaved = (data, wasEdit) => {
    setEditing(null)
    toast(wasEdit ? t('toast.updated') : t('toast.created', { no: data.ticket.ticketNo }))
    load({ quiet: true })
    if (wasEdit) setDetailKey((k) => k + 1)
    else { setViewingId(data.ticket.id); setDetailKey((k) => k + 1) }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = []
      for (let p = 1; p <= 25; p++) {
        const { data } = await ticketsApi.list({ tab, search: search || undefined, priority: priority || undefined, assignee: assignee || undefined, page: p, limit: 200 })
        rows.push(...data.tickets)
        if (rows.length >= data.total || !data.tickets.length) break
      }
      const dt = (d) => (d ? new Date(d).toLocaleString() : '')
      downloadCsv(`tickets-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Ticket no', 'Title', 'Category', 'Priority', 'Status', 'Assigned to', 'Raised by', 'Room', 'Due', 'Overdue', 'Checklist', 'Comments', 'Created', 'Resolved', 'Closed', 'Reopened'],
        rows.map((x) => [
          x.ticketNo, x.title, t(`categories.${x.category}`), t(`priority.${x.priority}`), t(`status.${x.status}`),
          x.assigneeName || '', x.createdByName || '', x.roomNumber, dt(x.dueAt), isOverdue(x) ? 'Yes' : '',
          x.checklistTotal ? `${x.checklistDone}/${x.checklistTotal}` : '', x.comments, dt(x.createdAt), dt(x.resolvedAt), dt(x.closedAt), x.reopenCount,
        ]))
    } catch {
      toast(t('toast.failed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const c = list.counts
  const kpis = [
    { id: 'mine', label: t('kpi.mine'), value: c?.mine ?? '—', icon: <LuUserCheck />, tone: 'gold', hint: t('kpi.mineHint') },
    { id: 'open', label: t('kpi.open'), value: c?.open ?? '—', icon: <LuInbox />, tone: 'blue', hint: t('kpi.openHint', { count: c?.unassigned ?? 0 }) },
    { id: 'overdue', label: t('kpi.overdue'), value: c?.overdue ?? '—', icon: <LuAlarmClock />, tone: c?.overdue ? 'red' : 'grey', hint: t('kpi.overdueHint') },
    { id: 'verify', label: t('kpi.verify'), value: c?.verify ?? '—', icon: <LuClipboardCheck />, tone: 'purple', hint: t('kpi.verifyHint') },
  ]

  const meName = people.assignees.find((a) => a.id === people.me)?.name
  const columns = [
    { key: 'ticket', header: t('table.ticket'), primary: true, render: (tk) => <TicketCell tk={tk} /> },
    { key: 'status', header: t('table.status'), primary: true, align: 'right', render: (tk) => <StatusPill status={tk.status} /> },
    {
      key: 'assignee', header: t('table.assignee'),
      render: (tk) => (
        <span className="flex items-center gap-2 min-w-0">
          <Avatar name={tk.assigneeName} size={26} muted={!tk.assigneeId} />
          <span className={`truncate max-w-[150px] ${tk.assigneeId ? 'text-ink' : 'text-ink3'}`}>
            {tk.assigneeId === people.me && meName ? t('form.you', { name: meName }) : tk.assigneeName || t('table.unassigned')}
          </span>
        </span>
      ),
    },
    { key: 'priority', header: t('table.priority'), render: (tk) => <PriorityPill priority={tk.priority} /> },
    { key: 'due', header: t('table.due'), render: (tk) => <Due ticket={tk} /> },
    {
      key: 'updated', header: t('table.updated'), hideBelow: 'xl',
      render: (tk) => <span className="text-xs text-ink3 whitespace-nowrap" title={new Date(tk.updatedAt).toLocaleString()}>{timeAgo(tk.updatedAt)}</span>,
    },
    {
      key: 'actions', header: t('table.actions'), actions: true, align: 'center', className: 'w-[1%]',
      render: (tk) => <RowActions tk={tk} busy={busyId === tk.id} h={h} />,
    },
  ]
  const order = ['ticket', 'assignee', 'priority', 'due', 'status', 'updated', 'actions']
  const ordered = order.map((k) => columns.find((col) => col.key === k))

  const assigneeLabel = assignee === 'none' ? t('filters.unassigned')
    : assignee ? people.assignees.find((a) => a.id === assignee)?.name || t('filters.assignee') : t('filters.assignee')
  const filtered = !!(search || priority || assignee)

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={{ value: query, onChange: setQuery, placeholder: t('searchPlaceholder') }}
      headerActions={[
        {
          id: 'priority', label: priority ? t(`priority.${priority}`) : t('filters.priority'), icon: <LuFlag />,
          menu: [{ id: 'any', label: t('filters.anyPriority'), icon: !priority ? <LuCheck /> : undefined, onClick: () => { setPriority(''); setPage(1) } },
            ...PRIORITIES.map((p) => ({ id: p, label: t(`priority.${p}`), icon: priority === p ? <LuCheck /> : undefined, onClick: () => { setPriority(p); setPage(1) } }))],
        },
        {
          id: 'assignee', label: assigneeLabel, icon: <LuUsers />,
          menu: [
            { id: 'any', label: t('filters.anyone'), icon: !assignee ? <LuCheck /> : undefined, onClick: () => { setAssignee(''); setPage(1) } },
            { id: 'none', label: t('filters.unassigned'), icon: assignee === 'none' ? <LuCheck /> : undefined, onClick: () => { setAssignee('none'); setPage(1) } },
            ...people.assignees.map((a) => ({ id: a.id, label: a.id === people.me ? t('form.you', { name: a.name }) : a.name, icon: assignee === a.id ? <LuCheck /> : undefined, onClick: () => { setAssignee(a.id); setPage(1) } })),
          ],
        },
        view === 'list' && { id: 'export', label: t('exportCsv'), icon: <LuDownload />, disabled: exporting || loading, onClick: exportCsv },
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: () => load() },
        { id: 'view-list', label: t('views.list'), icon: <LuList />, variant: 'icon', active: view === 'list', onClick: () => switchView('list') },
        { id: 'view-board', label: t('views.board'), icon: <LuSquareKanban />, variant: 'icon', active: view === 'board', onClick: () => switchView('board') },
        canManage && { id: 'add', label: t('newTicket'), icon: <LuPlus />, variant: 'primary', onClick: openNew },
      ]}
      stats={kpis.map((k) => (
        <StatCard key={k.id} {...k} loading={!c} selected={view === 'list' && tab === k.id} onClick={() => changeTab(k.id)} />
      ))}
    >
      {view === 'board' ? (
        <>
          {error && <div role="alert" className="mb-3 rounded-lg px-3 py-2 text-sm text-danger-text bg-danger-bg">{error}</div>}
          <Board tickets={list.tickets} loading={loading} onOpen={h.open} />
        </>
      ) : (
        <TableCard
          tabs={TABS.map((id) => ({ id, label: c && c[id] && id !== 'all' && id !== 'closed' ? `${t(`tabs.${id}`)} · ${c[id]}` : t(`tabs.${id}`) }))}
          activeTab={tab}
          onTab={changeTab}
          error={error}
          pagination={{ page, pageSize: PAGE_SIZE, total: list.total, onChange: setPage, disabled: loading }}
        >
          <DataTable
            columns={ordered}
            rows={list.tickets}
            loading={loading}
            onRowClick={h.open}
            rowClassName={(tk) => (isOverdue(tk) ? 'bg-danger-bg/25' : '')}
            empty={
              <EmptyState icon="🎫" title={t('empty.title')} message={filtered ? t('empty.search') : t('empty.message')}
                action={canManage && !filtered ? <Button icon={<LuPlus />} onClick={openNew}>{t('newTicket')}</Button> : null} />
            }
          />
        </TableCard>
      )}

      {editing && (
        <TicketModal key={editing.id || 'new'} ticket={editing.id ? editing : null} assignees={people.assignees} meId={people.me}
          onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
      {viewingId && !editing && (
        <TicketDetail key={`${viewingId}-${detailKey}`} ticketId={viewingId} assignees={people.assignees} meId={people.me} toast={toast}
          onClose={() => setViewingId(null)}
          onChanged={() => load({ quiet: true })}
          onEdit={(tk) => setEditing(tk)}
          onDelete={(tk) => setDeleting(tk)} />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('delete.title')}
        message={deleting && <Trans t={t} i18nKey="delete.message" values={{ no: deleting.ticketNo, title: deleting.title }} components={{ b: <strong /> }} />}
        confirmLabel={t('actions.delete')}
        danger
        busy={!!deleting && busyId === deleting.id}
        onConfirm={async () => {
          const tk = deleting
          setBusyId(tk.id)
          try {
            await ticketsApi.remove(tk.id)
            toast(t('toast.deleted'))
            setDeleting(null); setViewingId(null)
            load({ quiet: true })
          } catch (e) {
            toast(e.response?.data?.message || t('toast.failed'), 'error')
          } finally {
            setBusyId(null)
          }
        }}
      />
    </PageWrapper>
  )
}
