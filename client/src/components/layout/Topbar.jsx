import { useState, useEffect, useCallback } from 'react'
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
}

function pad(n) { return String(n).padStart(2, '0') }
function formatTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function formatDate(d) { return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) }

export default function Topbar() {
  const activePanel   = useStore((s) => s.activePanel)
  const setActivePanel= useStore((s) => s.setActivePanel)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const darkMode      = useStore((s) => s.darkMode)
  const toggleDarkMode= useStore((s) => s.toggleDarkMode)
  const setSearchOpen = useStore((s) => s.setSearchOpen)

  const [time, setTime]               = useState(new Date())
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue,   setSearchValue]   = useState('')

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSearchChange = useCallback((e) => {
    setSearchValue(e.target.value)
    setSearchOpen(e.target.value.length > 0)
  }, [setSearchOpen])

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

      {/* Hamburger — shown via .tb-hamburger CSS on mobile */}
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

      {/* Status pills — hidden on mobile via .tb-pills */}
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

      {/* Search — hidden on mobile via .tb-search */}
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

      {/* Live clock — hidden on mobile via .tb-clock */}
      <div className="tb-clock" style={{ flexShrink: 0, textAlign: 'right', minWidth: 68 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
          {formatTime(time)}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>
          {formatDate(time)}
        </div>
      </div>

      {/* Check-In */}
      <button onClick={() => setActivePanel('checkin')} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
        +<span className="tb-checkin-text"> Check-In</span>
      </button>
    </div>
  )
}
