import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { getAllowedPanels, ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions'

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: '▦',  shortcut: 'D' },
      { id: 'rooms',        label: 'Rooms',         icon: '⊟',  shortcut: 'R' },
      { id: 'floorplan',   label: 'Floor Plan',    icon: '◫',  shortcut: 'F' },
      { id: 'maintenance', label: 'Maintenance',   icon: '🔧', shortcut: 'M', badge: '3' },
      { id: 'housekeeping',label: 'Housekeeping',  icon: '🧹', shortcut: 'H', badge: '5' },
      { id: 'reports',     label: 'Reports',       icon: '◈',  shortcut: 'T' },
    ],
  },
  {
    label: 'Guests',
    items: [
      { id: 'checkin',   label: 'Check-In',   icon: '↗',  shortcut: 'C' },
      { id: 'guests',    label: 'All Guests', icon: '◎',  shortcut: 'G' },
      { id: 'bookings',  label: 'Bookings',   icon: '◷' },
      { id: 'channels',  label: 'Channels',   icon: '🔗' },
      { id: 'documents', label: 'Documents',  icon: '◫' },
    ],
  },
  {
    label: 'Services',
    items: [
      { id: 'food',    label: 'Food Options', icon: '⊕' },
      { id: 'billing', label: 'Billing',      icon: '◑', shortcut: 'B' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'staff',    label: 'Staff',    icon: '👤' },
      { id: 'settings', label: 'Settings', icon: '◌', shortcut: 'S' },
    ],
  },
]

function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function splitHotelName(name = '') {
  const words = name.trim().split(' ')
  if (words.length === 1) return { head: '', tail: words[0] }
  const tail = words[words.length - 1]
  const head = words.slice(0, -1).join(' ')
  return { head, tail }
}

export default function Sidebar() {
  const activePanel    = useStore((s) => s.activePanel)
  const setActivePanel = useStore((s) => s.setActivePanel)
  const sidebarOpen    = useStore((s) => s.sidebarOpen)
  const closeSidebar   = useStore((s) => s.closeSidebar)
  const darkMode       = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const hotelName      = useStore((s) => s.hotelName)
  const currentUser    = useStore((s) => s.currentUser)
  const logout         = useStore((s) => s.logout)

  const role          = currentUser?.role || 'staff'
  const allowedPanels = getAllowedPanels(role)
  const roleLabel     = ROLE_LABELS[role] || role
  const roleColor     = ROLE_COLORS[role] || '#888'

  const { head, tail } = splitHotelName(hotelName)
  const userInitials   = getInitials(currentUser?.name || 'Admin')
  const userName       = currentUser?.name || 'Admin'

  const handleNavClick = (panelId) => {
    setActivePanel(panelId)
    if (window.innerWidth < 1024) {
      closeSidebar()
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  // Filter sections to only show panels the role can access
  const filteredSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => allowedPanels.includes(item.id)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
      {/* Mobile overlay — CSS controls visibility via #sb-overlay */}
      <div id="sb-overlay" onClick={closeSidebar} />

      {/* Sidebar */}
      <div
        id="sidebar"
        style={{
          width: 252,
          minWidth: 252,
          height: '100dvh',
          background: '#141414',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
          zIndex: 100,
        }}
        className={sidebarOpen ? 'sb-open' : ''}
      >
        {/* Logo section */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 36, height: 36,
              background: '#c9a84c',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              🏨
            </div>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 15, fontWeight: 700,
                color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                {head && <span>{head} </span>}
                <span style={{ color: '#c9a84c' }}>{tail}</span>
              </div>
              <div style={{
                fontSize: 9.5, color: '#555', marginTop: 2,
                letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500,
              }}>
                Powered by Forge Quantum Solutions
              </div>
            </div>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            style={{
              marginTop: 13, width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 7,
              cursor: 'pointer', color: '#888', fontSize: 11.5,
              fontFamily: "'Inter', sans-serif", transition: 'all 0.14s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = '#c9a84c' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#888' }}
          >
            <span style={{ fontSize: 13 }}>{darkMode ? '☀' : '🌙'}</span>
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {filteredSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#3a3a3a',
                padding: '10px 18px 4px', fontFamily: "'Inter', sans-serif",
              }}>
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activePanel === item.id}
                  onClick={() => handleNavClick(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleColor,
              color: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 700, flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}>
              {userInitials}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                color: '#fff', fontSize: 12.5, fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {userName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: roleColor,
                  background: roleColor + '1a',
                  padding: '1px 5px', borderRadius: 3,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'rgba(220,53,69,0.08)',
              border: '1px solid rgba(220,53,69,0.2)',
              borderRadius: 6, padding: '7px 10px',
              display: 'flex', alignItems: 'center', gap: 7,
              cursor: 'pointer', color: '#dc5555', fontSize: 12,
              fontFamily: "'Inter', sans-serif", transition: 'all 0.14s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,53,69,0.16)'; e.currentTarget.style.borderColor = 'rgba(220,53,69,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,53,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,53,69,0.2)' }}
          >
            <span style={{ fontSize: 13 }}>⎋</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* overlay visibility is handled by index.css #sb-overlay rules */}
    </>
  )
}

function NavItem({ item, isActive, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', cursor: 'pointer', fontSize: 13.5,
        color: isActive ? '#fff' : hovered ? '#fff' : '#888',
        borderLeft: isActive ? '2px solid #c9a84c' : '2px solid transparent',
        background: isActive
          ? 'rgba(201,168,76,0.08)'
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'all 0.12s', userSelect: 'none',
        fontFamily: "'Inter', sans-serif",
        fontWeight: isActive ? 500 : 400,
      }}
    >
      <span style={{
        fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0,
        color: isActive ? '#c9a84c' : 'inherit',
      }}>
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span style={{
          background: '#c9a84c', color: '#000', fontSize: 9.5, fontWeight: 700,
          padding: '2px 6px', borderRadius: 20,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {item.badge}
        </span>
      )}
      {item.shortcut && !item.badge && (
        <span style={{
          fontSize: 9.5, color: '#3a3a3a',
          fontFamily: "'JetBrains Mono', monospace",
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 3, padding: '1px 4px',
        }}>
          {item.shortcut}
        </span>
      )}
    </div>
  )
}
