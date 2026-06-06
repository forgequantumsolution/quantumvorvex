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
        style={{ width, minWidth: width }}
        className={`h-[100dvh] bg-[#141414] flex flex-col overflow-y-auto overflow-x-hidden shrink-0 z-[100] transition-[width,min-width] duration-200 ease-[ease] ${sidebarOpen ? 'sb-open' : ''}`}
      >
        {/* Logo section */}
        <div className="border-b border-b-[rgba(255,255,255,0.07)]" style={{ padding: collapsed ? '18px 0 14px' : '20px 18px 16px' }}>
          <div className={`flex items-center gap-[11px] ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-[11px] min-w-0">
              {!collapsed && (
                <div className="min-w-0">
                  <div className="t-h2 text-[#fff] tracking-[-0.02em] leading-[1.2]">
                    {head && <span>{head} </span>}
                    <span className="text-[#c9a84c]">{tail}</span>
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
            <div className="flex justify-center mt-3">
              <CollapseButton collapsed={collapsed} onClick={toggleSidebarCollapsed} />
            </div>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-2">
          {filteredSections.map((section) => (
            <div key={section.label} className="mb-1">
              {!collapsed && (
                <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-[#3a3a3a] pt-2.5 px-[18px] pb-1">
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
        <div
          className={`border-t border-t-[rgba(255,255,255,0.07)] mt-auto ${collapsed ? 'py-3' : 'py-3 px-3.5'}`}
        >
          <div className={`flex items-center gap-2.5 mb-2.5 ${collapsed ? 'justify-center' : 'justify-start'}`}>
            <div
              title={collapsed ? `${userName} · ${roleLabel}` : undefined}
              className="w-8 h-8 rounded-full text-[#000] flex items-center justify-center text-[11.5px] font-bold shrink-0"
              style={{ background: roleColor }}
            >
              {userInitials}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-[#fff] text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                  {userName}
                </div>
                <div className="flex items-center gap-[5px] mt-0.5">
                  <span
                    className="text-[9px] font-bold tracking-[0.06em] uppercase px-[5px] py-px rounded-[3px]"
                    style={{ color: roleColor, background: roleColor + '1a' }}
                  >
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
              padding: collapsed ? '8px 0' : '7px 10px',
            }}
            className={`t-xs bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] rounded-md flex items-center gap-[7px] cursor-pointer text-[#dc5555] transition-all duration-[140ms] ${collapsed ? 'justify-center' : 'justify-start'}`}
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
      className={`w-7 h-7 shrink-0 rounded-md border border-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer transition-all duration-[140ms] ${hovered ? 'bg-[rgba(201,168,76,0.12)] text-[#c9a84c]' : 'bg-[rgba(255,255,255,0.04)] text-[#888]'}`}
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
      className={`flex items-center cursor-pointer text-[13.5px] transition-all duration-[120ms] select-none ${collapsed ? 'justify-center gap-0 py-[11px] px-0' : 'justify-start gap-2.5 py-[9px] px-4'} ${
        isActive
          ? 'text-[#fff] border-l-2 border-l-[#c9a84c] bg-[rgba(201,168,76,0.08)] font-medium'
          : `${hovered ? 'text-[#fff] bg-[rgba(255,255,255,0.04)]' : 'text-[#888] bg-transparent'} border-l-2 border-l-transparent font-normal`
      }`}
    >
      <span
        className={`w-5 flex items-center justify-center shrink-0 transition-[color] duration-[120ms] ${isActive || hovered ? 'text-[#c9a84c]' : 'text-[#8a857a]'}`}
      >
        <item.Icon size={17} strokeWidth={isActive ? 2.3 : 1.9} />
      </span>
      {!collapsed && <span className="flex-1">{item.label}</span>}
    </div>
  )
}
