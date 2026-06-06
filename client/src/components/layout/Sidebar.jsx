import { useEffect, useState } from 'react'
import {
  LuLayoutDashboard, LuCalendarCheck, LuLogIn, LuLogOut, LuCalendarX, LuWrench,
  LuUsers, LuBedDouble, LuFileText, LuUtensils, LuSparkles,
  LuCreditCard, LuChartColumn, LuUserCog, LuSettings,
  LuPower, LuChevronsLeft, LuChevronsRight,
} from 'react-icons/lu'
import { useAppSelector, useUiActions, useAuthActions } from '../../store/hooks'
import { getAllowedPanels, ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { id: 'today',         label: 'Today',         Icon: LuLayoutDashboard },
    ],
  },
  {
    label: 'Front Desk',
    items: [
      { id: 'bookings',      label: 'Bookings',      Icon: LuCalendarCheck },
      { id: 'checkin',       label: 'Check-In',      Icon: LuLogIn },
      { id: 'checkout',      label: 'Check-Out',     Icon: LuLogOut },
      { id: 'cancellations', label: 'Cancellations', Icon: LuCalendarX },
      { id: 'maintenance',   label: 'Maintenance',   Icon: LuWrench },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'guests',        label: 'Guests',        Icon: LuUsers },
      { id: 'rooms',         label: 'Rooms',         Icon: LuBedDouble },
      { id: 'documents',     label: 'Documents',     Icon: LuFileText },
      { id: 'food',          label: 'Food',          Icon: LuUtensils },
      { id: 'housekeeping',  label: 'Housekeeping',  Icon: LuSparkles },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'billing',       label: 'Billing',       Icon: LuCreditCard },
      { id: 'reports',       label: 'Reports',       Icon: LuChartColumn },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'staff',         label: 'Staff',         Icon: LuUserCog },
      { id: 'settings',      label: 'Settings',      Icon: LuSettings },
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
  const activePanel      = useAppSelector((s) => s.ui.activePanel)
  const sidebarOpen      = useAppSelector((s) => s.ui.sidebarOpen)
  const sidebarCollapsed = useAppSelector((s) => s.ui.sidebarCollapsed)
  const hotelName        = useAppSelector((s) => s.hotel.hotelName)
  const currentUser      = useAppSelector((s) => s.auth.currentUser)
  const { setActivePanel, closeSidebar, toggleSidebarCollapsed } = useUiActions()
  const { logout } = useAuthActions()

  // Collapse is a desktop-only affordance; the mobile drawer always shows full.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  )
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const collapsed = sidebarCollapsed && isDesktop

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

  const width = collapsed ? 72 : 252

  return (
    <>
      {/* Mobile overlay — only rendered when sidebar is open */}
      {sidebarOpen && <div id="sb-overlay" onClick={closeSidebar} />}

      {/* Sidebar */}
      <div
        id="sidebar"
        style={{
          width,
          minWidth: width,
          height: '100dvh',
          background: '#141414',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
          zIndex: 100,
          transition: 'width 0.2s ease, min-width 0.2s ease',
        }}
        className={sidebarOpen ? 'sb-open' : ''}
      >
        {/* Logo section */}
        <div style={{ padding: collapsed ? '18px 0 14px' : '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            justifyContent: collapsed ? 'center' : 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Playfair Display', sans-serif",
                    fontSize: 17, fontWeight: 700,
                    color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2,
                  }}>
                    {head && <span>{head} </span>}
                    <span style={{ color: '#c9a84c' }}>{tail}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Collapse toggle — desktop only */}
            {isDesktop && !collapsed && (
              <CollapseButton collapsed={collapsed} onClick={toggleSidebarCollapsed} />
            )}
          </div>

          {/* Expand toggle (collapsed state) — centered under the logo */}
          {isDesktop && collapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <CollapseButton collapsed={collapsed} onClick={toggleSidebarCollapsed} />
            </div>
          )}
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {filteredSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#3a3a3a',
                  padding: '10px 18px 4px', fontFamily: "'DM Sans', sans-serif",
                }}>
                  {section.label}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activePanel === item.id}
                  collapsed={collapsed}
                  onClick={() => handleNavClick(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: collapsed ? '12px 0' : '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          marginTop: 'auto',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10, marginBottom: 10,
          }}>
            <div
              title={collapsed ? `${userName} · ${roleLabel}` : undefined}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: roleColor,
                color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11.5, fontWeight: 700, flexShrink: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {userInitials}
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  color: '#fff', fontSize: 12.5, fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
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
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {roleLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              width: collapsed ? 40 : '100%',
              marginLeft: collapsed ? 'auto' : 0,
              marginRight: collapsed ? 'auto' : 0,
              background: 'rgba(220,53,69,0.08)',
              border: '1px solid rgba(220,53,69,0.2)',
              borderRadius: 6, padding: collapsed ? '8px 0' : '7px 10px',
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start', gap: 7,
              cursor: 'pointer', color: '#dc5555', fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", transition: 'all 0.14s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,53,69,0.16)'; e.currentTarget.style.borderColor = 'rgba(220,53,69,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,53,69,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,53,69,0.2)' }}
          >
            <LuPower size={15} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* overlay visibility is handled by index.css #sb-overlay rules */}
    </>
  )
}

function CollapseButton({ collapsed, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: 6,
        background: hovered ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: hovered ? '#c9a84c' : '#888',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.14s',
      }}
    >
      {collapsed ? <LuChevronsRight size={16} /> : <LuChevronsLeft size={16} />}
    </button>
  )
}

function NavItem({ item, isActive, collapsed, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '11px 0' : '9px 16px',
        cursor: 'pointer', fontSize: 13.5,
        color: isActive ? '#fff' : hovered ? '#fff' : '#888',
        borderLeft: isActive ? '2px solid #c9a84c' : '2px solid transparent',
        background: isActive
          ? 'rgba(201,168,76,0.08)'
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'all 0.12s', userSelect: 'none',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: isActive ? 500 : 400,
      }}
    >
      <span style={{
        width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: isActive ? '#c9a84c' : hovered ? '#c9a84c' : '#8a857a',
        transition: 'color 0.12s',
      }}>
        <item.Icon size={17} strokeWidth={isActive ? 2.3 : 1.9} />
      </span>
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
    </div>
  )
}
