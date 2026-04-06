import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../store/useStore'

const PANEL_LABELS = {
  dashboard:   'Dashboard',
  rooms:       'Rooms',
  floorplan:   'Floor Plan',
  reports:     'Reports',
  checkin:     'Check-In',
  guests:      'All Guests',
  bookings:    'Bookings',
  documents:   'Documents',
  food:        'Food Options',
  billing:     'Billing',
  settings:    'Settings',
  maintenance: 'Maintenance',
  housekeeping:'Housekeeping',
  staff:       'Staff',
  channels:    'Channels',
  calendar:    'Room Calendar',
  nightaudit:  'Night Audit',
}

const MOCK_NOTIFS = [
  { id: 1, type: 'danger',  icon: '!', title: 'Overdue Invoice',          msg: 'INV-005 — Kavya Reddy (₹12,096)',        time: '2h ago',  read: false },
  { id: 2, type: 'warn',    icon: '⚠', title: 'Checkout Due',             msg: 'Sneha Rao — Room 118 due today',          time: '3h ago',  read: false },
  { id: 3, type: 'info',    icon: 'ℹ', title: 'Maintenance Ticket',       msg: 'Room 105 AC servicing overdue 3 days',    time: '5h ago',  read: false },
  { id: 4, type: 'success', icon: '✓', title: 'Payment Received',         msg: 'INV-002 — Priya Mehta paid ₹83,440',     time: 'Yesterday', read: true },
  { id: 5, type: 'info',    icon: 'ℹ', title: 'New Booking',              msg: 'Anjali Singh — Room 103, Apr 9-11',       time: 'Yesterday', read: true },
]

const NOTIF_COLORS = {
  danger:  { bg: 'var(--red-bg)',   text: 'var(--red-text)',   dot: 'var(--red)'   },
  warn:    { bg: 'var(--amber-bg)', text: 'var(--amber-text)', dot: 'var(--amber)' },
  info:    { bg: 'var(--blue-bg)',  text: 'var(--blue-text)',  dot: 'var(--blue)'  },
  success: { bg: 'var(--green-bg)', text: 'var(--green-text)', dot: 'var(--green)' },
}

function pad(n) { return String(n).padStart(2, '0') }
function formatTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function formatDate(d) { return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) }

export default function Topbar() {
  const activePanel    = useStore((s) => s.activePanel)
  const setActivePanel = useStore((s) => s.setActivePanel)
  const toggleSidebar  = useStore((s) => s.toggleSidebar)
  const darkMode       = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const setSearchOpen  = useStore((s) => s.setSearchOpen)

  const [time, setTime]                     = useState(new Date())
  const [searchFocused, setSearchFocused]   = useState(false)
  const [searchValue,   setSearchValue]     = useState('')
  const [notifOpen,     setNotifOpen]       = useState(false)
  const [notifs,        setNotifs]          = useState(MOCK_NOTIFS)
  const notifRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const handleSearchChange = useCallback((e) => {
    setSearchValue(e.target.value)
    setSearchOpen(e.target.value.length > 0)
  }, [setSearchOpen])

  const unreadCount = notifs.filter(n => !n.read).length

  const markAllRead  = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })))
  const dismissNotif = (id) => setNotifs(ns => ns.filter(n => n.id !== id))

  const pageTitle = PANEL_LABELS[activePanel] || activePanel

  return (
    <div id="topbar" style={{
      height: 54, minHeight: 54,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 8, flexShrink: 0,
      overflow: 'hidden',
    }}>

      {/* Hamburger */}
      <button onClick={toggleSidebar} className="tb-hamburger" style={{
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 6, width: 34, height: 34,
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text2)',
        flexShrink: 0, fontSize: 16,
      }} aria-label="Menu">☰</button>

      {/* Page title */}
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 16, fontWeight: 700,
        color: 'var(--text)', letterSpacing: '-0.02em',
        flex: 1, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        minWidth: 0,
      }}>{pageTitle}</div>

      {/* Status pills */}
      <div className="tb-pills" style={{ alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {[
          { label: '12 available', bg: 'var(--green-bg)',  fg: 'var(--green-text)',  dot: 'var(--green)' },
          { label: '5 due today',  bg: 'var(--amber-bg)',  fg: 'var(--amber-text)',  dot: 'var(--amber)' },
          { label: '2 overdue',    bg: 'var(--red-bg)',    fg: 'var(--red-text)',    dot: 'var(--red)'   },
        ].map(p => (
          <span key={p.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 20,
            fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
            background: p.bg, color: p.fg,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, display: 'inline-block' }} />
            {p.label}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="tb-search" style={{
        position: 'relative', flexShrink: 0,
        transition: 'width 0.18s ease',
        width: searchFocused ? 240 : 180,
      }}>
        <span style={{
          position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text3)', fontSize: 14, pointerEvents: 'none', lineHeight: 1,
        }}>⌕</span>
        <input
          type="text" value={searchValue}
          onChange={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search… (Ctrl+K)"
          style={{
            width: '100%', paddingLeft: 28, paddingRight: 10,
            paddingTop: 6, paddingBottom: 6, borderRadius: 20,
            border: `1px solid ${searchFocused ? 'var(--gold)' : 'var(--border)'}`,
            background: 'var(--surface2)', color: 'var(--text)',
            fontSize: 12.5, fontFamily: "'Inter', sans-serif",
            outline: 'none',
            boxShadow: searchFocused ? '0 0 0 3px var(--gold-bg)' : 'none',
            transition: 'border-color 0.14s, box-shadow 0.14s',
          }}
        />
      </div>

      {/* Notification bell */}
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{
            background: notifOpen ? 'var(--gold-bg)' : 'none',
            border: `1px solid ${notifOpen ? 'var(--gold)' : 'var(--border2)'}`,
            borderRadius: 6, width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: notifOpen ? 'var(--gold)' : 'var(--text2)',
            flexShrink: 0, fontSize: 15, transition: 'all 0.14s',
            position: 'relative',
          }}
          onMouseEnter={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' } }}
          onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' } }}
          aria-label="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--red)', border: '2px solid var(--surface)',
            }} />
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div style={{
            position: 'absolute', top: 40, right: 0,
            width: 340, background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow-md)',
            zIndex: 500, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Notifications</span>
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

            {/* Notifications list */}
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
                    transition: 'background 0.1s',
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

            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <button onClick={() => { setNotifOpen(false); setActivePanel('dashboard') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                View all activity →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <button onClick={toggleDarkMode} style={{
        background: 'none', border: '1px solid var(--border2)',
        borderRadius: 6, width: 34, height: 34,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text2)',
        flexShrink: 0, fontSize: 15, transition: 'all 0.14s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >{darkMode ? '☀' : '🌙'}</button>

      {/* Live clock */}
      <div className="tb-clock" style={{ flexShrink: 0, textAlign: 'right', minWidth: 68 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
          {formatTime(time)}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>
          {formatDate(time)}
        </div>
      </div>

      {/* Check-In CTA */}
      <button onClick={() => setActivePanel('checkin')} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
        +<span className="tb-checkin-text"> Check-In</span>
      </button>
    </div>
  )
}
