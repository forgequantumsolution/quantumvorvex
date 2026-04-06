import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatDate, timeAgo } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_REQUESTS = [
  { id: 'MNT-001', room: '103', issueType: 'AC', description: 'AC not cooling properly, makes loud noise', priority: 'High', reportedBy: 'Front Desk', assignedTo: 'Ravi Kumar', status: 'Open', createdAt: '2026-04-05T09:00:00Z', photoUrl: null },
  { id: 'MNT-002', room: '207', issueType: 'Plumbing', description: 'Leaking tap in bathroom', priority: 'Medium', reportedBy: 'Housekeeping', assignedTo: 'Suresh Patil', status: 'In Progress', createdAt: '2026-04-04T14:30:00Z', photoUrl: null },
  { id: 'MNT-003', room: '312', issueType: 'Electrical', description: 'Power socket not working near bed', priority: 'High', reportedBy: 'Guest', assignedTo: null, status: 'Open', createdAt: '2026-04-06T08:00:00Z', photoUrl: null },
  { id: 'MNT-004', room: '201', issueType: 'Furniture', description: 'Chair leg broken', priority: 'Low', reportedBy: 'Housekeeping', assignedTo: 'Ravi Kumar', status: 'Resolved', createdAt: '2026-04-03T11:00:00Z', photoUrl: null },
  { id: 'MNT-005', room: '105', issueType: 'Cleaning', description: 'Deep clean required after long-stay checkout', priority: 'Medium', reportedBy: 'Front Desk', assignedTo: 'Priya Desai', status: 'Resolved', createdAt: '2026-04-02T10:00:00Z', photoUrl: null },
]

const MOCK_SCHEDULES = [
  { id: 'SCH-001', roomType: 'All', task: 'AC Filter Cleaning', frequency: 'monthly', assignedTo: 'Ravi Kumar', lastDone: '2026-03-01', nextDue: '2026-04-01' },
  { id: 'SCH-002', roomType: 'Suite', task: 'Full Deep Clean', frequency: 'weekly', assignedTo: 'Priya Desai', lastDone: '2026-03-30', nextDue: '2026-04-06' },
  { id: 'SCH-003', roomType: 'All', task: 'Pest Control', frequency: 'quarterly', assignedTo: null, lastDone: '2026-01-15', nextDue: '2026-04-15' },
]

const STAFF_NAMES = ['Ravi Kumar', 'Suresh Patil', 'Priya Desai', 'Amit Sharma', 'Neha Singh']

const ISSUE_TYPES = ['Plumbing', 'Electrical', 'AC', 'Furniture', 'Cleaning', 'Pest Control', 'Other']
const PRIORITIES = ['High', 'Medium', 'Low']
const ROOMS = ['101', '102', '103', '104', '105', '106', '107', '108', '201', '202', '203', '204', '205', '206', '207', '208', '301', '302', '303', '304', '305', '306', '307', '308', '312']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function priorityBadgeType(p) {
  if (p === 'High')   return 'red'
  if (p === 'Medium') return 'amber'
  return 'blue'
}

function statusBadgeType(s) {
  if (s === 'Open')        return 'red'
  if (s === 'In Progress') return 'amber'
  if (s === 'Resolved')    return 'green'
  return 'grey'
}

function freqBadgeType(f) {
  if (f === 'weekly')    return 'blue'
  if (f === 'monthly')   return 'amber'
  if (f === 'quarterly') return 'purple'
  return 'grey'
}

function nextDueColor(dateStr) {
  if (!dateStr) return 'var(--text3)'
  const due = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((due - now) / 86400000)
  if (diffDays < 0)  return 'var(--red-text)'
  if (diffDays <= 7) return 'var(--amber-text)'
  return 'var(--green-text)'
}

function trunc(str, n = 50) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

function generateMntId(existing) {
  const nums = existing.map(r => parseInt(r.id.replace('MNT-', '')) || 0)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `MNT-${String(next).padStart(3, '0')}`
}

function generateSchId(existing) {
  const nums = existing.map(r => parseInt(r.id.replace('SCH-', '')) || 0)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `SCH-${String(next).padStart(3, '0')}`
}

const MOCK_ACTIVITY = {
  'MNT-001': [
    { id: 1, author: 'Front Desk', note: 'Reported by guest at check-in', time: '2026-04-05T09:05:00Z' },
    { id: 2, author: 'Ravi Kumar', note: 'Inspected unit — compressor running hot, ordered part', time: '2026-04-05T11:30:00Z' },
  ],
  'MNT-002': [
    { id: 1, author: 'Housekeeping', note: 'Discovered during morning round', time: '2026-04-04T14:35:00Z' },
  ],
}

// ─── New Request Modal ────────────────────────────────────────────────────────
function NewRequestModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({
    room: '',
    issueType: '',
    priority: 'Medium',
    description: '',
    reportedBy: 'Front Desk',
    photo: null,
  })
  const [dragOver, setDragOver] = useState(false)

  function handleChange(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handlePhotoChange(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setForm(f => ({ ...f, photo: { file, url, name: file.name } }))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handlePhotoChange(file)
  }

  function handleSubmit() {
    if (!form.room || !form.issueType || !form.description.trim()) return
    onSubmit(form)
    setForm({ room: '', issueType: '', priority: 'Medium', description: '', reportedBy: 'Front Desk', photo: null })
  }

  const isValid = form.room && form.issueType && form.description.trim()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Maintenance Request"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.5 }}>
            Submit Request
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Row: Room + Issue Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Room *</label>
            <select className="form-select" value={form.room} onChange={e => handleChange('room', e.target.value)}>
              <option value="">Select room</option>
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Issue Type *</label>
            <select className="form-select" value={form.issueType} onChange={e => handleChange('issueType', e.target.value)}>
              <option value="">Select type</option>
              {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Priority pills */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Priority *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PRIORITIES.map(p => {
              const active = form.priority === p
              const color = p === 'High' ? 'var(--red)' : p === 'Medium' ? 'var(--amber)' : 'var(--blue)'
              const bg    = p === 'High' ? 'var(--red-bg)' : p === 'Medium' ? 'var(--amber-bg)' : 'var(--blue-bg)'
              const text  = p === 'High' ? 'var(--red-text)' : p === 'Medium' ? 'var(--amber-text)' : 'var(--blue-text)'
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleChange('priority', p)}
                  style={{
                    padding: '5px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? `1.5px solid ${color}` : '1.5px solid var(--border)',
                    background: active ? bg : 'var(--surface2)',
                    color: active ? text : 'var(--text3)',
                    transition: 'all 0.13s',
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Description *</label>
          <textarea
            className="form-textarea"
            placeholder="Describe the issue in detail…"
            value={form.description}
            onChange={e => handleChange('description', e.target.value)}
            rows={3}
          />
        </div>

        {/* Reported By */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Reported By</label>
          <input
            className="form-input"
            value={form.reportedBy}
            onChange={e => handleChange('reportedBy', e.target.value)}
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Photo (optional)</label>
          {form.photo ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={form.photo.url} alt="preview" style={{ maxHeight: 120, borderRadius: 6, border: '1px solid var(--border)' }} />
              <button
                type="button"
                onClick={() => handleChange('photo', null)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  border: 'none', borderRadius: '50%', width: 20, height: 20,
                  cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>{form.photo.name}</p>
            </div>
          ) : (
            <div
              className={`upload-zone${dragOver ? ' dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('mnt-photo-input').click()}
            >
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
                📎 Drop image here or <span style={{ color: 'var(--gold)', fontWeight: 600 }}>browse</span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>JPG, PNG up to 5 MB</p>
              <input
                id="mnt-photo-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handlePhotoChange(e.target.files?.[0])}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Request Detail Modal ─────────────────────────────────────────────────────
function DetailModal({ request, onClose, onUpdate, onResolve }) {
  const [assignee, setAssignee] = useState(request?.assignedTo || '')
  const [noteText, setNoteText] = useState('')
  const [activity, setActivity] = useState(MOCK_ACTIVITY[request?.id] || [])
  const [showResolvePrompt, setShowResolvePrompt] = useState(false)
  const [resolveNote, setResolveNote] = useState('')
  const addToast = useToast()

  if (!request) return null

  function handleAssignSave() {
    onUpdate(request.id, { assignedTo: assignee || null })
    addToast(`Assigned to ${assignee || 'nobody'}`, 'success')
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    const newNote = { id: Date.now(), author: 'Front Desk', note: noteText.trim(), time: new Date().toISOString() }
    setActivity(a => [...a, newNote])
    setNoteText('')
    addToast('Note added', 'success')
  }

  function handleResolve() {
    if (!resolveNote.trim()) return
    const newNote = { id: Date.now(), author: 'Front Desk', note: `Resolved: ${resolveNote.trim()}`, time: new Date().toISOString() }
    setActivity(a => [...a, newNote])
    onResolve(request.id, resolveNote)
    setShowResolvePrompt(false)
    setResolveNote('')
  }

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title={`Request — ${request.id}`}
      maxWidth="700px"
      footer={
        <>
          {request.status !== 'Resolved' && request.status !== 'Closed' && (
            <button className="btn btn-success" onClick={() => setShowResolvePrompt(true)}>
              ✓ Mark Resolved
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </>
      }
    >
      {/* Issue card */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          {[
            ['Room', request.room],
            ['Issue Type', request.issueType],
            ['Reported By', request.reportedBy],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge type={priorityBadgeType(request.priority)}>{request.priority}</Badge>
          <Badge type={statusBadgeType(request.status)}>{request.status}</Badge>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
            {timeAgo(request.createdAt)}
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{request.description}</p>
      </div>

      {/* Photo */}
      {request.photoUrl && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Photo</p>
          <img src={request.photoUrl} alt="Issue" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid var(--border)' }} />
        </div>
      )}

      {/* Assign dropdown */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Assigned To</label>
          <select className="form-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">— Unassigned —</option>
            {STAFF_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleAssignSave}>Save</button>
      </div>

      {/* Activity log */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Activity Log
        </p>
        {activity.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No activity yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activity.map(a => (
              <div key={a.id} style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{a.author}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{timeAgo(a.time)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Note */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Note</p>
        <textarea
          className="form-textarea"
          placeholder="Write a note or update…"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          rows={2}
          style={{ marginBottom: 8 }}
        />
        <button className="btn btn-outline btn-sm" onClick={handleAddNote} disabled={!noteText.trim()}>
          Add Note
        </button>
      </div>

      {/* Resolve prompt nested modal */}
      <Modal
        isOpen={showResolvePrompt}
        onClose={() => setShowResolvePrompt(false)}
        title="Mark as Resolved"
        maxWidth="440px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowResolvePrompt(false)}>Cancel</button>
            <button className="btn btn-success" onClick={handleResolve} disabled={!resolveNote.trim()} style={{ opacity: resolveNote.trim() ? 1 : 0.5 }}>
              Confirm Resolved
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text2)' }}>
          Please add a resolution note before closing this request.
        </p>
        <textarea
          className="form-textarea"
          placeholder="Describe how the issue was resolved…"
          value={resolveNote}
          onChange={e => setResolveNote(e.target.value)}
          rows={3}
        />
      </Modal>
    </Modal>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ isOpen, onClose, initial, onSave }) {
  const [form, setForm] = useState(initial || { roomType: 'All', task: '', frequency: 'monthly', assignedTo: '' })

  function handleChange(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSave() {
    if (!form.task.trim()) return
    onSave(form)
  }

  const isValid = form.task.trim()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial?.id ? 'Edit Schedule' : 'Add Schedule'}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.5 }}>
            {initial?.id ? 'Save Changes' : 'Add Schedule'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Room Type</label>
            <select className="form-select" value={form.roomType} onChange={e => handleChange('roomType', e.target.value)}>
              <option>All</option>
              <option>Suite</option>
              <option>Deluxe</option>
              <option>Standard</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Frequency</label>
            <select className="form-select" value={form.frequency} onChange={e => handleChange('frequency', e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Task *</label>
          <input className="form-input" placeholder="e.g. AC Filter Cleaning" value={form.task} onChange={e => handleChange('task', e.target.value)} />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Assign To</label>
          <select className="form-select" value={form.assignedTo} onChange={e => handleChange('assignedTo', e.target.value)}>
            <option value="">— Unassigned —</option>
            {STAFF_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Maintenance() {
  const addToast = useToast()
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES)
  const [activeTab, setActiveTab] = useState('open')
  const [showNew, setShowNew] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editSchedule, setEditSchedule] = useState(null)

  // Stat counts
  const openCount     = requests.filter(r => r.status === 'Open').length
  const inProgCount   = requests.filter(r => r.status === 'In Progress').length
  const resolvedMonth = requests.filter(r => {
    if (r.status !== 'Resolved') return false
    const d = new Date(r.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // Tab-filtered requests
  const filteredRequests = useMemo(() => {
    if (activeTab === 'open')       return requests.filter(r => r.status === 'Open')
    if (activeTab === 'inprogress') return requests.filter(r => r.status === 'In Progress')
    if (activeTab === 'resolved')   return requests.filter(r => r.status === 'Resolved' || r.status === 'Closed')
    return []
  }, [requests, activeTab])

  function handleNewSubmit(form) {
    const newReq = {
      id: generateMntId(requests),
      room: form.room,
      issueType: form.issueType,
      description: form.description,
      priority: form.priority,
      reportedBy: form.reportedBy,
      assignedTo: null,
      status: 'Open',
      createdAt: new Date().toISOString(),
      photoUrl: form.photo?.url || null,
    }
    setRequests(r => [newReq, ...r])
    setShowNew(false)
    addToast(`Request ${newReq.id} created`, 'success')
  }

  function handleUpdate(id, patch) {
    setRequests(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
    if (selectedReq?.id === id) setSelectedReq(r => r ? { ...r, ...patch } : r)
  }

  function handleResolve(id) {
    handleUpdate(id, { status: 'Resolved' })
    addToast(`Request ${id} marked as Resolved`, 'success')
    setSelectedReq(null)
  }

  function handleAddSchedule(form) {
    if (editSchedule?.id) {
      setSchedules(ss => ss.map(s => s.id === editSchedule.id ? { ...s, ...form } : s))
      addToast('Schedule updated', 'success')
    } else {
      const newSch = { ...form, id: generateSchId(schedules), lastDone: null, nextDue: null }
      setSchedules(ss => [...ss, newSch])
      addToast('Schedule added', 'success')
    }
    setShowScheduleModal(false)
    setEditSchedule(null)
  }

  function handleDeleteSchedule(id) {
    setSchedules(ss => ss.filter(s => s.id !== id))
    addToast('Schedule deleted', 'info')
  }

  const tabs = [
    { id: 'open',       label: `Open (${openCount})` },
    { id: 'inprogress', label: `In Progress (${inProgCount})` },
    { id: 'resolved',   label: 'Resolved' },
    { id: 'schedule',   label: 'Schedule' },
  ]

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
            🔧 Maintenance
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Track and manage facility maintenance requests
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Request
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="stat-card stat-bar-red">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--red-text)', letterSpacing: '-0.03em' }}>{openCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Awaiting action</p>
        </div>
        <div className="stat-card stat-bar-amber">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--amber-text)', letterSpacing: '-0.03em' }}>{inProgCount}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Currently being handled</p>
        </div>
        <div className="stat-card stat-bar-green">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved This Month</p>
          <p style={{ margin: '6px 0 0', fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--green-text)', letterSpacing: '-0.03em' }}>{resolvedMonth}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Completed in April</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab}>
          {/* Open / In Progress / Resolved tabs */}
          {['open', 'inprogress', 'resolved'].map(tabId => (
            <div key={tabId} data-tab-id={tabId}>
              {filteredRequests.length === 0 ? (
                <div className="empty-state">
                  <p style={{ fontSize: 32, margin: '0 0 8px' }}>📭</p>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No requests here</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>Nothing to show in this category.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Room</th>
                        <th>Issue Type</th>
                        <th>Description</th>
                        <th>Priority</th>
                        <th>Reported By</th>
                        <th>Assigned To</th>
                        <th>Age</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map(req => (
                        <tr key={req.id}>
                          <td>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                              {req.id}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{req.room}</td>
                          <td>{req.issueType}</td>
                          <td style={{ maxWidth: 220 }}>
                            <span title={req.description}>{trunc(req.description, 50)}</span>
                          </td>
                          <td><Badge type={priorityBadgeType(req.priority)}>{req.priority}</Badge></td>
                          <td>{req.reportedBy}</td>
                          <td>
                            {req.assignedTo
                              ? <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{req.assignedTo}</span>
                              : <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Unassigned</span>
                            }
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text3)' }}>{timeAgo(req.createdAt)}</td>
                          <td><Badge type={statusBadgeType(req.status)}>{req.status}</Badge></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => setSelectedReq(req)}
                              >View</button>
                              {!req.assignedTo && (
                                <button
                                  className="btn btn-outline btn-xs"
                                  onClick={() => setSelectedReq(req)}
                                >Assign</button>
                              )}
                              {(req.status === 'Open' || req.status === 'In Progress') && (
                                <button
                                  className="btn btn-success btn-xs"
                                  onClick={() => handleUpdate(req.id, { status: 'Resolved' })}
                                >Resolve</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Schedule tab */}
          <div data-tab-id="schedule">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditSchedule(null); setShowScheduleModal(true) }}>
                + Add Schedule
              </button>
            </div>
            {schedules.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>🗓️</p>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No schedules yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Room Type</th>
                      <th>Task</th>
                      <th>Frequency</th>
                      <th>Last Done</th>
                      <th>Next Due</th>
                      <th>Assigned To</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(sch => (
                      <tr key={sch.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sch.roomType}</td>
                        <td>{sch.task}</td>
                        <td><Badge type={freqBadgeType(sch.frequency)}>{sch.frequency}</Badge></td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{sch.lastDone ? formatDate(sch.lastDone) : '—'}</td>
                        <td>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: nextDueColor(sch.nextDue) }}>
                            {sch.nextDue ? formatDate(sch.nextDue) : '—'}
                          </span>
                        </td>
                        <td>
                          {sch.assignedTo || <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Unassigned</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => { setEditSchedule(sch); setShowScheduleModal(true) }}
                            >Edit</button>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteSchedule(sch.id)}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Modals */}
      <NewRequestModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSubmit={handleNewSubmit}
      />

      {selectedReq && (
        <DetailModal
          request={selectedReq}
          onClose={() => setSelectedReq(null)}
          onUpdate={handleUpdate}
          onResolve={handleResolve}
        />
      )}

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => { setShowScheduleModal(false); setEditSchedule(null) }}
        initial={editSchedule}
        onSave={handleAddSchedule}
      />
    </div>
  )
}
