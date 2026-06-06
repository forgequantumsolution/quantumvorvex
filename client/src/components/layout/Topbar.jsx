import { useState, useEffect, useRef } from 'react'
import { LuMenu, LuSearch, LuBell, LuPlus } from 'react-icons/lu'
import { useAppSelector, useUiActions } from '../../store/hooks'

const PANEL_LABELS = {
  today:         'Today',
  bookings:      'Bookings',
  checkin:       'Check-In',
  checkout:      'Check-Out',
  cancellations: 'Cancellations',
  maintenance:   'Maintenance',
}

const MOCK_NOTIFS = [
  { id: 1, type: 'danger',  icon: '!', title: 'Overdue Invoice',    msg: 'INV-005 — Kavya Reddy (₹12,096)',      time: '2h ago',    read: false },
  { id: 2, type: 'warn',    icon: '⚠', title: 'Checkout Due',       msg: 'Sneha Rao — Room 118 due today',        time: '3h ago',    read: false },
  { id: 3, type: 'info',    icon: 'ℹ', title: 'Maintenance Ticket', msg: 'Room 105 AC servicing overdue 3 days',  time: '5h ago',    read: false },
  { id: 4, type: 'success', icon: '✓', title: 'Payment Received',   msg: 'INV-002 — Priya Mehta paid ₹83,440',    time: 'Yesterday', read: true  },
  { id: 5, type: 'info',    icon: 'ℹ', title: 'New Booking',        msg: 'Anjali Singh — Room 103, Apr 9-11',     time: 'Yesterday', read: true  },
]

const NOTIF_COLORS = {
  danger:  { bg: 'var(--red-bg)',   text: 'var(--red-text)'   },
  warn:    { bg: 'var(--amber-bg)', text: 'var(--amber-text)' },
  info:    { bg: 'var(--blue-bg)',  text: 'var(--blue-text)'  },
  success: { bg: 'var(--green-bg)', text: 'var(--green-text)' },
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
}

// Contextual primary action per page — label + the panel whose action it triggers.
const PRIMARY_ACTIONS = {
  today:         { label: 'New Booking',   target: 'bookings'      },
  bookings:      { label: 'New Booking',   target: 'bookings'      },
  checkin:       { label: 'Check In',      target: 'checkin'       },
  checkout:      { label: 'Check Out',     target: 'checkout'      },
  cancellations: { label: 'Cancel Booking', target: 'cancellations' },
  maintenance:   { label: 'New Ticket',    target: 'maintenance'   },
}
const DEFAULT_ACTION = { label: 'New Booking', target: 'bookings' }

export default function Topbar() {
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const { setActivePanel, toggleSidebar, setSearchOpen, requestPrimaryAction } = useUiActions()

  const primaryAction = PRIMARY_ACTIONS[activePanel] || DEFAULT_ACTION

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs,    setNotifs]    = useState(MOCK_NOTIFS)
  const notifRef = useRef(null)

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const unreadCount  = notifs.filter(n => !n.read).length
  const markAllRead  = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })))
  const dismissNotif = (id) => setNotifs(ns => ns.filter(n => n.id !== id))

  const pageTitle = PANEL_LABELS[activePanel] || activePanel

  const iconBtnClass = 'bg-transparent border border-line2 rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer text-ink2 shrink-0 transition-all duration-[140ms]'
  const hoverGold = {
    onMouseEnter: e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' },
    onMouseLeave: e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' },
  }

  return (
    <div id="topbar" className="h-[60px] min-h-[60px] bg-surface border-b border-line flex items-center px-[18px] gap-2.5 shrink-0">

      {/* Hamburger — mobile only */}
      <button onClick={toggleSidebar} className={`tb-hamburger ${iconBtnClass}`} aria-label="Menu">
        <LuMenu size={18} />
      </button>

      {/* Page title + today's date */}
      <div className="flex-1 min-w-0">
        <div className="t-h2 tracking-[-0.02em] leading-[1.15] whitespace-nowrap overflow-hidden text-ellipsis">{pageTitle}</div>
        <div className="text-[11.5px] text-ink3 font-medium mt-px">
          {todayLabel()}
        </div>
      </div>

      {/* Search — opens the global Ctrl+K search */}
      <button onClick={() => setSearchOpen(true)} className={iconBtnClass} {...hoverGold} aria-label="Search" title="Search (Ctrl+K)">
        <LuSearch size={17} />
      </button>

      {/* Notification bell */}
      <div ref={notifRef} className="relative shrink-0">
        <button
          onClick={() => setNotifOpen(o => !o)}
          className={`relative bg-transparent border rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer shrink-0 transition-all duration-[140ms] ${notifOpen ? 'bg-[var(--gold-bg)] border-gold text-gold' : 'border-line2 text-ink2'}`}
          onMouseEnter={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' } }}
          onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' } }}
          aria-label="Notifications"
        >
          <LuBell size={17} />
          {unreadCount > 0 && (
            <span className="absolute top-[5px] right-[5px] min-w-[15px] h-[15px] px-[3px] rounded-lg bg-danger text-[#fff] text-[9px] font-bold flex items-center justify-center border-2 border-surface leading-none">{unreadCount}</span>
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div className="absolute top-[44px] right-0 w-[340px] bg-surface border border-line rounded-[10px] shadow-[var(--shadow-md)] z-[500] overflow-hidden">
            <div className="px-4 py-3 flex justify-between items-center border-b border-line">
              <div>
                <span className="t-title">Notifications</span>
                {unreadCount > 0 && (
                  <span className="t-label ml-2 bg-danger-bg text-danger-text px-[7px] py-0.5 rounded-[10px]">{unreadCount} new</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="bg-transparent border-none cursor-pointer text-[11.5px] text-gold font-semibold">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="t-sm px-4 py-8 text-center text-ink3">All caught up ✓</div>
              ) : notifs.map(n => {
                const colors = NOTIF_COLORS[n.type] || NOTIF_COLORS.info
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-line flex gap-2.5 items-start ${n.read ? 'bg-transparent' : 'bg-surface2'}`}
                  >
                    <div className="t-xs w-7 h-7 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: colors.bg, color: colors.text }}>{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12.5px] text-ink mb-0.5 ${n.read ? 'font-medium' : 'font-bold'}`}>{n.title}</div>
                      <div className="text-[11.5px] text-ink3 leading-[1.4]">{n.msg}</div>
                      <div className="text-[10.5px] text-ink3 mt-1">{n.time}</div>
                    </div>
                    <button
                      onClick={() => dismissNotif(n.id)}
                      className="t-body bg-transparent border-none cursor-pointer text-ink3 p-0 shrink-0 leading-none"
                    >×</button>
                  </div>
                )
              })}
            </div>

            <div className="px-4 py-2.5 border-t border-line text-center">
              <button onClick={() => { setNotifOpen(false); setActivePanel('today') }}
                className="t-xs bg-transparent border-none cursor-pointer text-gold font-semibold">
                View all activity →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary action — contextual to the current page */}
      <button onClick={() => requestPrimaryAction(primaryAction.target)} className="btn btn-primary btn-sm shrink-0 gap-[5px]">
        <LuPlus size={15} /><span className="tb-checkin-text">{primaryAction.label}</span>
      </button>
    </div>
  )
}
