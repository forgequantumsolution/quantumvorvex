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
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="t-h1 m-0 tracking-[-0.03em]">Night Audit</h1>
          <p className="t-sm mt-1 mb-0 mx-0 text-ink3">End-of-day close — {formatDate(TODAY)}</p>
        </div>
        <div className="flex gap-2 items-center">
          {locked && (
            <span className="t-xs px-3.5 py-1.5 rounded-[20px] bg-success-bg text-success-text">
              🔒 DAY LOCKED
            </span>
          )}
          <button
            className={`btn ${allDone && !locked ? 'btn-primary' : 'btn-outline'} btn-sm ${allDone && !locked ? 'bg-gold text-black border-none font-bold' : ''}`}
            disabled={locked || !allDone}
            onClick={() => setShowLockConfirm(true)}
          >
            🔒 Lock & Close Day
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Occupancy',       value: `${Math.round((AUDIT_SUMMARY.occupiedRooms / AUDIT_SUMMARY.totalRooms) * 100)}%`, color: 'var(--blue-text)', bar: 'stat-bar-blue' },
          { label: "Today's Revenue", value: formatCurrency(REVENUE_TODAY.total), color: 'var(--gold)', bar: 'stat-bar-amber' },
          { label: 'Check-Ins',       value: AUDIT_SUMMARY.checkInsToday,  color: 'var(--green-text)', bar: 'stat-bar-green' },
          { label: 'Check-Outs',      value: AUDIT_SUMMARY.checkOutsToday, color: 'var(--red-text)',   bar: 'stat-bar-red' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.bar}`}>
            <div className="text-[10.5px] font-semibold text-ink3 uppercase tracking-[0.05em] mb-1.5">{s.label}</div>
            <div className="t-h1" style={{ fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Revenue Breakdown */}
        <div className="card">
          <div className="t-title px-[18px] py-3.5 border-b border-line">Revenue Breakdown</div>
          <div className="px-[18px] py-3.5">
            {[
              ['Room Rent',    REVENUE_TODAY.roomRent,  'var(--text)'],
              ['Food Orders',  REVENUE_TODAY.foodOrders,'var(--text)'],
              ['Amenities',    REVENUE_TODAY.amenities,  'var(--text)'],
              ['Advances',     REVENUE_TODAY.advances,   'var(--blue-text)'],
              ['Refunds',     -REVENUE_TODAY.refunds,    'var(--red-text)'],
              ['GST Collected', REVENUE_TODAY.gst,       'var(--text3)'],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between py-[7px] border-b border-line">
                <span className="t-sm text-ink2">{label}</span>
                <span className="t-title" style={{ fontFamily: 'var(--font-mono)', color }}>{val < 0 ? `−${formatCurrency(-val)}` : formatCurrency(val)}</span>
              </div>
            ))}
            <div className="t-h3 flex justify-between py-2.5">
              <span className="text-ink">Net Total</span>
              <span className="text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(REVENUE_TODAY.total)}</span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="card">
          <div className="px-[18px] py-3.5 border-b border-line flex justify-between items-center">
            <span className="t-title">Audit Checklist</span>
            <span className="text-[11.5px] text-ink3 font-semibold">{completedCount}/{checklist.length} done</span>
          </div>
          {/* Progress bar */}
          <div className="h-[3px] bg-line">
            <div className={`h-[3px] transition-all duration-300 ${allDone ? 'bg-success' : 'bg-gold'}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="px-[18px] py-2.5">
            {checklist.map(task => (
              <label key={task.id} className={`flex items-center gap-2.5 py-2 border-b border-line ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} className="w-3.5 h-3.5" style={{ accentColor: 'var(--gold)' }} />
                <span className={`t-sm flex-1 ${task.done ? 'text-ink3 line-through' : 'text-ink'}`}>{task.task}</span>
                {task.done && <span className="t-xs text-success-text">✓</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column second row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">

        {/* Pending Checkouts */}
        <div className="card">
          <div className="t-title px-[18px] py-3.5 border-b border-line">
            Pending Checkouts
            {PENDING_CHECKOUTS.length > 0 && (
              <span className="ml-2 bg-danger-bg text-danger-text text-[10.5px] font-bold px-2 py-0.5 rounded-[10px]">{PENDING_CHECKOUTS.length}</span>
            )}
          </div>
          <div className="px-[18px] py-2.5">
            {PENDING_CHECKOUTS.length === 0 ? (
              <div className="t-sm py-5 text-center text-ink3">All clear ✓</div>
            ) : PENDING_CHECKOUTS.map(c => (
              <div key={c.room} className="flex justify-between items-center py-[9px] border-b border-line">
                <div>
                  <div className="t-title">{c.guest}</div>
                  <div className="text-[11px] text-ink3 mt-0.5">Room {c.room} · {c.stayType}</div>
                </div>
                <span className="text-[12.5px] font-bold text-danger-text" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Check-Ins */}
        <div className="card">
          <div className="t-title px-[18px] py-3.5 border-b border-line">Today's Check-Ins</div>
          <div className="px-[18px] py-2.5">
            {TODAYS_CHECKINS.map(c => (
              <div key={c.room} className="flex justify-between items-center py-[9px] border-b border-line">
                <div>
                  <div className="t-title">{c.guest}</div>
                  <div className="text-[11px] text-ink3 mt-0.5">Room {c.room} · {c.source}</div>
                </div>
                <Badge type="green">Checked In</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Register Summary */}
        <div className="card">
          <div className="t-title px-[18px] py-3.5 border-b border-line">Cash Register</div>
          <div className="px-[18px] py-2.5">
            {CASH_REGISTER.slice(0, 4).map((t, i) => (
              <div key={i} className="flex justify-between items-center py-[7px] border-b border-line">
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-ink overflow-hidden text-ellipsis whitespace-nowrap">{t.desc}</div>
                  <div className="text-[10px] text-ink3">{t.time}</div>
                </div>
                <span className="t-xs ml-2 shrink-0" style={{ fontFamily: 'var(--font-mono)', color: t.type === 'in' ? 'var(--green-text)' : 'var(--red-text)' }}>
                  {t.type === 'in' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-2.5 font-bold border-t border-line mt-1">
              <span className="t-xs">Net Cash</span>
              <span className="t-sm text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(cashIn - cashOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Housekeeping Status */}
      <div className="card mb-5">
        <div className="t-title px-[18px] py-3.5 border-b border-line">Housekeeping Status</div>
        <div className="px-[18px] py-3.5 flex flex-wrap gap-2.5">
          {HOUSEKEEPING_STATUS.map(r => (
            <div key={r.room} className="px-3.5 py-2.5 rounded-lg min-w-[110px] bg-surface2 border border-line text-center">
              <div className="t-title text-gold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{r.room}</div>
              <HKBadge status={r.status} />
              <div className="text-[10.5px] text-ink3 mt-1">{r.assignee}</div>
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
            <button className="btn btn-primary btn-sm bg-gold text-black border-none" onClick={handleLock}>
              🔒 Confirm Lock
            </button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink2 leading-[1.8] m-0">
          This will lock the current day's transactions and mark the audit as complete. The date will be closed for further edits.
        </p>
        <div className="mt-4 px-3.5 py-3 bg-[var(--gold-bg)] rounded-lg flex justify-between">
          <span className="t-title text-gold">Net Revenue Today</span>
          <span className="font-bold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(REVENUE_TODAY.total)}</span>
        </div>
      </Modal>
    </div>
  )
}
