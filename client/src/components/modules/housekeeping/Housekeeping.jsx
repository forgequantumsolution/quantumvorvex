import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatDate, timeAgo } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const HK_STATUSES = {
  clean_available:     { label: 'Clean',       color: 'var(--green)',     bg: 'var(--green-bg)',  text: 'var(--green-text)' },
  dirty_available:     { label: 'Dirty',       color: 'var(--amber)',     bg: 'var(--amber-bg)',  text: 'var(--amber-text)' },
  occupied:            { label: 'Occupied',    color: 'var(--red)',       bg: 'var(--red-bg)',    text: 'var(--red-text)' },
  checkout_pending:    { label: 'Checkout',    color: '#f97316',          bg: '#fff7ed',          text: '#c2410c' },
  cleaning_in_progress:{ label: 'Cleaning',   color: 'var(--blue)',      bg: 'var(--blue-bg)',   text: 'var(--blue-text)' },
  maintenance:         { label: 'Maintenance', color: 'var(--grey-text)', bg: 'var(--grey-bg)',   text: 'var(--grey-text)' },
}

const MOCK_HK_ROOMS = [
  { id:'1',  number:'101', floor:1, status:'clean_available',      assignedTo:null },
  { id:'2',  number:'102', floor:1, status:'occupied',             assignedTo:null },
  { id:'3',  number:'103', floor:1, status:'maintenance',          assignedTo:null },
  { id:'4',  number:'104', floor:1, status:'dirty_available',      assignedTo:'Priya Desai' },
  { id:'5',  number:'105', floor:1, status:'clean_available',      assignedTo:null },
  { id:'6',  number:'106', floor:1, status:'cleaning_in_progress', assignedTo:'Meena Kumari' },
  { id:'7',  number:'107', floor:1, status:'checkout_pending',     assignedTo:null },
  { id:'8',  number:'108', floor:1, status:'clean_available',      assignedTo:null },
  { id:'9',  number:'201', floor:2, status:'dirty_available',      assignedTo:'Priya Desai' },
  { id:'10', number:'202', floor:2, status:'occupied',             assignedTo:null },
  { id:'11', number:'203', floor:2, status:'clean_available',      assignedTo:null },
  { id:'12', number:'204', floor:2, status:'occupied',             assignedTo:null },
  { id:'13', number:'205', floor:2, status:'dirty_available',      assignedTo:'Meena Kumari' },
  { id:'14', number:'206', floor:2, status:'clean_available',      assignedTo:null },
  { id:'15', number:'207', floor:2, status:'maintenance',          assignedTo:null },
  { id:'16', number:'208', floor:2, status:'cleaning_in_progress', assignedTo:'Sunita Rao' },
]

const HK_STAFF = ['Priya Desai', 'Meena Kumari', 'Sunita Rao', 'Rekha Singh', 'Anita Joshi']

const CHECKLIST_ITEMS = [
  'Minibar stocked', 'Toiletries refilled', 'AC functional', 'TV functional',
  'Bathroom clean', 'Bed made', 'Fresh towels', 'Floor mopped', 'Dustbin emptied',
]

// Derive linen data from rooms (lastChanged 3-7 days ago, nextDue 7 days after)
function buildLinenData(rooms) {
  return rooms.map((r, i) => {
    const daysAgo = 3 + (i % 5)
    const lastChanged = new Date(Date.now() - daysAgo * 86400000).toISOString()
    const nextDue = new Date(new Date(lastChanged).getTime() + 7 * 86400000).toISOString()
    const changedBy = HK_STAFF[i % HK_STAFF.length]
    return { roomId: r.id, roomNumber: r.number, lastChanged, nextDue, changedBy }
  })
}

// Mock inspection history per room (3 per room)
function buildInspectionHistory(rooms) {
  const hist = {}
  rooms.forEach(r => {
    hist[r.id] = [
      { id: `${r.id}-h1`, date: '2026-03-28', staff: HK_STAFF[0], pass: 8, fail: 1, total: 9 },
      { id: `${r.id}-h2`, date: '2026-03-14', staff: HK_STAFF[1], pass: 9, fail: 0, total: 9 },
      { id: `${r.id}-h3`, date: '2026-02-28', staff: HK_STAFF[2], pass: 7, fail: 2, total: 9 },
    ]
  })
  return hist
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
  if (diff <= 1) return 'var(--amber-text)'
  if (diff <= 7) return 'var(--amber-text)'
  return 'var(--green-text)'
}

function linenDueBadge(nextDue) {
  if (!nextDue) return 'grey'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return 'red'
  if (diff <= 1) return 'amber'
  if (diff <= 7) return 'amber'
  return 'green'
}

function linenDueLabel(nextDue) {
  if (!nextDue) return '—'
  const diff = Math.floor((new Date(nextDue) - Date.now()) / 86400000)
  if (diff < 0)  return 'Overdue'
  if (diff === 0) return 'Due Today'
  if (diff <= 7) return `${diff}d`
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
  const [timestamps, setTimestamps] = useState({}) // { roomId: { startedAt, completedAt } }

  const filtered = useMemo(() => rooms.filter(r => {
    const staffOk = staffFilter === 'All' || r.assignedTo === staffFilter
    const floorOk = floorFilter === 'All' || String(r.floor) === floorFilter
    return staffOk && floorOk
  }), [rooms, staffFilter, floorFilter])

  function getTs(roomId) { return timestamps[roomId] || {} }

  function handleStart(room) {
    const now = new Date().toISOString()
    setTimestamps(t => ({ ...t, [room.id]: { ...getTs(room.id), startedAt: now } }))
    onUpdateRoom(room.id, { status: 'cleaning_in_progress' })
    addToast(`Room ${room.number} cleaning started`, 'info')
  }

  function handleDone(room) {
    const now = new Date().toISOString()
    setTimestamps(t => ({ ...t, [room.id]: { ...getTs(room.id), completedAt: now } }))
    onUpdateRoom(room.id, { status: 'clean_available' })
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
                const ts = getTs(room.id)
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
                      {ts.startedAt ? timeAgo(ts.startedAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {ts.completedAt ? timeAgo(ts.completedAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {calcDuration(ts.startedAt, ts.completedAt)}
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
function LinenTrackerTab({ rooms }) {
  const addToast = useToast()
  const [linen, setLinen] = useState(() => buildLinenData(rooms))

  function handleMarkChanged(roomId) {
    const now = new Date().toISOString()
    const nextDue = new Date(Date.now() + 7 * 86400000).toISOString()
    setLinen(ls => ls.map(l => l.roomId === roomId
      ? { ...l, lastChanged: now, nextDue, changedBy: 'Front Desk' }
      : l
    ))
    const room = rooms.find(r => r.id === roomId)
    addToast(`Linen changed for Room ${room?.number}`, 'success')
  }

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
          {linen.map(l => {
            const diff = Math.floor((new Date(l.nextDue) - Date.now()) / 86400000)
            return (
              <tr key={l.roomId}>
                <td>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                    {l.roomNumber}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{formatDate(l.lastChanged)}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600, color: linenDueColor(l.nextDue) }}>
                  {formatDate(l.nextDue)}
                </td>
                <td style={{ fontSize: 12.5, fontWeight: 700, color: linenDueColor(l.nextDue) }}>
                  {diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `${diff}d`}
                </td>
                <td>
                  <Badge type={linenDueBadge(l.nextDue)}>{linenDueLabel(l.nextDue)}</Badge>
                </td>
                <td style={{ fontSize: 12.5 }}>{l.changedBy}</td>
                <td>
                  <button className="btn btn-outline btn-xs" onClick={() => handleMarkChanged(l.roomId)}>
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
function InspectionTab({ rooms }) {
  const addToast = useToast()
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '')
  const [checklist, setChecklist] = useState({}) // { item: 'pass' | 'fail' | null }
  const [history, setHistory] = useState(() => buildInspectionHistory(rooms))

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

  function handleSubmit() {
    if (!allChecked) return
    const result = {
      id: `${selectedRoomId}-h${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      staff: 'Front Desk',
      pass: passCount,
      fail: failCount,
      total: CHECKLIST_ITEMS.length,
    }
    setHistory(h => ({ ...h, [selectedRoomId]: [result, ...(h[selectedRoomId] || [])] }))
    setChecklist({})
    const score = Math.round((passCount / CHECKLIST_ITEMS.length) * 100)
    addToast(`Inspection saved — Score: ${score}%`, score >= 80 ? 'success' : 'warning')
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

      {/* Right: History */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Inspection History — Room {selectedRoom?.number}
        </p>
        {roomHistory.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>No inspections yet for this room.</p>
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
  const [rooms, setRooms] = useState(MOCK_HK_ROOMS)
  const [activeTab, setActiveTab] = useState('board')
  const [assignRoomTarget, setAssignRoomTarget] = useState(null)

  // Stat counts
  const cleanCount   = rooms.filter(r => r.status === 'clean_available').length
  const dirtyCount   = rooms.filter(r => r.status === 'dirty_available' || r.status === 'checkout_pending').length
  const cleaningCount = rooms.filter(r => r.status === 'cleaning_in_progress').length

  function handleUpdateRoom(id, patch) {
    setRooms(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function handleAssignSave(id, patch) {
    handleUpdateRoom(id, patch)
    const room = rooms.find(r => r.id === id)
    addToast(`Room ${room?.number} updated`, 'success')
    setAssignRoomTarget(null)
  }

  function handleMarkCheckoutsDirty() {
    const checkouts = rooms.filter(r => r.status === 'checkout_pending')
    if (checkouts.length === 0) { addToast('No checkout rooms found', 'info'); return }
    setRooms(rs => rs.map(r => r.status === 'checkout_pending' ? { ...r, status: 'dirty_available' } : r))
    addToast(`${checkouts.length} room(s) marked Dirty`, 'success')
  }

  function handleMarkDirtyInProgress() {
    const dirty = rooms.filter(r => r.status === 'dirty_available')
    if (dirty.length === 0) { addToast('No dirty rooms found', 'info'); return }
    setRooms(rs => rs.map(r => r.status === 'dirty_available' ? { ...r, status: 'cleaning_in_progress' } : r))
    addToast(`${dirty.length} room(s) marked Cleaning In Progress`, 'success')
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
          <button className="btn btn-outline btn-sm" onClick={handleMarkCheckoutsDirty}>
            Mark Checkouts as Dirty
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleMarkDirtyInProgress}>
            Mark All Dirty → In Progress
          </button>
        </div>
      </div>

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
              <BoardTab rooms={rooms} onRoomClick={setAssignRoomTarget} />
            </div>

            <div data-tab-id="daily">
              <DailyListTab rooms={rooms} onUpdateRoom={handleUpdateRoom} />
            </div>

            <div data-tab-id="linen">
              <LinenTrackerTab rooms={rooms} />
            </div>

            <div data-tab-id="inspection">
              <InspectionTab rooms={rooms} />
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
