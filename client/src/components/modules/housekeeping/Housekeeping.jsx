import { useState, useMemo, useEffect, useCallback } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { useAppSelector } from '../../../store/hooks'
import { housekeepingApi } from '../../../api/client'
import { formatDate, timeAgo } from '../../../utils/format'

// ─── Status config ──────────────────────────────────────────────────────────
const HK_STATUSES = {
  clean_available:     { label: 'Clean',       color: 'var(--green)',     bg: 'var(--green-bg)',  text: 'var(--green-text)' },
  dirty_available:     { label: 'Dirty',       color: 'var(--amber)',     bg: 'var(--amber-bg)',  text: 'var(--amber-text)' },
  occupied:            { label: 'Occupied',    color: 'var(--red)',       bg: 'var(--red-bg)',    text: 'var(--red-text)' },
  checkout_pending:    { label: 'Checkout',    color: '#f97316',          bg: '#fff7ed',          text: '#c2410c' },
  cleaning_in_progress:{ label: 'Cleaning',   color: 'var(--blue)',      bg: 'var(--blue-bg)',   text: 'var(--blue-text)' },
  maintenance:         { label: 'Maintenance', color: 'var(--grey-text)', bg: 'var(--grey-bg)',   text: 'var(--grey-text)' },
}

const HK_STAFF = ['Priya Desai', 'Meena Kumari', 'Sunita Rao', 'Rekha Singh', 'Anita Joshi']

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

function linenDueLabel(nextDue) {
  if (!nextDue) return '—'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return 'Overdue'
  if (diff === 0) return 'Due Today'
  return `${diff}d`
}

// ─── Room Assignment Modal ────────────────────────────────────────────────────
function AssignRoomModal({ room, onClose, onSave }) {
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
      title={`Room ${room.number} — Update`}
      maxWidth="420px"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div>
          <label className="form-label block mb-[5px]">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(HK_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label block mb-[5px]">Assign Staff</label>
          <select className="form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">— Unassigned —</option>
            {HK_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Board Tab ────────────────────────────────────────────────────────────────
function BoardTab({ rooms, onRoomClick }) {
  const floors = [...new Set(rooms.map(r => r.floor))].sort()

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-[14px] flex-wrap mb-5 px-[14px] py-2.5 bg-surface2 rounded-lg border border-line">
        {Object.entries(HK_STATUSES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-[5px]">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: val.color }} />
            <span className="text-[11.5px] text-ink2">{val.label}</span>
          </div>
        ))}
      </div>

      {floors.map(floor => {
        const floorRooms = rooms.filter(r => r.floor === floor)
        return (
          <div key={floor} className="mb-6">
            <p className="t-title m-0 mb-2.5 tracking-[-0.01em] uppercase">
              Floor {floor}
            </p>
            <div className="grid grid-cols-8 gap-2">
              {floorRooms.map(room => {
                const st = HK_STATUSES[room.status] || HK_STATUSES.clean_available
                return (
                  <div
                    key={room.id}
                    onClick={() => onRoomClick(room)}
                    title={`Room ${room.number} — ${st.label}${room.assignedTo ? ` (${room.assignedTo})` : ''}`}
                    className="rounded-[7px] px-1.5 pt-[9px] pb-2 text-center cursor-pointer transition-[transform,box-shadow] duration-[130ms] select-none"
                    style={{
                      background: st.bg,
                      border: `1px solid ${st.color}30`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.04)'
                      e.currentTarget.style.boxShadow = 'var(--shadow)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <p className="m-0 text-[12px] font-bold" style={{ fontFamily: 'var(--font-mono)', color: st.text }}>{room.number}</p>
                    <p className="mt-0.5 text-[9.5px] font-medium opacity-75" style={{ color: st.text }}>
                      {st.label.slice(0, 4)}
                    </p>
                    {room.assignedTo && (
                      <div
                        className="w-5 h-5 rounded-full text-white text-[8px] font-bold flex items-center justify-center mt-1 mx-auto mb-0"
                        style={{ background: st.color }}
                      >
                        {getInitials(room.assignedTo)}
                      </div>
                    )}
                  </div>
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
function DailyListTab({ rooms, onUpdateRoom }) {
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
    addToast(`Room ${room.number} cleaning started`, 'info')
  }

  function handleDone(room) {
    onUpdateRoom(room.id, { status: 'clean_available', completedAt: new Date().toISOString() })
    addToast(`Room ${room.number} marked clean`, 'success')
  }

  function handleAssign(roomId, staff) {
    onUpdateRoom(roomId, { assignedTo: staff || null })
  }

  function calcDuration(start, end) {
    if (!start || !end) return '—'
    const mins = Math.round((new Date(end) - new Date(start)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const floors = [...new Set(rooms.map(r => r.floor))].sort()

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="form-label whitespace-nowrap">Staff</label>
          <select className="form-select w-40" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="All">All Staff</option>
            {HK_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="form-label whitespace-nowrap">Floor</label>
          <select className="form-select w-[110px]" value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
            <option value="All">All Floors</option>
            {floors.map(f => <option key={f} value={String(f)}>Floor {f}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="t-display m-0 mb-1.5">🔍</p>
          <p className="m-0 font-semibold text-ink2">No rooms match filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Started At</th>
                <th>Completed At</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(room => {
                const st = HK_STATUSES[room.status] || HK_STATUSES.clean_available
                return (
                  <tr key={room.id}>
                    <td>
                      <span className="font-bold text-[12.5px] text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                        {room.number}
                      </span>
                      <span className="t-label ml-[5px]">F{room.floor}</span>
                    </td>
                    <td>
                      <Badge type={statusBadgeType(room.status)}>{st.label}</Badge>
                    </td>
                    <td>
                      <select
                        className="form-select w-[150px] px-2 py-1 text-[12px]"
                        value={room.assignedTo || ''}
                        onChange={e => handleAssign(room.id, e.target.value)}
                      >
                        <option value="">— Unassigned —</option>
                        {HK_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="t-xs text-ink3">
                      {room.startedAt ? timeAgo(room.startedAt) : '—'}
                    </td>
                    <td className="t-xs text-ink3">
                      {room.completedAt ? timeAgo(room.completedAt) : '—'}
                    </td>
                    <td className="text-[12px] text-ink2 font-semibold">
                      {calcDuration(room.startedAt, room.completedAt)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {room.status !== 'cleaning_in_progress' && room.status !== 'clean_available' && (
                          <button className="btn btn-outline btn-xs" onClick={() => handleStart(room)}>Start</button>
                        )}
                        {(room.status === 'cleaning_in_progress' || room.status === 'dirty_available') && (
                          <button className="btn btn-success btn-xs" onClick={() => handleDone(room)}>Done</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Linen Tracker Tab ────────────────────────────────────────────────────────
function LinenTrackerTab({ rooms, linenByRoom, onMarkChanged }) {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Room</th>
            <th>Last Changed</th>
            <th>Next Due</th>
            <th>Days Until Due</th>
            <th>Status</th>
            <th>Changed By</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(room => {
            const rec = linenByRoom[room.id]
            const nextDue = rec?.nextDue || null
            const diff = nextDue ? Math.floor((new Date(nextDue) - Date.now()) / 86400000) : null
            return (
              <tr key={room.id}>
                <td>
                  <span className="font-bold text-[12.5px] text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                    {room.number}
                  </span>
                </td>
                <td className="t-xs text-ink3">{rec ? formatDate(rec.lastChanged) : '—'}</td>
                <td className="text-[12.5px] font-semibold" style={{ color: linenDueColor(nextDue) }}>
                  {nextDue ? formatDate(nextDue) : '—'}
                </td>
                <td className="text-[12.5px] font-bold" style={{ color: linenDueColor(nextDue) }}>
                  {diff === null ? '—' : diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `${diff}d`}
                </td>
                <td>
                  <Badge type={linenDueBadge(nextDue)}>{linenDueLabel(nextDue)}</Badge>
                </td>
                <td className="text-[12.5px]">{rec?.changedBy || '—'}</td>
                <td>
                  <button className="btn btn-outline btn-xs" onClick={() => onMarkChanged(room)}>
                    Mark Changed
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Inspection Tab ───────────────────────────────────────────────────────────
function InspectionTab({ rooms, onSubmit }) {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '')
  const [checklist, setChecklist] = useState({}) // { item: 'pass' | 'fail' | null }
  const [history, setHistory] = useState({})     // session-only; no GET endpoint exists

  // Keep a valid selection as rooms load in.
  useEffect(() => {
    if (!selectedRoomId && rooms[0]) setSelectedRoomId(rooms[0].id)
  }, [rooms, selectedRoomId])

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
      staff: 'You',
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
    <div className="grid grid-cols-2 gap-5 items-start">
      {/* Left: Checklist */}
      <div>
        <div className="mb-4">
          <label className="form-label block mb-1.5">Select Room</label>
          <select
            className="form-select max-w-[200px]"
            value={selectedRoomId}
            onChange={e => handleRoomChange(e.target.value)}
          >
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Inspection Checklist — Room {selectedRoom?.number}</span>
            <span className="text-[11.5px] text-ink3">
              {CHECKLIST_ITEMS.filter(i => checklist[i]).length} / {CHECKLIST_ITEMS.length}
            </span>
          </div>
          <div className="px-0 py-2.5">
            {CHECKLIST_ITEMS.map(item => {
              const val = checklist[item] || null
              return (
                <div key={item} className="flex items-center justify-between px-4 py-[9px] border-b border-line gap-2.5">
                  <span className="t-sm text-ink2">{item}</span>
                  <div className="flex gap-[5px]">
                    <button
                      type="button"
                      className={`t-title w-7 h-7 rounded-md border-none cursor-pointer transition-all duration-[130ms] flex items-center justify-center ${val === 'pass' ? 'bg-success-bg text-success-text outline outline-2 outline-success' : 'bg-surface2 text-ink3 outline-none'}`}
                      onClick={() => toggleItem(item, 'pass')}
                      title="Pass"
                    >✓</button>
                    <button
                      type="button"
                      className={`t-title w-7 h-7 rounded-md border-none cursor-pointer transition-all duration-[130ms] flex items-center justify-center ${val === 'fail' ? 'bg-danger-bg text-danger-text outline outline-2 outline-danger' : 'bg-surface2 text-ink3 outline-none'}`}
                      onClick={() => toggleItem(item, 'fail')}
                      title="Fail"
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Score preview */}
          <div className="px-4 py-3 border-t border-line">
            <div className="t-xs flex justify-between mb-1.5">
              <span className="text-success-text font-semibold">Pass: {passCount}</span>
              <span className="text-danger-text font-semibold">Fail: {failCount}</span>
              <span className="text-ink3">Unchecked: {CHECKLIST_ITEMS.length - passCount - failCount}</span>
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
              Submit Inspection
            </button>
            {!allChecked && (
              <p className="t-xs mt-1.5 text-ink3 text-center">
                Check all items before submitting
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: History (this session) */}
      <div>
        <p className="t-label m-0 mb-2.5">
          Inspection History — Room {selectedRoom?.number}
        </p>
        {roomHistory.length === 0 ? (
          <div className="empty-state">
            <p className="t-sm m-0 text-ink3">No inspections submitted this session.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff</th>
                  <th>Pass</th>
                  <th>Fail</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {roomHistory.map(h => {
                  const score = Math.round((h.pass / h.total) * 100)
                  return (
                    <tr key={h.id}>
                      <td className="t-xs">{formatDate(h.date)}</td>
                      <td className="t-xs">{h.staff}</td>
                      <td>
                        <span className="text-[12px] font-semibold text-success-text">{h.pass}</span>
                      </td>
                      <td>
                        <span className={`text-[12px] font-semibold ${h.fail > 0 ? 'text-danger-text' : 'text-ink3'}`}>
                          {h.fail}
                        </span>
                      </td>
                      <td>
                        <Badge type={score >= 90 ? 'green' : score >= 70 ? 'amber' : 'red'}>
                          {score}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Housekeeping() {
  const addToast = useToast()
  const currentUser = useAppSelector(s => s.auth.currentUser)
  const [rooms, setRooms] = useState([])
  const [linenByRoom, setLinenByRoom] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('board')
  const [assignRoomTarget, setAssignRoomTarget] = useState(null)

  const loadBoard = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await housekeepingApi.getBoard()
      const list = Array.isArray(data) ? data : (data.rooms || [])
      setRooms(list.map(mapBoardRoom))
    } catch {
      setError('Could not load housekeeping board. Make sure the backend is running.')
    } finally {
      setLoading(false)
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

  useEffect(() => { loadBoard(); loadLinen() }, [loadBoard, loadLinen])

  // Stat counts
  const cleanCount    = rooms.filter(r => r.status === 'clean_available').length
  const dirtyCount    = rooms.filter(r => r.status === 'dirty_available' || r.status === 'checkout_pending').length
  const cleaningCount = rooms.filter(r => r.status === 'cleaning_in_progress').length

  // Persist a room status/assignment change, with optimistic UI.
  const handleUpdateRoom = useCallback(async (id, patch) => {
    const prev = rooms
    setRooms(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    try {
      await housekeepingApi.updateStatus(id, patch)
    } catch {
      setRooms(prev)
      addToast('Could not save room update', 'error')
    }
  }, [rooms, addToast])

  async function handleAssignSave(id, patch) {
    await handleUpdateRoom(id, patch)
    const room = rooms.find(r => r.id === id)
    addToast(`Room ${room?.number} updated`, 'success')
    setAssignRoomTarget(null)
  }

  async function handleBulk(fromStatus, toStatus, label) {
    const targets = rooms.filter(r => (Array.isArray(fromStatus) ? fromStatus.includes(r.status) : r.status === fromStatus))
    if (targets.length === 0) { addToast('No matching rooms found', 'info'); return }
    await Promise.all(targets.map(r => handleUpdateRoom(r.id, { status: toStatus })))
    addToast(`${targets.length} room(s) ${label}`, 'success')
  }

  async function handleMarkLinenChanged(room) {
    try {
      await housekeepingApi.markLinen(room.id, { changedBy: currentUser?.name || 'Front Desk', frequency: 7 })
      addToast(`Linen changed for Room ${room.number}`, 'success')
      loadLinen()
    } catch {
      addToast('Could not record linen change', 'error')
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
      addToast(`Inspection saved — Score: ${score}%`, score >= 80 ? 'success' : 'warning')
      return true
    } catch {
      addToast('Could not save inspection', 'error')
      return false
    }
  }

  const tabs = [
    { id: 'board',      label: 'Board' },
    { id: 'daily',      label: 'Daily List' },
    { id: 'linen',      label: 'Linen Tracker' },
    { id: 'inspection', label: 'Inspection' },
  ]

  return (
    <div className="overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.03em]">
            🧹 Housekeeping
          </h1>
          <p className="t-sm mt-1 text-ink3">
            Manage room status, staff assignments, and inspections
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-outline btn-sm" onClick={loadBoard} disabled={loading}>↻ Refresh</button>
          <button className="btn btn-outline btn-sm" onClick={() => handleBulk('checkout_pending', 'dirty_available', 'marked Dirty')}>
            Mark Checkouts as Dirty
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => handleBulk('dirty_available', 'cleaning_in_progress', 'marked Cleaning')}>
            Mark All Dirty → In Progress
          </button>
        </div>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-[14px] mb-6">
        <div className="stat-card stat-bar-green">
          <p className="t-label m-0">Clean Available</p>
          <p className="t-display mt-1.5 text-success-text tracking-[-0.03em]">{cleanCount}</p>
          <p className="t-xs mt-0.5 text-ink3">Ready for check-in</p>
        </div>
        <div className="stat-card stat-bar-amber">
          <p className="t-label m-0">Dirty / Needs Cleaning</p>
          <p className="t-display mt-1.5 text-warning-text tracking-[-0.03em]">{dirtyCount}</p>
          <p className="t-xs mt-0.5 text-ink3">Dirty + checkout pending</p>
        </div>
        <div className="stat-card stat-bar-blue">
          <p className="t-label m-0">Cleaning In Progress</p>
          <p className="t-display mt-1.5 text-info-text tracking-[-0.03em]">{cleaningCount}</p>
          <p className="t-xs mt-0.5 text-ink3">Currently being cleaned</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="px-[18px] py-0">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
            <div data-tab-id="board">
              {loading && rooms.length === 0
                ? <div className="empty-state"><p className="m-0 text-ink3">Loading board…</p></div>
                : <BoardTab rooms={rooms} onRoomClick={setAssignRoomTarget} />}
            </div>

            <div data-tab-id="daily">
              <DailyListTab rooms={rooms} onUpdateRoom={handleUpdateRoom} />
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
        />
      )}
    </div>
  )
}
