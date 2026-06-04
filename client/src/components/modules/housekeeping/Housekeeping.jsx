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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(HK_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Assign Staff</label>
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
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {Object.entries(HK_STATUSES).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: val.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{val.label}</span>
          </div>
        ))}
      </div>

      {floors.map(floor => {
        const floorRooms = rooms.filter(r => r.floor === floor)
        return (
          <div key={floor} style={{ marginBottom: 24 }}>
            <p style={{
              margin: '0 0 10px',
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}>
              Floor {floor}
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 8,
            }}>
              {floorRooms.map(room => {
                const st = HK_STATUSES[room.status] || HK_STATUSES.clean_available
                return (
                  <div
                    key={room.id}
                    onClick={() => onRoomClick(room)}
                    title={`Room ${room.number} — ${st.label}${room.assignedTo ? ` (${room.assignedTo})` : ''}`}
                    style={{
                      background: st.bg,
                      border: `1px solid ${st.color}30`,
                      borderRadius: 7,
                      padding: '9px 6px 8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.13s, box-shadow 0.13s',
                      userSelect: 'none',
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
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: st.text }}>{room.number}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 9.5, fontWeight: 500, color: st.text, opacity: 0.75 }}>
                      {st.label.slice(0, 4)}
                    </p>
                    {room.assignedTo && (
                      <div style={{
                        marginTop: 4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: st.color,
                        color: '#fff',
                        fontSize: 8,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '4px auto 0',
                      }}>
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Staff</label>
          <select className="form-select" value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ width: 160 }}>
            <option value="All">All Staff</option>
            {HK_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Floor</label>
          <select className="form-select" value={floorFilter} onChange={e => setFloorFilter(e.target.value)} style={{ width: 110 }}>
            <option value="All">All Floors</option>
            {floors.map(f => <option key={f} value={String(f)}>Floor {f}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 30, margin: '0 0 6px' }}>🔍</p>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No rooms match filters</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
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
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                        {room.number}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 5 }}>F{room.floor}</span>
                    </td>
                    <td>
                      <Badge type={statusBadgeType(room.status)}>{st.label}</Badge>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={room.assignedTo || ''}
                        onChange={e => handleAssign(room.id, e.target.value)}
                        style={{ width: 150, padding: '4px 8px', fontSize: 12 }}
                      >
                        <option value="">— Unassigned —</option>
                        {HK_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {room.startedAt ? timeAgo(room.startedAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {room.completedAt ? timeAgo(room.completedAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {calcDuration(room.startedAt, room.completedAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
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
    <div style={{ overflowX: 'auto' }}>
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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                    {room.number}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{rec ? formatDate(rec.lastChanged) : '—'}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600, color: linenDueColor(nextDue) }}>
                  {nextDue ? formatDate(nextDue) : '—'}
                </td>
                <td style={{ fontSize: 12.5, fontWeight: 700, color: linenDueColor(nextDue) }}>
                  {diff === null ? '—' : diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `${diff}d`}
                </td>
                <td>
                  <Badge type={linenDueBadge(nextDue)}>{linenDueLabel(nextDue)}</Badge>
                </td>
                <td style={{ fontSize: 12.5 }}>{rec?.changedBy || '—'}</td>
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Checklist */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Select Room</label>
          <select
            className="form-select"
            value={selectedRoomId}
            onChange={e => handleRoomChange(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Inspection Checklist — Room {selectedRoom?.number}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              {CHECKLIST_ITEMS.filter(i => checklist[i]).length} / {CHECKLIST_ITEMS.length}
            </span>
          </div>
          <div style={{ padding: '10px 0' }}>
            {CHECKLIST_ITEMS.map(item => {
              const val = checklist[item] || null
              return (
                <div key={item} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 16px',
                  borderBottom: '1px solid var(--border)',
                  gap: 10,
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item, 'pass')}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: val === 'pass' ? 'var(--green-bg)' : 'var(--surface2)',
                        color: val === 'pass' ? 'var(--green-text)' : 'var(--text3)',
                        cursor: 'pointer', fontSize: 14,
                        fontWeight: 700, transition: 'all 0.13s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        outline: val === 'pass' ? '2px solid var(--green)' : 'none',
                      }}
                      title="Pass"
                    >✓</button>
                    <button
                      type="button"
                      onClick={() => toggleItem(item, 'fail')}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: 'none',
                        background: val === 'fail' ? 'var(--red-bg)' : 'var(--surface2)',
                        color: val === 'fail' ? 'var(--red-text)' : 'var(--text3)',
                        cursor: 'pointer', fontSize: 14,
                        fontWeight: 700, transition: 'all 0.13s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        outline: val === 'fail' ? '2px solid var(--red)' : 'none',
                      }}
                      title="Fail"
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Score preview */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>Pass: {passCount}</span>
              <span style={{ color: 'var(--red-text)', fontWeight: 600 }}>Fail: {failCount}</span>
              <span style={{ color: 'var(--text3)' }}>Unchecked: {CHECKLIST_ITEMS.length - passCount - failCount}</span>
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

          <div style={{ padding: '10px 16px 16px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', opacity: allChecked ? 1 : 0.5 }}
              onClick={handleSubmit}
              disabled={!allChecked}
            >
              Submit Inspection
            </button>
            {!allChecked && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                Check all items before submitting
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: History (this session) */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Inspection History — Room {selectedRoom?.number}
        </p>
        {roomHistory.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>No inspections submitted this session.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
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
                      <td style={{ fontSize: 12 }}>{formatDate(h.date)}</td>
                      <td style={{ fontSize: 12 }}>{h.staff}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-text)' }}>{h.pass}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: h.fail > 0 ? 'var(--red-text)' : 'var(--text3)' }}>
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
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            🧹 Housekeeping
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Manage room status, staff assignments, and inspections
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="stat-card stat-bar-green">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clean Available</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--green-text)', letterSpacing: '-0.03em' }}>{cleanCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Ready for check-in</p>
        </div>
        <div className="stat-card stat-bar-amber">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dirty / Needs Cleaning</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--amber-text)', letterSpacing: '-0.03em' }}>{dirtyCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Dirty + checkout pending</p>
        </div>
        <div className="stat-card stat-bar-blue">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cleaning In Progress</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--blue-text)', letterSpacing: '-0.03em' }}>{cleaningCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Currently being cleaned</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div style={{ padding: '0 18px' }}>
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
            <div data-tab-id="board">
              {loading && rooms.length === 0
                ? <div className="empty-state"><p style={{ margin: 0, color: 'var(--text3)' }}>Loading board…</p></div>
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
