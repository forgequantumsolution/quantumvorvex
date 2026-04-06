import { useState } from 'react'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatDate } from '../../../utils/format'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

const AUDIT_SUMMARY = {
  date: TODAY,
  occupiedRooms: 6,
  availableRooms: 4,
  maintenanceRooms: 2,
  totalRooms: 12,
  checkInsToday: 3,
  checkOutsToday: 2,
  noShows: 1,
  walkIns: 1,
}

const REVENUE_TODAY = {
  roomRent: 24800,
  foodOrders: 4200,
  amenities: 1600,
  advances: 8000,
  refunds: 2000,
  gst: 3312,
  total: 33912,
}

const PENDING_CHECKOUTS = [
  { room: '202', guest: 'Rajesh Kumar', stayType: 'Daily', balance: 6160 },
  { room: '118', guest: 'Sneha Rao',    stayType: 'Daily', balance: 5220 },
]

const TODAYS_CHECKINS = [
  { room: '103', guest: 'Anjali Singh',  stayType: 'Daily',   source: 'OTA' },
  { room: '201', guest: 'Farhan Ahmed',  stayType: 'Deluxe',  source: 'Phone' },
  { room: '302', guest: 'Neha Joshi',    stayType: 'Executive', source: 'Website' },
]

const HOUSEKEEPING_STATUS = [
  { room: '101', status: 'clean',    assignee: 'Shyam' },
  { room: '102', status: 'dirty',    assignee: 'Geeta' },
  { room: '103', status: 'inspecting', assignee: 'Shyam' },
  { room: '202', status: 'clean',    assignee: 'Geeta' },
  { room: '203', status: 'dirty',    assignee: 'Ravi' },
  { room: '301', status: 'blocked',  assignee: 'Maintenance' },
]

const CASH_REGISTER = [
  { time: '09:15', desc: 'INV-001 — Rahul Sharma',    type: 'in',  amount: 13776 },
  { time: '11:30', desc: 'Advance — Anjali Singh',     type: 'in',  amount: 2000  },
  { time: '14:00', desc: 'Deposit Refund — Vijay',     type: 'out', amount: 2000  },
  { time: '16:45', desc: 'INV-002 — Priya Patel',      type: 'in',  amount: 9016  },
  { time: '20:00', desc: 'Food Order — Room 104',      type: 'in',  amount: 680   },
]

const AUDIT_CHECKLIST = [
  { id: 1, task: 'Verify all room statuses are accurate' },
  { id: 2, task: 'Confirm all check-outs are settled' },
  { id: 3, task: 'Run end-of-day revenue report' },
  { id: 4, task: 'Reconcile cash register balance' },
  { id: 5, task: 'Check housekeeping completion for vacant rooms' },
  { id: 6, task: 'Confirm tomorrow\'s arrivals and send reminders' },
  { id: 7, task: 'Back up daily transaction log' },
  { id: 8, task: 'Lock the day & post closing balance' },
]

function HKBadge({ status }) {
  const map = {
    clean:      { type: 'green',  label: 'Clean' },
    dirty:      { type: 'red',    label: 'Dirty' },
    inspecting: { type: 'amber',  label: 'Inspecting' },
    blocked:    { type: 'grey',   label: 'Blocked' },
  }
  const s = map[status] || { type: 'grey', label: status }
  return <Badge type={s.type}>{s.label}</Badge>
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NightAudit() {
  const addToast = useToast()
  const [checklist, setChecklist] = useState(AUDIT_CHECKLIST.map(t => ({ ...t, done: false })))
  const [locked, setLocked] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)

  const completedCount = checklist.filter(t => t.done).length
  const allDone = completedCount === checklist.length
  const progress = Math.round((completedCount / checklist.length) * 100)

  const toggleTask = (id) => {
    if (locked) return
    setChecklist(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const handleLock = () => {
    setLocked(true)
    setShowLockConfirm(false)
    addToast('Night audit locked. Day closed successfully.', 'success')
  }

  const cashIn  = CASH_REGISTER.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0)
  const cashOut = CASH_REGISTER.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0)

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Night Audit</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>End-of-day close — {formatDate(TODAY)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {locked && (
            <span style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green-text)', fontSize: 12, fontWeight: 700 }}>
              🔒 DAY LOCKED
            </span>
          )}
          <button
            className={`btn ${allDone && !locked ? 'btn-primary' : 'btn-outline'} btn-sm`}
            disabled={locked || !allDone}
            onClick={() => setShowLockConfirm(true)}
            style={allDone && !locked ? { background: 'var(--gold)', color: '#000', border: 'none', fontWeight: 700 } : {}}
          >
            🔒 Lock & Close Day
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Occupancy',       value: `${Math.round((AUDIT_SUMMARY.occupiedRooms / AUDIT_SUMMARY.totalRooms) * 100)}%`, color: 'var(--blue-text)', bar: 'stat-bar-blue' },
          { label: "Today's Revenue", value: formatCurrency(REVENUE_TODAY.total), color: 'var(--gold)', bar: 'stat-bar-amber' },
          { label: 'Check-Ins',       value: AUDIT_SUMMARY.checkInsToday,  color: 'var(--green-text)', bar: 'stat-bar-green' },
          { label: 'Check-Outs',      value: AUDIT_SUMMARY.checkOutsToday, color: 'var(--red-text)',   bar: 'stat-bar-red' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.bar}`}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Revenue Breakdown */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Revenue Breakdown</div>
          <div style={{ padding: '14px 18px' }}>
            {[
              ['Room Rent',    REVENUE_TODAY.roomRent,  'var(--text)'],
              ['Food Orders',  REVENUE_TODAY.foodOrders,'var(--text)'],
              ['Amenities',    REVENUE_TODAY.amenities,  'var(--text)'],
              ['Advances',     REVENUE_TODAY.advances,   'var(--blue-text)'],
              ['Refunds',     -REVENUE_TODAY.refunds,    'var(--red-text)'],
              ['GST Collected', REVENUE_TODAY.gst,       'var(--text3)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color }}>{val < 0 ? `−${formatCurrency(-val)}` : formatCurrency(val)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, fontSize: 15 }}>
              <span style={{ color: 'var(--text)' }}>Net Total</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)' }}>{formatCurrency(REVENUE_TODAY.total)}</span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Audit Checklist</span>
            <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>{completedCount}/{checklist.length} done</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--border)' }}>
            <div style={{ height: 3, width: `${progress}%`, background: allDone ? 'var(--green)' : 'var(--gold)', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ padding: '10px 18px' }}>
            {checklist.map(task => (
              <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: locked ? 'default' : 'pointer', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} style={{ width: 14, height: 14, accentColor: 'var(--gold)' }} />
                <span style={{ fontSize: 13, color: task.done ? 'var(--text3)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', flex: 1 }}>{task.task}</span>
                {task.done && <span style={{ fontSize: 12, color: 'var(--green-text)' }}>✓</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column second row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Pending Checkouts */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>
            Pending Checkouts
            {PENDING_CHECKOUTS.length > 0 && (
              <span style={{ marginLeft: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{PENDING_CHECKOUTS.length}</span>
            )}
          </div>
          <div style={{ padding: '10px 18px' }}>
            {PENDING_CHECKOUTS.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>All clear ✓</div>
            ) : PENDING_CHECKOUTS.map(c => (
              <div key={c.room} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.guest}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Room {c.room} · {c.stayType}</div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: 'var(--red-text)' }}>{formatCurrency(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Check-Ins */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Today's Check-Ins</div>
          <div style={{ padding: '10px 18px' }}>
            {TODAYS_CHECKINS.map(c => (
              <div key={c.room} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.guest}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Room {c.room} · {c.source}</div>
                </div>
                <Badge type="green">Checked In</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Register Summary */}
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Cash Register</div>
          <div style={{ padding: '10px 18px' }}>
            {CASH_REGISTER.slice(0, 4).map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t.time}</div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: t.type === 'in' ? 'var(--green-text)' : 'var(--red-text)', marginLeft: 8, flexShrink: 0 }}>
                  {t.type === 'in' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Net Cash</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--gold)' }}>{formatCurrency(cashIn - cashOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Housekeeping Status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Housekeeping Status</div>
        <div style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {HOUSEKEEPING_STATUS.map(r => (
            <div key={r.room} style={{
              padding: '10px 14px', borderRadius: 8, minWidth: 110,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>{r.room}</div>
              <HKBadge status={r.status} />
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4 }}>{r.assignee}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lock Confirm Modal */}
      <Modal
        isOpen={showLockConfirm}
        onClose={() => setShowLockConfirm(false)}
        title="Lock Day & Close Audit"
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setShowLockConfirm(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" style={{ background: 'var(--gold)', color: '#000', border: 'none' }} onClick={handleLock}>
              🔒 Confirm Lock
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.8, margin: 0 }}>
          This will lock the current day's transactions and mark the audit as complete. The date will be closed for further edits.
        </p>
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--gold-bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>Net Revenue Today</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--gold)' }}>{formatCurrency(REVENUE_TODAY.total)}</span>
        </div>
      </Modal>
    </div>
  )
}
