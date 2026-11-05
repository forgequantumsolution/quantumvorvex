import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPower, LuChevronsLeft, LuChevronsRight, LuX } from 'react-icons/lu'
import { useAppSelector, useUiActions, useAuthActions } from '../../store/hooks'
import { getAllowedPanels } from '../../utils/permissions'
import { NAV_SECTIONS, navLabel } from '../../utils/navigation'
import { useBreakpoint } from '../../hooks/useMediaQuery'

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

const FULL_WIDTH = 252
const RAIL_WIDTH = 72

/**
 * Main navigation, in three shapes (see useBreakpoint):
 *   phone   < 768   off-canvas drawer, opened by the bottom bar's "More" tab
 *   tablet  768–1279 72px icon rail; expanding floats the full sidebar over the page
 *   desktop ≥ 1280  full 252px sidebar, collapsible to the rail (persisted)
 *
 * The sidebar itself is always position:fixed; an in-flow spacer (#sb-spacer)
 * reserves the rail / full width on tablet + desktop so content never sits under it.
 */
export default function Sidebar() {
  const activePanel      = useAppSelector((s) => s.ui.activePanel)
  const sidebarOpen      = useAppSelector((s) => s.ui.sidebarOpen)
  const sidebarCollapsed = useAppSelector((s) => s.ui.sidebarCollapsed)
  const hotelName        = useAppSelector((s) => s.hotel.hotelName)
  const currentUser      = useAppSelector((s) => s.auth.currentUser)
  const { setActivePanel, openSidebar, closeSidebar, toggleSidebarCollapsed } = useUiActions()
  const { logout } = useAuthActions()
  const { isPhone, isTablet, isDesktop } = useBreakpoint()
  const { t } = useTranslation('shell')

  // Labels visible? Phone drawer: always. Tablet: only while expanded. Desktop: unless collapsed.
  const expanded = isPhone || (isTablet ? sidebarOpen : !sidebarCollapsed)
  const collapsed = !expanded
  // Floating = drawn over the page with a backdrop (phone drawer, expanded tablet rail).
  const floating = (isPhone || isTablet) && sidebarOpen
  const offCanvas = isPhone && !sidebarOpen
  const spacerWidth = isDesktop && !sidebarCollapsed ? FULL_WIDTH : RAIL_WIDTH

  // Crossing a breakpoint resets the transient open state (e.g. rotating a tablet).
  useEffect(() => { closeSidebar() }, [isPhone, isTablet, closeSidebar])

  // ESC closes the drawer / expanded rail.
  useEffect(() => {
    if (!floating) return
    const onKey = (e) => { if (e.key === 'Escape') closeSidebar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [floating, closeSidebar])

  const allowedPanels = getAllowedPanels(currentUser)
  const roleLabel     = currentUser?.roleName || t('user')
  const roleColor     = currentUser?.isOwner ? '#c9a84c' : '#4c9ac9'

  const { head, tail } = splitHotelName(hotelName)
  const userInitials   = getInitials(currentUser?.name || 'Admin')
  const userName       = currentUser?.name || 'Admin'

  const handleNavClick = (panelId) => {
    setActivePanel(panelId)
    if (!isDesktop) closeSidebar()
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

  const width = collapsed ? RAIL_WIDTH : isPhone ? 'min(288px, 86vw)' : FULL_WIDTH

  // Header toggle: desktop collapses/expands in place; tablet expands over the page.
  let toggle = null
  if (isDesktop) {
    toggle = <CollapseButton collapsed={collapsed} onClick={toggleSidebarCollapsed} />
  } else if (isTablet) {
    toggle = <CollapseButton collapsed={collapsed} onClick={collapsed ? openSidebar : closeSidebar} />
  } else {
    toggle = (
      <button
        onClick={closeSidebar}
        aria-label={t('closeMenu')}
        className="w-10 h-10 -mr-1.5 shrink-0 rounded-lg flex items-center justify-center bg-transparent border-0 text-[#888] cursor-pointer active:bg-[rgba(255,255,255,0.06)]"
      >
        <LuX size={20} />
      </button>
    )
  }

  return (
    <>
      {/* Reserves the rail / sidebar width in the row (tablet + desktop) */}
      <div
        id="sb-spacer"
        aria-hidden="true"
        className="hidden md:block shrink-0 transition-[width] duration-200 ease-out"
        style={{ width: spacerWidth }}
      />

      {floating && (
        <div
          id="sb-overlay"
          onClick={closeSidebar}
          className="fixed inset-0 z-[205] bg-black/50 animate-[qvFade_.18s_ease-out]"
        />
      )}

      <aside
        id="sidebar"
        aria-label={t('mainNavigation')}
        style={{ width }}
        className={`fixed left-0 top-0 z-[210] h-[100dvh] bg-[#141414] flex flex-col overflow-y-auto overflow-x-hidden
                    pl-[env(safe-area-inset-left)]
                    transition-[width,transform,visibility,box-shadow] duration-200 ease-out
                    ${offCanvas ? '-translate-x-full invisible' : 'translate-x-0 visible'}
                    ${floating ? 'shadow-[6px_0_32px_rgba(0,0,0,0.55)]' : ''}
                    ${sidebarOpen ? 'sb-open' : ''}`}
      >
        {/* Logo section */}
        <div
          className="border-b border-b-[rgba(255,255,255,0.07)] pt-[env(safe-area-inset-top)]"
        >
          <div
            className={`flex items-center gap-[11px] ${collapsed ? 'flex-col justify-center py-4' : 'justify-between pl-[18px] pr-3.5 py-4 min-h-[64px]'}`}
          >
            {!collapsed && (
              <div className="min-w-0 t-h2 text-[#fff] tracking-[-0.02em] leading-[1.2] truncate">
                {head && <span>{head} </span>}
                <span className="text-[#c9a84c]">{tail}</span>
              </div>
            )}
            {toggle}
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-2">
          {filteredSections.map((section, i) => (
            <div key={section.key} className="mb-1">
              {collapsed ? (
                i > 0 && <div className="mx-4 my-1.5 h-px bg-[rgba(255,255,255,0.06)]" />
              ) : (
                <div className="text-[12px] xl:text-[10px] font-bold tracking-[0.1em] uppercase text-[#6b6455] pt-2.5 px-[18px] pb-1">
                  {navLabel(t, section.key)}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={{ ...item, label: navLabel(t, item.id) }}
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
          className={`border-t border-t-[rgba(255,255,255,0.07)] mt-auto pt-3 pb-[max(12px,env(safe-area-inset-bottom))] ${collapsed ? '' : 'px-3.5'}`}
        >
          <div className={`flex items-center gap-2.5 mb-2.5 ${collapsed ? 'justify-center' : 'justify-start'}`}>
            <div
              title={collapsed ? `${userName} · ${roleLabel}` : undefined}
              className="w-8 h-8 rounded-full text-[#000] flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: roleColor }}
            >
              {userInitials}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-[#fff] text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                  {userName}
                </div>
                <div className="flex items-center gap-[5px] mt-0.5">
                  <span
                    className="text-[10px] font-bold tracking-[0.06em] uppercase px-[5px] py-px rounded-[3px]"
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
            title={t('common:signOut')}
            className={`t-xs bg-[rgba(220,53,69,0.08)] border border-[rgba(220,53,69,0.2)] rounded-md flex items-center gap-[7px] cursor-pointer text-[#dc5555] transition-all duration-[140ms]
                        hover:bg-[rgba(220,53,69,0.16)] hover:border-[rgba(220,53,69,0.4)]
                        min-h-11 xl:min-h-0
                        ${collapsed ? 'w-10 mx-auto justify-center py-2' : 'w-full justify-start px-2.5 py-[7px]'}`}
          >
            <LuPower size={15} />
            {!collapsed && <span>{t('common:signOut')}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

function CollapseButton({ collapsed, onClick }) {
  const { t } = useTranslation('shell')
  const label = collapsed ? t('expandSidebar') : t('collapseSidebar')
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 shrink-0 rounded-md border border-[rgba(255,255,255,0.08)] flex items-center justify-center cursor-pointer transition-all duration-[140ms] bg-[rgba(255,255,255,0.04)] text-[#888] hover:bg-[rgba(201,168,76,0.12)] hover:text-[#c9a84c]"
    >
      {collapsed ? <LuChevronsRight size={16} /> : <LuChevronsLeft size={16} />}
    </button>
  )
}

function NavItem({ item, isActive, collapsed, onClick }) {
  const [hovered, setHovered] = useState(false)
  const itemRef = useRef(null)
  // Viewport coords for the tooltip — fixed positioning escapes the
  // sidebar's overflow-x-hidden clipping.
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 })

  const handleMouseEnter = () => {
    setHovered(true)
    if (collapsed && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      setTipPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
    }
  }

  return (
    <button
      ref={itemRef}
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full flex items-center cursor-pointer text-[14px] xl:text-[13.5px] font-sans text-left transition-all duration-[120ms] select-none border-0 border-l-2 min-h-11 xl:min-h-0 ${collapsed ? 'justify-center gap-0 py-[11px] px-0' : 'justify-start gap-2.5 py-[9px] px-4'} ${
        isActive
          ? 'text-[#fff] border-l-[#c9a84c] bg-[rgba(201,168,76,0.08)] font-medium'
          : `${hovered ? 'text-[#fff] bg-[rgba(255,255,255,0.04)]' : 'text-[#888] bg-transparent'} border-l-transparent font-normal`
      }`}
    >
      <span
        className={`w-5 flex items-center justify-center shrink-0 transition-[color] duration-[120ms] ${isActive || hovered ? 'text-[#c9a84c]' : 'text-[#8a857a]'}`}
      >
        <item.Icon size={17} strokeWidth={isActive ? 2.3 : 1.9} />
      </span>
      {!collapsed && <span className="flex-1">{item.label}</span>}

      {/* Tooltip — collapsed state only */}
      {collapsed && hovered && (
        <span
          className="fixed -translate-y-1/2 z-[300] pointer-events-none whitespace-nowrap bg-[#1f1f1f] text-[#fff] text-[12px] font-medium px-2.5 py-1.5 rounded-md border border-[rgba(255,255,255,0.1)] shadow-[0_4px_14px_rgba(0,0,0,0.45)]"
          style={{ top: tipPos.top, left: tipPos.left }}
          role="tooltip"
        >
          {item.label}
          <span className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1f1f1f] border-l border-b border-[rgba(255,255,255,0.1)]" />
        </span>
      )}
    </button>
  )
}
