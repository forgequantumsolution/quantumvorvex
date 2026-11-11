import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { LuSparkles, LuSprayCan, LuLoader, LuRefreshCw, LuLayers, LuBrush, LuX } from 'react-icons/lu'
import { PageWrapper, DataTable, TableCard, EmptyState, StatCard } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector } from '../../../store/hooks'
import { housekeepingApi, usersApi } from '../../../api/client'
import { formatDate, timeAgo } from '../../../utils/format'

// ─── Status config ──────────────────────────────────────────────────────────
// Display labels live in locales/*/housekeeping.json under status.<key>.
const HK_STATUSES = {
  clean_available:     { color: 'var(--green)',     bg: 'var(--green-bg)',  text: 'var(--green-text)' },
  dirty_available:     { color: 'var(--amber)',     bg: 'var(--amber-bg)',  text: 'var(--amber-text)' },
  occupied:            { color: 'var(--red)',       bg: 'var(--red-bg)',    text: 'var(--red-text)' },
  checkout_pending:    { color: 'var(--orange)',    bg: 'var(--orange-bg)', text: 'var(--orange-text)' },
  cleaning_in_progress:{ color: 'var(--blue)',      bg: 'var(--blue-bg)',   text: 'var(--blue-text)' },
  maintenance:         { color: 'var(--grey-text)', bg: 'var(--grey-bg)',   text: 'var(--grey-text)' },
}

// English item names are what the API stores; the UI shows checklist.<item>.
const CHECKLIST_ITEMS = [
  'Minibar stocked', 'Toiletries refilled', 'AC functional', 'TV functional',
  'Bathroom clean', 'Bed made', 'Fresh towels', 'Floor mopped', 'Dustbin emptied',
]

// Map a raw API room (with its housekeepingStatus relation) to the flat shape
// the board/tables render. Falls back to the room's own status when no
// housekeeping record exists yet.
function mapBoardRoom(room) {
  const hk = room.housekeepingStatus
  let status = hk?.status
  if (!status) {
    if (room.status === 'occupied') status = 'occupied'
    else if (room.status === 'maintenance') status = 'maintenance'
    else status = 'clean_available'
  }
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    status,
    assignedTo: hk?.assignedTo || null,
    startedAt: hk?.startedAt || null,
    completedAt: hk?.completedAt || null,
  }
}

// Room-status filter set by the KPI cards (and, below xl, a select). Each one
// matches exactly the rooms its card counts.
const STATUS_FILTERS = {
  clean:    ['clean_available'],
  dirty:    ['dirty_available', 'checkout_pending'],
  cleaning: ['cleaning_in_progress'],
}

// The status filter as the page shows it: a compact select below xl (where the
// KPI strip is hidden), and from xl a removable chip while a filter is on.
function StatusFilterControl({ value, onChange, className = '' }) {
  const { t } = useTranslation('housekeeping')
  return (
    <>
      <div className={`xl:hidden min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 ${className}`}>
        <label htmlFor="hk-status-filter" className="form-label whitespace-nowrap">{t('filter.status')}</label>
        <select id="hk-status-filter" className="form-select w-full sm:w-48" value={value || ''} onChange={e => onChange(e.target.value || null)}>
          <option value="">{t('filter.all')}</option>
          {Object.keys(STATUS_FILTERS).map(id => <option key={id} value={id}>{t(`stats.${id}`)}</option>)}
        </select>
      </div>
      {value && (
        <span className={`hidden xl:inline-flex items-center gap-1.5 self-center rounded-full border border-gold-border bg-gold-bg pl-3 pr-1 py-0.5 text-xs font-medium text-ink ${className}`}>
          {t('filter.showing', { status: t(`stats.${value}`) })}
          <button type="button" onClick={() => onChange(null)} aria-label={t('filter.clear')} title={t('filter.clear')}
            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 cursor-pointer">
            <LuX size={12} aria-hidden />
          </button>
        </span>
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadgeType(key) {
  if (key === 'clean_available')      return 'green'
  if (key === 'dirty_available')      return 'amber'
  if (key === 'occupied')             return 'red'
  if (key === 'checkout_pending')     return 'amber'
  if (key === 'cleaning_in_progress') return 'blue'
  return 'grey'
}

function getInitials(name) {
  if (!name) return ''
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function linenDueColor(nextDue) {
  if (!nextDue) return 'var(--text3)'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return 'var(--red-text)'
  if (diff <= 7) return 'var(--amber-text)'
  return 'var(--green-text)'
}

function linenDueBadge(nextDue) {
  if (!nextDue) return 'grey'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return 'red'
  if (diff <= 7) return 'amber'
  return 'green'
}

function linenDueLabel(nextDue, t) {
  if (!nextDue) return '—'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return t('linen.overdue')
  if (diff === 0) return t('linen.dueToday')
  return t('days', { count: diff })
}

// ─── Room Assignment Modal ────────────────────────────────────────────────────
function AssignRoomModal({ room, onClose, onSave, staff }) {
  const { t } = useTranslation('housekeeping')
  const [status, setStatus] = useState(room?.status || 'clean_available')
  const [assignedTo, setAssignedTo] = useState(room?.assignedTo || '')

  function handleSave() {
    onSave(room.id, { status, assignedTo: assignedTo || null })
  }

  if (!room) return null
  return (
    <Modal
      isOpen={!!room}
      onClose={onClose}
      title={t('assign.title', { number: room.number })}
      maxWidth="420px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('common:save')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className="form-label block mb-[5px]">{t('common:status')}</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.keys(HK_STATUSES).map((key) => (
              <option key={key} value={key}>{t(`status.${key}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label block mb-[5px]">{t('assign.staff')}</label>
          <select className="form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">— {t('unassigned')} —</option>
            {staff.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Board Tab ────────────────────────────────────────────────────────────────
function BoardTab({ rooms, onRoomClick, statusFilter, onStatusFilterChange }) {
  const { t } = useTranslation('housekeeping')
  const floors = [...new Set(rooms.map(r => r.floor))].sort()
  const shown = statusFilter ? STATUS_FILTERS[statusFilter] : null

  return (
    <div>
      <div className={`flex flex-wrap gap-2.5 ${statusFilter ? 'mb-3' : 'mb-3 xl:mb-0'}`}>
        <StatusFilterControl value={statusFilter} onChange={onStatusFilterChange} />
      </div>

      {/* Legend — statuses hidden by the filter are dimmed */}
      <div className="flex gap-x-[14px] gap-y-1.5 flex-wrap mb-4 sm:mb-5 px-3 sm:px-[14px] py-2.5 bg-surface2 rounded-lg border border-line">
        {Object.entries(HK_STATUSES).map(([key, val]) => (
          <div key={key} className={`flex items-center gap-[5px] ${shown && !shown.includes(key) ? 'opacity-35' : ''}`}>
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: val.color }} />
            <span className="text-xs text-ink2">{t(`status.${key}`)}</span>
          </div>
        ))}
      </div>

      {floors.length === 0 && (statusFilter
        ? <EmptyState icon="🔍" title={t('empty.noMatch')} />
        : <EmptyState icon="🧹" title={t('empty.noRooms')} message={t('empty.noRoomsHint')} />
      )}

      {floors.map(floor => {
        const floorRooms = rooms.filter(r => r.floor === floor)
        return (
          <div key={floor} className="mb-5 sm:mb-6 last:mb-0">
            <p className="t-title m-0 mb-2.5 tracking-[-0.01em] uppercase">
              {t('floorNo', { floor })}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
              {floorRooms.map(room => {
                const stKey = HK_STATUSES[room.status] ? room.status : 'clean_available'
                const st = HK_STATUSES[stKey]
                const stLabel = t(`status.${stKey}`)
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onRoomClick(room)}
                    title={`${t('roomNo', { number: room.number })} — ${stLabel}${room.assignedTo ? ` (${room.assignedTo})` : ''}`}
                    className="min-w-0 min-h-[64px] rounded-[7px] px-1.5 pt-[9px] pb-2 text-center cursor-pointer select-none
                               transition-[transform,box-shadow] duration-[130ms] hover:scale-[1.04] hover:shadow-[var(--shadow)] active:scale-[0.98]"
                    style={{
                      background: st.bg,
                      border: `1px solid ${st.color}30`,
                    }}
                  >
                    <p className="m-0 text-[13px] font-bold font-mono" style={{ color: st.text }}>{room.number}</p>
                    <p className="mt-0.5 text-xs font-medium opacity-80 truncate" style={{ color: st.text }}>
                      {stLabel}
                    </p>
                    {room.assignedTo && (
                      <div
                        className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-1 mx-auto mb-0"
                        style={{ background: st.color }}
                      >
                        {getInitials(room.assignedTo)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Daily List Tab ───────────────────────────────────────────────────────────
function DailyListTab({ rooms, allRooms = rooms, onUpdateRoom, staff, statusFilter, onStatusFilterChange }) {
  const { t } = useTranslation('housekeeping')
  const addToast = useToast()
  const [staffFilter, setStaffFilter] = useState('All')
  const [floorFilter, setFloorFilter] = useState('All')

  const filtered = useMemo(() => rooms.filter(r => {
    const staffOk = staffFilter === 'All' || r.assignedTo === staffFilter
    const floorOk = floorFilter === 'All' || String(r.floor) === floorFilter
    return staffOk && floorOk
  }), [rooms, staffFilter, floorFilter])

  function handleStart(room) {
    onUpdateRoom(room.id, { status: 'cleaning_in_progress', startedAt: new Date().toISOString() })
    addToast(t('toast.cleaningStarted', { number: room.number }), 'info')
  }

  function handleDone(room) {
    onUpdateRoom(room.id, { status: 'clean_available', completedAt: new Date().toISOString() })
    addToast(t('toast.markedClean', { number: room.number }), 'success')
  }

  function handleAssign(roomId, staff) {
    onUpdateRoom(roomId, { assignedTo: staff || null })
  }

  function calcDuration(start, end) {
    if (!start || !end) return '—'
    const mins = Math.round((new Date(end) - new Date(start)) / 60000)
    if (mins < 60) return t('duration.m', { m: mins })
    return t('duration.hm', { h: Math.floor(mins / 60), m: mins % 60 })
  }

  // Every floor stays selectable while the status filter hides some rooms.
  const floors = [...new Set(allRooms.map(r => r.floor))].sort()

  const columns = [
    {
      key: 'room', header: t('common:room'), primary: true,
      render: (room) => (
        <>
          <span className="font-bold text-[13px] text-ink font-mono">{room.number}</span>
          <span className="t-label ml-[5px]">{t('floorShort', { floor: room.floor })}</span>
        </>
      ),
    },
    {
      key: 'status', header: t('common:status'), primary: true,
      render: (room) => <Badge type={statusBadgeType(room.status)}>{t(`status.${HK_STATUSES[room.status] ? room.status : 'clean_available'}`)}</Badge>,
    },
    {
      key: 'assigned', header: t('daily.assignedTo'), className: 'md:min-w-[170px]',
      render: (room) => (
        <select
          aria-label={t('daily.assignAria', { number: room.number })}
          className="form-select w-full md:w-[150px] px-2 py-1 text-[12px]"
          value={room.assignedTo || ''}
          onChange={e => handleAssign(room.id, e.target.value)}
        >
          <option value="">— {t('unassigned')} —</option>
          {staff.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ),
    },
    { key: 'started', header: t('daily.startedAt'), hideOnMobile: true, render: (room) => <span className="t-xs text-ink3">{room.startedAt ? timeAgo(room.startedAt) : '—'}</span> },
    { key: 'completed', header: t('daily.completedAt'), hideOnMobile: true, render: (room) => <span className="t-xs text-ink3">{room.completedAt ? timeAgo(room.completedAt) : '—'}</span> },
    { key: 'duration', header: t('daily.duration'), hideOnMobile: true, render: (room) => <span className="text-[12px] text-ink2 font-semibold">{calcDuration(room.startedAt, room.completedAt)}</span> },
    {
      // Phones only (the table, md+, has a column each): started / completed / duration in one cell
      key: 'timing', header: t('daily.timing'), mobileOnly: true,
      render: (room) => (
        <span className="t-xs text-ink3 leading-relaxed">
          {room.startedAt ? timeAgo(room.startedAt) : '—'} · {room.completedAt ? timeAgo(room.completedAt) : '—'}
          {room.startedAt && room.completedAt && <span className="text-ink2 font-semibold"> ({calcDuration(room.startedAt, room.completedAt)})</span>}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (room) => {
        const canStart = room.status !== 'cleaning_in_progress' && room.status !== 'clean_available'
        const canDone = room.status === 'cleaning_in_progress' || room.status === 'dirty_available'
        if (!canStart && !canDone) return <span className="hidden md:inline text-ink3">—</span>
        return (
          <div className="flex gap-1.5 justify-end">
            {canStart && <button className="btn btn-outline btn-sm" onClick={() => handleStart(room)}>{t('daily.start')}</button>}
            {canDone && <button className="btn btn-success btn-sm" onClick={() => handleDone(room)}>{t('daily.done')}</button>}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-2 sm:flex gap-2.5 sm:gap-4 mb-4 sm:flex-wrap">
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
          <label className="form-label whitespace-nowrap">{t('daily.staff')}</label>
          <select className="form-select w-full sm:w-40" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="All">{t('daily.allStaff')}</option>
            {staff.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
          <label className="form-label whitespace-nowrap">{t('daily.floor')}</label>
          <select className="form-select w-full sm:w-[120px]" value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
            <option value="All">{t('daily.allFloors')}</option>
            {floors.map(f => <option key={f} value={String(f)}>{t('floorNo', { floor: f })}</option>)}
          </select>
        </div>
        <StatusFilterControl value={statusFilter} onChange={onStatusFilterChange} className="col-span-2" />
      </div>

      <div className="-mx-4 sm:-mx-5 border-t border-line">
        <DataTable
          columns={columns}
          rows={filtered}
          empty={<EmptyState icon="🔍" title={t('empty.noMatch')} />}
        />
      </div>
    </div>
  )
}

// ─── Linen Tracker Tab ────────────────────────────────────────────────────────
function LinenTrackerTab({ rooms, linenByRoom, onMarkChanged }) {
  const { t } = useTranslation('housekeeping')
  const due = (room) => linenByRoom[room.id]?.nextDue || null
  const columns = [
    { key: 'room', header: t('common:room'), primary: true, render: (room) => <span className="font-bold text-[13px] text-ink font-mono">{room.number}</span> },
    { key: 'last', header: t('linen.lastChanged'), render: (room) => <span className="t-xs text-ink3">{linenByRoom[room.id] ? formatDate(linenByRoom[room.id].lastChanged) : '—'}</span> },
    {
      key: 'next', header: t('linen.nextDue'),
      render: (room) => <span className="text-[12.5px] font-semibold" style={{ color: linenDueColor(due(room)) }}>{due(room) ? formatDate(due(room)) : '—'}</span>,
    },
    {
      key: 'days', header: t('linen.daysUntilDue'),
      render: (room) => {
        const nextDue = due(room)
        const diff = nextDue ? Math.floor((new Date(nextDue) - Date.now()) / 86400000) : null
        return (
          <span className="text-[12.5px] font-bold" style={{ color: linenDueColor(nextDue) }}>
            {diff === null ? '—' : diff < 0 ? t('linen.daysOverdue', { count: Math.abs(diff) }) : diff === 0 ? t('common:today') : t('days', { count: diff })}
          </span>
        )
      },
    },
    { key: 'status', header: t('common:status'), primary: true, render: (room) => <Badge type={linenDueBadge(due(room))}>{linenDueLabel(due(room), t)}</Badge> },
    { key: 'by', header: t('linen.changedBy'), render: (room) => <span className="text-[12.5px]">{linenByRoom[room.id]?.changedBy || '—'}</span> },
    {
      key: 'action', header: '', align: 'right',
      render: (room) => <button className="btn btn-outline btn-sm" onClick={() => onMarkChanged(room)}>{t('linen.markChanged')}</button>,
    },
  ]

  return (
    <div className="-mx-4 sm:-mx-5">
      <DataTable
        columns={columns}
        rows={rooms}
        empty={<EmptyState icon="🛏" title={t('empty.noRooms')} />}
      />
    </div>
  )
}

// Session inspection history (cards on phones).
const historyColumns = (t) => [
  { key: 'date', header: t('common:date'), primary: true, render: (h) => <span className="t-xs">{formatDate(h.date)}</span> },
  { key: 'staff', header: t('daily.staff'), render: (h) => <span className="t-xs">{h.you ? t('inspection.you') : h.staff}</span> },
  { key: 'pass', header: t('inspection.pass'), render: (h) => <span className="text-[12px] font-semibold text-success-text">{h.pass}</span> },
  { key: 'fail', header: t('inspection.fail'), render: (h) => <span className={`text-[12px] font-semibold ${h.fail > 0 ? 'text-danger-text' : 'text-ink3'}`}>{h.fail}</span> },
  {
    key: 'score', header: t('inspection.score'), primary: true,
    render: (h) => {
      const score = Math.round((h.pass / h.total) * 100)
      return <Badge type={score >= 90 ? 'green' : score >= 70 ? 'amber' : 'red'}>{score}%</Badge>
    },
  },
]

// ─── Inspection Tab ───────────────────────────────────────────────────────────
function InspectionTab({ rooms, onSubmit }) {
  const { t } = useTranslation('housekeeping')
  const [pickedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '')
  const [checklist, setChecklist] = useState({}) // { item: 'pass' | 'fail' | null }
  const [history, setHistory] = useState({})     // session-only; no GET endpoint exists

  // Keep a valid selection as rooms load in (derived, so no effect is needed).
  const selectedRoomId = pickedRoomId || rooms[0]?.id || ''

  const selectedRoom = rooms.find(r => r.id === selectedRoomId)
  const roomHistory = history[selectedRoomId] || []

  function toggleItem(item, result) {
    setChecklist(c => {
      const current = c[item]
      return { ...c, [item]: current === result ? null : result }
    })
  }

  const allChecked = CHECKLIST_ITEMS.every(item => checklist[item] !== undefined && checklist[item] !== null)
  const passCount = CHECKLIST_ITEMS.filter(item => checklist[item] === 'pass').length
  const failCount = CHECKLIST_ITEMS.filter(item => checklist[item] === 'fail').length

  async function handleSubmit() {
    if (!allChecked || !selectedRoom) return
    const checklistPayload = CHECKLIST_ITEMS.map(item => ({ item, result: checklist[item] }))
    const ok = await onSubmit(selectedRoom, checklistPayload, { passCount, failCount })
    if (!ok) return
    const result = {
      id: `${selectedRoomId}-h${passCount}-${failCount}-${roomHistory.length}`,
      date: new Date().toISOString().split('T')[0],
      you: true,
      pass: passCount,
      fail: failCount,
      total: CHECKLIST_ITEMS.length,
    }
    setHistory(h => ({ ...h, [selectedRoomId]: [result, ...(h[selectedRoomId] || [])] }))
    setChecklist({})
  }

  function handleRoomChange(id) {
    setSelectedRoomId(id)
    setChecklist({})
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Left: Checklist */}
      <div className="min-w-0">
        <div className="mb-4">
          <label className="form-label block mb-1.5">{t('inspection.selectRoom')}</label>
          <select
            className="form-select w-full sm:max-w-[240px]"
            value={selectedRoomId}
            onChange={e => handleRoomChange(e.target.value)}
          >
            {rooms.map(r => <option key={r.id} value={r.id}>{t('roomNo', { number: r.number })}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title min-w-0">{t('inspection.checklistTitle', { number: selectedRoom?.number ?? '' })}</span>
            <span className="text-xs text-ink3 shrink-0">
              {CHECKLIST_ITEMS.filter(i => checklist[i]).length} / {CHECKLIST_ITEMS.length}
            </span>
          </div>
          <div className="px-0 py-2.5">
            {CHECKLIST_ITEMS.map(item => {
              const val = checklist[item] || null
              return (
                <div key={item} className="flex items-center justify-between px-4 py-[9px] border-b border-line gap-2.5">
                  <span className="t-sm text-ink2 min-w-0">{t(`checklist.${item}`, item)}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      className={`t-title w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-md border-none cursor-pointer transition-all duration-[130ms] flex items-center justify-center ${val === 'pass' ? 'bg-success-bg text-success-text outline outline-2 outline-success' : 'bg-surface2 text-ink3 outline-none'}`}
                      onClick={() => toggleItem(item, 'pass')}
                      title={t('inspection.pass')}
                      aria-label={t('inspection.pass')}
                    >✓</button>
                    <button
                      type="button"
                      className={`t-title w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-md border-none cursor-pointer transition-all duration-[130ms] flex items-center justify-center ${val === 'fail' ? 'bg-danger-bg text-danger-text outline outline-2 outline-danger' : 'bg-surface2 text-ink3 outline-none'}`}
                      onClick={() => toggleItem(item, 'fail')}
                      title={t('inspection.fail')}
                      aria-label={t('inspection.fail')}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Score preview */}
          <div className="px-4 py-3 border-t border-line">
            <div className="t-xs flex flex-wrap justify-between gap-x-3 mb-1.5">
              <span className="text-success-text font-semibold">{t('inspection.pass')}: {passCount}</span>
              <span className="text-danger-text font-semibold">{t('inspection.fail')}: {failCount}</span>
              <span className="text-ink3">{t('inspection.unchecked')}: {CHECKLIST_ITEMS.length - passCount - failCount}</span>
            </div>
            <div className="prog-bar">
              <div
                className="prog-fill"
                style={{
                  width: `${CHECKLIST_ITEMS.length ? (passCount / CHECKLIST_ITEMS.length) * 100 : 0}%`,
                  background: passCount / CHECKLIST_ITEMS.length >= 0.8 ? 'var(--green)' : 'var(--amber)',
                }}
              />
            </div>
          </div>

          <div className="px-4 pt-2.5 pb-4">
            <button
              className={`btn btn-primary w-full justify-center ${allChecked ? 'opacity-100' : 'opacity-50'}`}
              onClick={handleSubmit}
              disabled={!allChecked}
            >
              {t('inspection.submit')}
            </button>
            {!allChecked && (
              <p className="t-xs mt-1.5 text-ink3 text-center">
                {t('inspection.checkAll')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: History (this session) */}
      <div className="min-w-0">
        <p className="t-label m-0 mb-2.5">
          {t('inspection.historyTitle', { number: selectedRoom?.number ?? '' })}
        </p>
        {roomHistory.length === 0 ? (
          <div className="card">
            <EmptyState icon="✓" title={t('inspection.emptyTitle')} message={t('inspection.emptyMessage')} />
          </div>
        ) : (
          <TableCard>
            <DataTable columns={historyColumns(t)} rows={roomHistory} />
          </TableCard>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Housekeeping() {
  const { t } = useTranslation('housekeeping')
  const addToast = useToast()
  const currentUser = useAppSelector(s => s.auth.currentUser)
  const [rooms, setRooms] = useState([])
  const [staff, setStaff] = useState([])
  const [linenByRoom, setLinenByRoom] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState('board')
  const [assignRoomTarget, setAssignRoomTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null) // null | keyof STATUS_FILTERS

  const loadBoard = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const { data } = await housekeepingApi.getBoard()
      const list = Array.isArray(data) ? data : (data.rooms || [])
      setRooms(list.map(mapBoardRoom))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await usersApi.getAll()
      const list = Array.isArray(data) ? data : (data.users || [])
      const names = list
        .filter(u => u.status === 'active')
        .map(u => u.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
      setStaff(names)
    } catch {
      /* staff list is non-critical; leave empty on failure */
    }
  }, [])

  const loadLinen = useCallback(async () => {
    try {
      const { data } = await housekeepingApi.getLinen()
      const records = Array.isArray(data) ? data : (data.records || [])
      // Keep the most-recently-changed record per room.
      const byRoom = {}
      for (const rec of records) {
        const prev = byRoom[rec.roomId]
        if (!prev || new Date(rec.lastChanged) > new Date(prev.lastChanged)) byRoom[rec.roomId] = rec
      }
      setLinenByRoom(byRoom)
    } catch {
      /* linen is non-critical; leave empty on failure */
    }
  }, [])

  useEffect(() => { loadBoard(); loadLinen(); loadStaff() }, [loadBoard, loadLinen, loadStaff])

  // Stat counts
  const cleanCount    = rooms.filter(r => r.status === 'clean_available').length
  const dirtyCount    = rooms.filter(r => r.status === 'dirty_available' || r.status === 'checkout_pending').length
  const cleaningCount = rooms.filter(r => r.status === 'cleaning_in_progress').length

  // Rooms the Board and Daily List show under the status filter.
  const filteredRooms = useMemo(
    () => (statusFilter ? rooms.filter(r => STATUS_FILTERS[statusFilter].includes(r.status)) : rooms),
    [rooms, statusFilter],
  )

  // A card toggles its filter; the filter lives on the Board/Daily List, so
  // from Linen or Inspection it jumps to the Board.
  function handleStatCard(id) {
    const next = statusFilter === id ? null : id
    setStatusFilter(next)
    if (next && activeTab !== 'board' && activeTab !== 'daily') setActiveTab('board')
  }

  // Persist a room status/assignment change, with optimistic UI.
  const handleUpdateRoom = useCallback(async (id, patch) => {
    const prev = rooms
    setRooms(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    try {
      await housekeepingApi.updateStatus(id, patch)
    } catch {
      setRooms(prev)
      addToast(t('toast.saveFailed'), 'error')
    }
  }, [rooms, addToast, t])

  async function handleAssignSave(id, patch) {
    await handleUpdateRoom(id, patch)
    const room = rooms.find(r => r.id === id)
    addToast(t('toast.roomUpdated', { number: room?.number }), 'success')
    setAssignRoomTarget(null)
  }

  async function handleBulk(fromStatus, toStatus) {
    const targets = rooms.filter(r => (Array.isArray(fromStatus) ? fromStatus.includes(r.status) : r.status === fromStatus))
    if (targets.length === 0) { addToast(t('toast.noMatching'), 'info'); return }
    await Promise.all(targets.map(r => handleUpdateRoom(r.id, { status: toStatus })))
    addToast(t('toast.bulkMarked', { count: targets.length, status: t(`status.${toStatus}`) }), 'success')
  }

  async function handleMarkLinenChanged(room) {
    try {
      await housekeepingApi.markLinen(room.id, { changedBy: currentUser?.name || 'Front Desk', frequency: 7 })
      addToast(t('toast.linenChanged', { number: room.number }), 'success')
      loadLinen()
    } catch {
      addToast(t('toast.linenFailed'), 'error')
    }
  }

  async function handleSubmitInspection(room, checklistPayload, { passCount }) {
    try {
      await housekeepingApi.submitInspection({
        roomId: room.id,
        staffId: currentUser?.id || 'front-desk',
        checklist: JSON.stringify(checklistPayload),
      })
      const score = Math.round((passCount / CHECKLIST_ITEMS.length) * 100)
      addToast(t('toast.inspectionSaved', { score }), score >= 80 ? 'success' : 'warning')
      return true
    } catch {
      addToast(t('toast.inspectionFailed'), 'error')
      return false
    }
  }

  const tabs = [
    { id: 'board',      label: t('tabs.board') },
    { id: 'daily',      label: t('tabs.daily') },
    { id: 'linen',      label: t('tabs.linen') },
    { id: 'inspection', label: t('tabs.inspection') },
  ]

  const markCheckoutsDirty = () => handleBulk('checkout_pending', 'dirty_available')
  const markDirtyInProgress = () => handleBulk('dirty_available', 'cleaning_in_progress')

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      stats={(
        <>
          {[
            { id: 'clean', label: t('stats.clean'), value: cleanCount, hint: t('stats.cleanHint'), icon: <LuSparkles />, tone: 'green' },
            { id: 'dirty', label: t('stats.dirty'), value: dirtyCount, hint: t('stats.dirtyHint'), icon: <LuSprayCan />, tone: 'amber' },
            { id: 'cleaning', label: t('stats.cleaning'), value: cleaningCount, hint: t('stats.cleaningHint'), icon: <LuLoader />, tone: 'blue' },
          ].map(({ id, ...st }) => (
            <StatCard key={id} {...st} selected={statusFilter === id} onClick={() => handleStatCard(id)} />
          ))}
        </>
      )}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: loadBoard },
        {
          id: 'bulk', label: t('bulk.label'), icon: <LuLayers />,
          menu: [
            { id: 'checkouts-dirty', label: t('bulk.checkoutsDirty'), icon: <LuSprayCan />, onClick: markCheckoutsDirty },
            { id: 'dirty-progress', label: t('bulk.dirtyInProgress'), icon: <LuBrush />, onClick: markDirtyInProgress },
          ],
        },
      ]}
    >
      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {t('loadFailed')}
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
            <div data-tab-id="board">
              {loading && rooms.length === 0
                ? <EmptyState icon="◌" title={t('loadingBoard')} />
                : <BoardTab rooms={filteredRooms} onRoomClick={setAssignRoomTarget}
                    statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />}
            </div>

            <div data-tab-id="daily">
              <DailyListTab rooms={filteredRooms} allRooms={rooms} onUpdateRoom={handleUpdateRoom} staff={staff}
                statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
            </div>

            <div data-tab-id="linen">
              <LinenTrackerTab rooms={rooms} linenByRoom={linenByRoom} onMarkChanged={handleMarkLinenChanged} />
            </div>

            <div data-tab-id="inspection">
              <InspectionTab rooms={rooms} onSubmit={handleSubmitInspection} />
            </div>
          </Tabs>
        </div>
      </div>

      {/* Room Assignment Modal */}
      {assignRoomTarget && (
        <AssignRoomModal
          room={assignRoomTarget}
          onClose={() => setAssignRoomTarget(null)}
          onSave={handleAssignSave}
          staff={staff}
        />
      )}
    </PageWrapper>
  )
}
