import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'

const PANEL_LABELS = {
  dashboard: 'Dashboard',
  rooms: 'Rooms',
  floorplan: 'Floor Plan',
  reports: 'Reports',
  checkin: 'Check-In',
  guests: 'All Guests',
  bookings: 'Bookings',
  documents: 'Documents',
  food: 'Food Options',
  billing: 'Billing',
  settings: 'Settings',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function Topbar() {
  const activePanel = useStore((s) => s.activePanel)
  const setActivePanel = useStore((s) => s.setActivePanel)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const darkMode = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const setSearchOpen = useStore((s) => s.setSearchOpen)

  const [time, setTime] = useState(new Date())
  const [searchFocused, setSearchFocused] = useState(false)
  const [dmHovered, setDmHovered] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSearchChange = useCallback(
    (e) => {
      setSearchValue(e.target.value)
      setSearchOpen(e.target.value.length > 0)
    },
    [setSearchOpen]
  )

  const pageTitle = PANEL_LABELS[activePanel] || activePanel

  return (
    <div
      id="topbar"
      style={{
        height: 54,
        minHeight: 54,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden"
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text2)',
          flexShrink: 0,
          fontSize: 16,
        }}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Page title */}
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {pageTitle}
      </div>

      {/* Status pills — hidden on mobile */}
      <div
        className="hidden sm:flex"
        style={{ alignItems: 'center', gap: 6, flexShrink: 0 }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 500,
            background: 'var(--green-bg)',
            color: 'var(--green-text)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--green)',
              display: 'inline-block',
            }}
          />
          12 available
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 500,
            background: 'var(--amber-bg)',
            color: 'var(--amber-text)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--amber)',
              display: 'inline-block',
            }}
          />
          5 due today
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 500,
            background: 'var(--red-bg)',
            color: 'var(--red-text)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--red)',
              display: 'inline-block',
            }}
          />
          2 overdue
        </span>
      </div>

      {/* Search input */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          transition: 'width 0.18s ease',
          width: searchFocused ? 260 : 200,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text3)',
            fontSize: 14,
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          ⌕
        </span>
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search... (Ctrl+K)"
          style={{
            width: '100%',
            paddingLeft: 28,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 20,
            border: `1px solid ${searchFocused ? 'var(--gold)' : 'var(--border)'}`,
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontSize: 12.5,
            fontFamily: "'Inter', sans-serif",
            outline: 'none',
            boxShadow: searchFocused ? '0 0 0 3px var(--gold-bg)' : 'none',
            transition: 'border-color 0.14s, box-shadow 0.14s',
          }}
        />
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        onMouseEnter={() => setDmHovered(true)}
        onMouseLeave={() => setDmHovered(false)}
        style={{
          background: 'none',
          border: `1px solid ${dmHovered ? 'var(--gold)' : 'var(--border2)'}`,
          borderRadius: 6,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: dmHovered ? 'var(--gold)' : 'var(--text2)',
          flexShrink: 0,
          fontSize: 15,
          transition: 'all 0.14s',
        }}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? '☀' : '🌙'}
      </button>

      {/* Live clock */}
      <div
        style={{
          flexShrink: 0,
          textAlign: 'right',
          minWidth: 72,
        }}
        className="hidden md:block"
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {formatTime(time)}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            color: 'var(--text3)',
            lineHeight: 1.3,
          }}
        >
          {formatDate(time)}
        </div>
      </div>

      {/* Check-In button */}
      <button
        onClick={() => setActivePanel('checkin')}
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0 }}
      >
        + Check-In
      </button>
    </div>
  )
}
