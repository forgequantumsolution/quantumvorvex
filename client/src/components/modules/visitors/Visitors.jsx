import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  LuPlus, LuRefreshCw, LuDownload, LuQrCode, LuUsers, LuHourglass, LuCalendarClock, LuDoorOpen,
  LuEye, LuLogIn, LuLogOut, LuX, LuShieldBan, LuScanQrCode, LuPencil,
} from 'react-icons/lu'
import { PageWrapper, StatCard, TableCard, DataTable, Button, EmptyState } from '../../ui-tw'
import Modal from '../../ui/Modal'
import ConfirmModal from '../../ui/ConfirmModal'
import VisitorModal from './VisitorModal'
import VisitorDetailModal from './VisitorDetailModal'
import VisitorQrModal from './VisitorQrModal'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'
import { usePrimaryAction, useAppSelector } from '../../../store/hooks'
import { visitorsApi } from '../../../api/client'
import { formatDate } from '../../../utils/format'
import { downloadCsv } from '../expenses/expenseUtils'
import { STATUS_TONE, formatWhen, formatDuration, printBadge } from './visitorUtils'

const PAGE_SIZE = 25
const TABS = ['today', 'inside', 'pending', 'expected', 'all']
const POLL_MS = 20000

const ACTION_TONE = {
  view:     'text-info-text hover:bg-info-bg',
  checkIn:  'text-success-text hover:bg-success-bg',
  checkOut: 'text-gold hover:bg-gold-bg',
  reject:   'text-danger-text hover:bg-danger-bg',
  edit:     'text-gold hover:bg-gold-bg',
}

// Icon-only segmented action group (same look as the cash book).
function RowActions({ v, busy, canManage, h }) {
  const { t } = useTranslation('visitors')
  const waiting = v.status === 'pending' || v.status === 'expected'
  const items = [
    { id: 'view', label: t('actions.view'), icon: <LuEye size={15} />, onClick: () => h.open(v) },
    canManage && waiting && { id: 'checkIn', label: v.status === 'pending' ? t('actions.approve') : t('actions.checkIn'), icon: <LuLogIn size={15} />, onClick: () => h.checkIn(v) },
    canManage && waiting && { id: 'reject', label: t('actions.reject'), icon: <LuX size={15} />, onClick: () => h.reject(v) },
    canManage && v.status === 'checked_in' && { id: 'checkOut', label: t('actions.checkOut'), icon: <LuLogOut size={15} />, onClick: () => h.checkOut(v) },
    canManage && !waiting && v.status !== 'checked_in' && { id: 'edit', label: t('actions.edit'), icon: <LuPencil size={15} />, onClick: () => h.edit(v) },
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

function VisitorCell({ v }) {
  const { t } = useTranslation('visitors')
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span aria-hidden className="w-9 h-9 shrink-0 rounded-full bg-gold-bg text-gold flex items-center justify-center font-bold text-[14px]">
        {(v.name || '?').trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-[14px] text-ink truncate max-w-[220px]">{v.name}</span>
          {v.flagged && (
            <span title={t('flaggedHint')} className="shrink-0 inline-flex items-center gap-0.5 rounded bg-danger-bg text-danger-text px-1.5 py-px text-[10.5px] font-bold">
              <LuShieldBan size={10} aria-hidden /> {t('flagged')}
            </span>
          )}
        </div>
        <div className="text-xs text-ink3 truncate max-w-[260px] mt-0.5">
          {v.phone}{v.company ? ` · ${v.company}` : ''}
        </div>
      </div>
    </div>
  )
}

// Asks for an optional reason (reject, block).
function ReasonModal({ title, message, confirmLabel, busy, onClose, onConfirm }) {
  const { t } = useTranslation('visitors')
  const [reason, setReason] = useState('')
  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="440px"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common:cancel')}</Button>
        <Button variant="danger" disabled={busy} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
      </>}>
      <div className="space-y-3">
        <p className="m-0 text-sm text-ink2">{message}</p>
        <label className="block">
          <span className="block text-xs font-medium text-ink2 mb-1.5">{t('reject.reason')}</span>
          <textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            className="w-full bg-surface border border-line2 rounded-lg px-3 py-2 text-base sm:text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
        </label>
      </div>
    </Modal>
  )
}

/**
 * Visitor register: who is inside, who is waiting at the gate, who is expected.
 * Visitors self-register through the property's QR (VisitorQrModal) or the desk
 * adds them (VisitorModal). The list refreshes itself every 20s while the tab
 * is visible, so QR registrations show up without a reload.
 */
export default function Visitors() {
  const { t } = useTranslation('visitors')
  const toast = useToast()
  const canManage = useCan('visitors', 'MANAGE')
  const hotelName = useAppSelector((s) => s.hotel.hotelName)

  const [tab, setTab] = useState('today')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ visitors: [], total: 0, counts: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [exporting, setExporting] = useState(false)
  // Modals
  const [editing, setEditing] = useState(null) // {} new · visitor edit
  const [viewing, setViewing] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [blocking, setBlocking] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [, setTick] = useState(0) // re-render for live durations

  // Debounce the header search.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const reqId = useRef(0)
  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    try {
      const { data } = await visitorsApi.list({ tab, search: search || undefined, page, limit: PAGE_SIZE })
      if (id !== reqId.current) return
      setList(data); setError('')
      // Keep the open details in step with the list.
      setViewing((cur) => (cur ? data.visitors.find((v) => v.id === cur.id) || cur : cur))
    } catch (e) {
      if (id === reqId.current && !quiet) setError(e.response?.data?.message || t('toast.failed'))
    } finally {
      if (id === reqId.current && !quiet) setLoading(false)
    }
  }, [tab, search, page, t])

  useEffect(() => { load() }, [load])

  // Live: poll while the page is visible; tick the "inside for" durations.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') { load({ quiet: true }); setTick((n) => n + 1) }
    }, POLL_MS)
    const onVis = () => document.visibilityState === 'visible' && load({ quiet: true })
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  const openNew = () => canManage && setEditing({})
  usePrimaryAction('visitors', openNew)

  const changeTab = (next) => { setTab(next); setPage(1) }

  // Runs one action on a visitor, then refreshes the list.
  const act = async (v, call, msg) => {
    setBusyId(v.id)
    try {
      await call()
      if (msg) toast(msg)
      await load({ quiet: true })
      return true
    } catch (e) {
      toast(e.response?.data?.message || t('toast.failed'), 'error')
      await load({ quiet: true })
      return false
    } finally {
      setBusyId(null)
    }
  }

  const h = {
    open: (v) => setViewing(v),
    edit: (v) => { setViewing(null); setEditing(v) },
    checkIn: (v) => act(v, () => visitorsApi.checkIn(v.id), t('toast.checkedIn', { name: v.name })),
    checkOut: (v) => act(v, () => visitorsApi.checkOut(v.id), t('toast.checkedOut', { name: v.name })),
    reject: (v) => setRejecting(v),
    block: (v) => setBlocking(v),
    unblock: (v) => act(v, () => visitorsApi.unblock(v.id), t('toast.unblocked')).then(() => setViewing((c) => c && { ...c })),
    remove: (v) => setDeleting(v),
    print: (v) => { if (!printBadge(v, { t, hotelName })) toast(t('toast.failed'), 'error') },
  }

  const onSaved = (v, wasEdit) => {
    setEditing(null)
    if (wasEdit) toast(t('toast.updated'))
    else {
      toast(t(v.status === 'expected' ? 'toast.expected' : 'toast.added', { name: v.name, passNo: v.passNo }))
      // Show where the new entry lives.
      changeTab(v.status === 'expected' ? 'expected' : 'inside')
    }
    load({ quiet: true })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = []
      for (let p = 1; p <= 25; p++) {
        const { data } = await visitorsApi.list({ tab, search: search || undefined, page: p, limit: 200 })
        rows.push(...data.visitors)
        if (rows.length >= data.total || !data.visitors.length) break
      }
      downloadCsv(`visitors-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Pass no', 'Name', 'Mobile', 'Email', 'Company', 'Purpose', 'Whom to meet', 'Room', 'People with them', 'ID type', 'ID (last 4)', 'Vehicle', 'Source', 'Status', 'Registered', 'Checked in', 'Checked out', 'Time inside', 'Notes'],
        rows.map((v) => [
          v.passNo, v.name, v.phone, v.email, v.company, t(`purposes.${v.purpose}`), v.hostName, v.roomNumber, v.companions,
          v.idType ? t(`idTypes.${v.idType}`) : '', v.idNumber, v.vehicleNo, t(`source.${v.source}`), t(`status.${v.status}`),
          v.createdAt && new Date(v.createdAt).toLocaleString(), v.checkInAt && new Date(v.checkInAt).toLocaleString(),
          v.checkOutAt && new Date(v.checkOutAt).toLocaleString(), v.checkInAt ? formatDuration(v.checkInAt, v.checkOutAt || new Date()) : '', v.notes,
        ]))
    } catch {
      toast(t('toast.failed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const c = list.counts
  const kpis = [
    { id: 'inside', label: t('kpi.inside'), value: c?.inside ?? '—', icon: <LuUsers />, tone: 'green', hint: t('kpi.insideHint') },
    { id: 'pending', label: t('kpi.pending'), value: c?.pending ?? '—', icon: <LuHourglass />, tone: c?.pending ? 'amber' : 'grey', hint: t('kpi.pendingHint') },
    { id: 'expected', label: t('kpi.expected'), value: c?.expected ?? '—', icon: <LuCalendarClock />, tone: 'blue', hint: t('kpi.expectedHint') },
    { id: 'today', label: t('kpi.today'), value: c?.today ?? '—', icon: <LuDoorOpen />, tone: 'gold', hint: t('kpi.todayHint', { count: c?.checkedOutToday ?? 0 }) },
  ]

  const columns = [
    { key: 'visitor', header: t('table.visitor'), primary: true, render: (v) => <VisitorCell v={v} /> },
    {
      key: 'status', header: t('table.status'), primary: true, align: 'right',
      render: (v) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATUS_TONE[v.status]}`}>
          {t(`status.${v.status}`)}
        </span>
      ),
    },
    {
      key: 'purpose', header: t('table.purpose'),
      render: (v) => (
        <div className="leading-tight min-w-0">
          <div className="text-ink">{t(`purposes.${v.purpose}`, { defaultValue: v.purpose })}</div>
          <div className="text-xs text-ink3 truncate max-w-[220px]">
            {[v.hostName, v.roomNumber && `#${v.roomNumber}`, v.companions > 0 && t('table.companions', { count: v.companions })].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'pass', header: t('table.pass'), hideBelow: 'lg',
      render: (v) => (
        <div className="leading-tight">
          <div className="font-mono text-[13px] text-ink">{v.passNo}</div>
          <div className="text-xs text-ink3 inline-flex items-center gap-1">
            {v.source === 'qr' && <LuScanQrCode size={11} aria-hidden />}{t(`source.${v.source}`)}
          </div>
        </div>
      ),
    },
    {
      key: 'in', header: t('table.in'),
      render: (v) => (
        <div className="leading-tight whitespace-nowrap">
          {v.checkInAt
            ? <div className="text-ink font-medium">{formatWhen(v.checkInAt)}</div>
            : v.expectedAt
              ? <div className="text-info-text text-xs font-medium">{t('table.expectedAt', { time: formatWhen(v.expectedAt) })}</div>
              : <div className="text-ink3">{formatWhen(v.createdAt)}</div>}
          {v.status === 'checked_in' && (
            <div className="text-xs text-success-text">{t('table.inFor', { duration: formatDuration(v.checkInAt) })}</div>
          )}
        </div>
      ),
    },
    {
      key: 'out', header: t('table.out'), hideBelow: 'xl',
      render: (v) => v.checkOutAt ? (
        <div className="leading-tight whitespace-nowrap">
          <div className="text-ink">{formatWhen(v.checkOutAt)}</div>
          <div className="text-xs text-ink3">{t('table.stayed', { duration: formatDuration(v.checkInAt, v.checkOutAt) })}</div>
        </div>
      ) : <span className="text-ink3">—</span>,
    },
    {
      key: 'actions', header: t('table.actions'), actions: true, align: 'center', className: 'w-[1%]',
      render: (v) => <RowActions v={v} busy={busyId === v.id} canManage={canManage} h={h} />,
    },
  ]
  const order = ['visitor', 'purpose', 'pass', 'in', 'out', 'status', 'actions']
  const ordered = order.map((k) => columns.find((col) => col.key === k))

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle', { date: formatDate(new Date(), { weekday: 'short' }) })}
      search={{ value: query, onChange: setQuery, placeholder: t('searchPlaceholder') }}
      headerActions={[
        { id: 'qr', label: t('propertyQr'), icon: <LuQrCode />, onClick: () => setShowQr(true) },
        { id: 'export', label: t('exportCsv'), icon: <LuDownload />, disabled: exporting || loading, onClick: exportCsv },
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: () => load() },
        canManage && { id: 'add', label: t('addVisitor'), icon: <LuPlus />, variant: 'primary', onClick: openNew },
      ]}
      stats={kpis.map((k) => (
        <StatCard key={k.id} {...k} loading={!c} selected={tab === k.id} onClick={() => changeTab(k.id)} />
      ))}
    >
      <TableCard
        tabs={TABS.map((id) => ({
          id,
          label: c && id !== 'all' && c[id] ? `${t(`tabs.${id}`)} · ${c[id]}` : t(`tabs.${id}`),
        }))}
        activeTab={tab}
        onTab={changeTab}
        error={error}
        pagination={{ page, pageSize: PAGE_SIZE, total: list.total, onChange: setPage, disabled: loading }}
      >
        <DataTable
          columns={ordered}
          rows={list.visitors}
          loading={loading}
          onRowClick={h.open}
          rowClassName={(v) => (v.status === 'pending' ? 'bg-warning-bg/30' : v.flagged ? 'bg-danger-bg/30' : '')}
          empty={
            <EmptyState icon="🪪" title={t('empty.title')} message={search ? t('empty.search') : t('empty.message')}
              action={!search ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {canManage && <Button icon={<LuPlus />} onClick={openNew}>{t('addVisitor')}</Button>}
                  <Button variant="ghost" icon={<LuQrCode />} onClick={() => setShowQr(true)}>{t('propertyQr')}</Button>
                </div>
              ) : null} />
          }
        />
      </TableCard>

      {editing && (
        <VisitorModal key={editing.id || 'new'} visitor={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
      {viewing && (
        <VisitorDetailModal
          key={viewing.id}
          visitor={viewing}
          canManage={canManage}
          busy={busyId === viewing.id}
          onClose={() => setViewing(null)}
          onCheckIn={h.checkIn}
          onCheckOut={h.checkOut}
          onReject={h.reject}
          onEdit={h.edit}
          onDelete={h.remove}
          onBlock={h.block}
          onUnblock={h.unblock}
          onPrint={h.print}
        />
      )}
      {showQr && <VisitorQrModal hotelName={hotelName} onClose={() => setShowQr(false)} />}
      {rejecting && (
        <ReasonModal
          title={t('reject.title')}
          message={<Trans t={t} i18nKey="reject.message" values={{ name: rejecting.name }} components={{ b: <strong /> }} />}
          confirmLabel={t('reject.confirm')}
          busy={busyId === rejecting.id}
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            const v = rejecting
            if (await act(v, () => visitorsApi.reject(v.id, reason), t('toast.rejected', { name: v.name }))) setRejecting(null)
          }}
        />
      )}
      {blocking && (
        <ReasonModal
          title={t('block.title')}
          message={<Trans t={t} i18nKey="block.message" values={{ phone: blocking.phone }} components={{ b: <strong /> }} />}
          confirmLabel={t('block.confirm')}
          busy={busyId === blocking.id}
          onClose={() => setBlocking(null)}
          onConfirm={async (reason) => {
            const v = blocking
            if (await act(v, () => visitorsApi.block(v.id, reason), t('toast.blocked'))) {
              setBlocking(null)
              // Remount the details so they show the new block state.
              setViewing((cur) => cur && { ...cur, updatedAt: new Date().toISOString() })
            }
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('delete.title')}
        message={deleting && <Trans t={t} i18nKey="delete.message" values={{ name: deleting.name, passNo: deleting.passNo }} components={{ b: <strong /> }} />}
        confirmLabel={t('actions.delete')}
        danger
        busy={deleting && busyId === deleting.id}
        onConfirm={async () => {
          const v = deleting
          if (await act(v, () => visitorsApi.remove(v.id), t('toast.deleted'))) { setDeleting(null); setViewing(null) }
        }}
      />
    </PageWrapper>
  )
}
