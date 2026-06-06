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

  const iconBtn = {
    background: 'none', border: '1px solid var(--border2)',
    borderRadius: 8, width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--text2)',
    flexShrink: 0, transition: 'all 0.14s',
  }
  const hoverGold = {
    onMouseEnter: e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' },
    onMouseLeave: e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' },
  }

  return (
    <div id="topbar" style={{
      height: 60, minHeight: 60,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 18px', gap: 10, flexShrink: 0,
    }}>

      {/* Hamburger — mobile only */}
      <button onClick={toggleSidebar} className="tb-hamburger" style={iconBtn} aria-label="Menu">
        <LuMenu size={18} />
      </button>

      {/* Page title + today's date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18, fontWeight: 700,
          color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{pageTitle}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 500, marginTop: 1 }}>
          {todayLabel()}
        </div>
      </div>

      {/* Search — opens the global Ctrl+K search */}
      <button onClick={() => setSearchOpen(true)} style={iconBtn} {...hoverGold} aria-label="Search" title="Search (Ctrl+K)">
        <LuSearch size={17} />
      </button>

      {/* Notification bell */}
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{
            ...iconBtn,
            background: notifOpen ? 'var(--gold-bg)' : 'none',
            borderColor: notifOpen ? 'var(--gold)' : 'var(--border2)',
            color: notifOpen ? 'var(--gold)' : 'var(--text2)',
            position: 'relative',
          }}
          onMouseEnter={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' } }}
          onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' } }}
          aria-label="Notifications"
        >
          <LuBell size={17} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 5, right: 5,
              minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8,
              background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--surface)', lineHeight: 1,
            }}>{unreadCount}</span>
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div style={{
            position: 'absolute', top: 44, right: 0,
            width: 340, background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow-md)',
            zIndex: 500, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{ marginLeft: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{unreadCount} new</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>All caught up ✓</div>
              ) : notifs.map(n => {
                const colors = NOTIF_COLORS[n.type] || NOTIF_COLORS.info
                return (
                  <div key={n.id} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'var(--surface2)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: colors.bg, color: colors.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{n.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 700, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>{n.msg}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4 }}>{n.time}</div>
                    </div>
                    <button
                      onClick={() => dismissNotif(n.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}
                    >×</button>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <button onClick={() => { setNotifOpen(false); setActivePanel('today') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                View all activity →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary action — contextual to the current page */}
      <button onClick={() => requestPrimaryAction(primaryAction.target)} className="btn btn-primary btn-sm" style={{ flexShrink: 0, gap: 5 }}>
        <LuPlus size={15} /><span className="tb-checkin-text">{primaryAction.label}</span>
      </button>
    </div>
  )
}
