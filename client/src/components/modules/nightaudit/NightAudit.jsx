import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency, formatDate } from '../../../utils/format'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import { LuChartPie, LuIndianRupee, LuLogIn, LuLogOut, LuLock } from 'react-icons/lu'
import { PageWrapper, StatCard } from '../../ui-tw'

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

// Task text comes from t(`checklist.<key>`) at render time.
const AUDIT_CHECKLIST = [
  { id: 1, key: 'roomStatuses' },
  { id: 2, key: 'checkoutsSettled' },
  { id: 3, key: 'revenueReport' },
  { id: 4, key: 'reconcileCash' },
  { id: 5, key: 'housekeeping' },
  { id: 6, key: 'arrivals' },
  { id: 7, key: 'backup' },
  { id: 8, key: 'lockDay' },
]

const HK_BADGE = { clean: 'green', dirty: 'red', inspecting: 'amber', blocked: 'grey' }

function HKBadge({ status }) {
  const { t } = useTranslation('nightaudit')
  return <Badge type={HK_BADGE[status] || 'grey'}>{t(`hk.${status}`, { defaultValue: status })}</Badge>
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NightAudit() {
  const { t } = useTranslation('nightaudit')
  const addToast = useToast()
  const [checklist, setChecklist] = useState(AUDIT_CHECKLIST.map(task => ({ ...task, done: false })))
  const [locked, setLocked] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)

  const completedCount = checklist.filter(task => task.done).length
  const allDone = completedCount === checklist.length
  const progress = Math.round((completedCount / checklist.length) * 100)

  const toggleTask = (id) => {
    if (locked) return
    setChecklist(ts => ts.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }

  const handleLock = () => {
    setLocked(true)
    setShowLockConfirm(false)
    addToast(t('toast.locked'), 'success')
  }

  const cashIn  = CASH_REGISTER.filter(tx => tx.type === 'in').reduce((s, tx) => s + tx.amount, 0)
  const cashOut = CASH_REGISTER.filter(tx => tx.type === 'out').reduce((s, tx) => s + tx.amount, 0)

  return (
    <PageWrapper
      title={t('title')}
      subtitle={`${t('subtitle', { date: formatDate(TODAY) })}${locked ? ` · ${t('dayLocked')}` : ''}`}
      search={null}
      headerActions={[
        {
          id: 'lock',
          label: locked ? t('dayLocked') : t('lockAction'),
          icon: <LuLock />,
          variant: 'primary',
          disabled: locked || !allDone,
          onClick: () => setShowLockConfirm(true),
        },
      ]}
    >
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-4 sm:mb-5">
        {[
          { id: 'occupancy', label: t('stats.occupancy'), value: `${Math.round((AUDIT_SUMMARY.occupiedRooms / AUDIT_SUMMARY.totalRooms) * 100)}%`, icon: <LuChartPie />, tone: 'blue',
            progress: Math.round((AUDIT_SUMMARY.occupiedRooms / AUDIT_SUMMARY.totalRooms) * 100) },
          { id: 'revenue', label: t('stats.revenue'), value: formatCurrency(REVENUE_TODAY.total), icon: <LuIndianRupee />, tone: 'gold' },
          { id: 'checkins', label: t('stats.checkIns'), value: AUDIT_SUMMARY.checkInsToday, icon: <LuLogIn />, tone: 'green' },
          { id: 'checkouts', label: t('stats.checkOuts'), value: AUDIT_SUMMARY.checkOutsToday, icon: <LuLogOut />, tone: 'red' },
        ].map(({ id, ...s }) => <StatCard key={id} {...s} />)}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-5 mb-4 lg:mb-5">

        {/* Revenue Breakdown */}
        <div className="card">
          <div className="t-title px-4 sm:px-[18px] py-3.5 border-b border-line">{t('revenue.title')}</div>
          <div className="px-4 sm:px-[18px] py-3.5">
            {[
              [t('revenue.roomRent'),     REVENUE_TODAY.roomRent,  'var(--text)'],
              [t('revenue.foodOrders'),   REVENUE_TODAY.foodOrders,'var(--text)'],
              [t('revenue.amenities'),    REVENUE_TODAY.amenities,  'var(--text)'],
              [t('revenue.advances'),     REVENUE_TODAY.advances,   'var(--blue-text)'],
              [t('revenue.refunds'),     -REVENUE_TODAY.refunds,    'var(--red-text)'],
              [t('revenue.gstCollected'), REVENUE_TODAY.gst,       'var(--text3)'],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between gap-3 py-[7px] border-b border-line">
                <span className="t-sm text-ink2">{label}</span>
                <span className="t-title font-mono" style={{ color }}>{val < 0 ? `−${formatCurrency(-val)}` : formatCurrency(val)}</span>
              </div>
            ))}
            <div className="t-h3 flex justify-between py-2.5">
              <span className="text-ink">{t('revenue.netTotal')}</span>
              <span className="text-gold font-mono">{formatCurrency(REVENUE_TODAY.total)}</span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="card">
          <div className="px-4 sm:px-[18px] py-3.5 border-b border-line flex justify-between items-center gap-3">
            <span className="t-title">{t('checklist.title')}</span>
            <span className="text-xs text-ink3 font-semibold shrink-0">{t('checklist.done', { done: completedCount, total: checklist.length })}</span>
          </div>
          {/* Progress bar */}
          <div className="h-[3px] bg-line">
            <div className={`h-[3px] transition-all duration-300 ${allDone ? 'bg-success' : 'bg-gold'}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="px-4 sm:px-[18px] py-1.5">
            {checklist.map(task => (
              <label key={task.id} className={`flex items-center gap-3 py-2 min-h-11 last:border-0 border-b border-line ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} className="w-4 h-4 shrink-0 rounded focus:ring-gold/20" style={{ accentColor: 'var(--gold)' }} />
                <span className={`t-sm flex-1 ${task.done ? 'text-ink3 line-through' : 'text-ink'}`}>{t(`checklist.${task.key}`)}</span>
                {task.done && <span className="t-xs text-success-text">✓</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column second row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 mb-4 lg:mb-5">

        {/* Pending Checkouts */}
        <div className="card">
          <div className="t-title px-4 sm:px-[18px] py-3.5 border-b border-line">
            {t('pendingCheckouts')}
            {PENDING_CHECKOUTS.length > 0 && (
              <span className="ml-2 bg-danger-bg text-danger-text text-xs font-bold px-2 py-0.5 rounded-[10px]">{PENDING_CHECKOUTS.length}</span>
            )}
          </div>
          <div className="px-4 sm:px-[18px] py-2.5">
            {PENDING_CHECKOUTS.length === 0 ? (
              <div className="t-sm py-5 text-center text-ink3">{t('allClear')} ✓</div>
            ) : PENDING_CHECKOUTS.map(c => (
              <div key={c.room} className="flex justify-between items-center gap-3 py-[9px] border-b border-line">
                <div className="min-w-0">
                  <div className="t-title truncate">{c.guest}</div>
                  <div className="text-xs text-ink3 mt-0.5">{t('roomN', { number: c.room })} · {c.stayType}</div>
                </div>
                <span className="text-[12.5px] font-bold text-danger-text font-mono shrink-0">{formatCurrency(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Check-Ins */}
        <div className="card">
          <div className="t-title px-4 sm:px-[18px] py-3.5 border-b border-line">{t('todaysCheckIns')}</div>
          <div className="px-4 sm:px-[18px] py-2.5">
            {TODAYS_CHECKINS.map(c => (
              <div key={c.room} className="flex justify-between items-center gap-3 py-[9px] border-b border-line">
                <div className="min-w-0">
                  <div className="t-title truncate">{c.guest}</div>
                  <div className="text-xs text-ink3 mt-0.5">{t('roomN', { number: c.room })} · {c.source}</div>
                </div>
                <span className="shrink-0"><Badge type="green">{t('checkedIn')}</Badge></span>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Register Summary */}
        <div className="card">
          <div className="t-title px-4 sm:px-[18px] py-3.5 border-b border-line">{t('cash.title')}</div>
          <div className="px-4 sm:px-[18px] py-2.5">
            {CASH_REGISTER.slice(0, 4).map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-[7px] border-b border-line">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-ink truncate">{tx.desc}</div>
                  <div className="text-xs text-ink3">{tx.time}</div>
                </div>
                <span className="t-xs ml-2 shrink-0 font-mono" style={{ color: tx.type === 'in' ? 'var(--green-text)' : 'var(--red-text)' }}>
                  {tx.type === 'in' ? '+' : '−'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-2.5 font-bold border-t border-line mt-1">
              <span className="t-xs">{t('cash.net')}</span>
              <span className="t-sm text-gold font-mono">{formatCurrency(cashIn - cashOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Housekeeping Status */}
      <div className="card">
        <div className="t-title px-4 sm:px-[18px] py-3.5 border-b border-line">{t('hk.title')}</div>
        <div className="px-4 sm:px-[18px] py-3.5 grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {HOUSEKEEPING_STATUS.map(r => (
            <div key={r.room} className="min-w-0 px-3 py-2.5 rounded-lg bg-surface2 border border-line text-center">
              <div className="t-title text-gold mb-1 font-mono">{r.room}</div>
              <HKBadge status={r.status} />
              <div className="text-xs text-ink3 mt-1 truncate">{r.assignee}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lock Confirm Modal */}
      <Modal
        isOpen={showLockConfirm}
        onClose={() => setShowLockConfirm(false)}
        title={t('lock.title')}
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setShowLockConfirm(false)}>{t('common:cancel')}</button>
            <button className="btn btn-primary btn-sm bg-gold text-black border-none inline-flex items-center gap-1.5" onClick={handleLock}>
              <LuLock size={14} /> {t('lock.confirm')}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink2 leading-[1.8] m-0">
          {t('lock.body')}
        </p>
        <div className="mt-4 px-3.5 py-3 bg-[var(--gold-bg)] rounded-lg flex flex-wrap justify-between gap-x-3 gap-y-1">
          <span className="t-title text-gold">{t('lock.netRevenue')}</span>
          <span className="font-bold text-gold font-mono">{formatCurrency(REVENUE_TODAY.total)}</span>
        </div>
      </Modal>
    </PageWrapper>
  )
}
