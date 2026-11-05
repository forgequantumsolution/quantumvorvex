import { LuMenu } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useUiActions } from '../../store/hooks'
import { getAllowedPanels } from '../../utils/permissions'
import { BOTTOM_NAV_IDS, PANEL_META, navLabel } from '../../utils/navigation'

/**
 * Phone-only (< md) tab bar pinned to the bottom of the screen: the everyday
 * pages plus "More", which opens the full navigation drawer. Pages the user
 * can't access are dropped, the same way the sidebar filters them.
 *
 * Its height is published as --bottom-nav-h (index.css), which #content, the
 * toasts and the floating buttons use to stay clear of it.
 */
export default function BottomNav() {
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen)
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const { setActivePanel, openSidebar, closeSidebar } = useUiActions()
  const { t } = useTranslation('shell')

  const allowed = getAllowedPanels(currentUser)
  const items = BOTTOM_NAV_IDS
    .filter((id) => allowed.includes(id) && PANEL_META[id])
    .map((id) => ({ id, ...PANEL_META[id], label: navLabel(t, id) }))
  const onQuickTab = items.some((i) => i.id === activePanel)

  const go = (id) => {
    closeSidebar()
    setActivePanel(id)
  }

  return (
    <nav
      id="bottom-nav"
      aria-label={t('quickNavigation')}
      className="md:hidden fixed inset-x-0 bottom-0 z-[140] bg-surface border-t border-line
                 shadow-[0_-4px_14px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]
                 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <ul
        className="grid h-[60px] list-none m-0 p-0"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <NavTab
              item={item}
              active={!sidebarOpen && activePanel === item.id}
              onClick={() => go(item.id)}
            />
          </li>
        ))}
        <li className="min-w-0">
          <NavTab
            item={{ ...MORE_ITEM, label: t('common:more') }}
            active={sidebarOpen || !onQuickTab}
            onClick={sidebarOpen ? closeSidebar : openSidebar}
            ariaExpanded={sidebarOpen}
          />
        </li>
      </ul>
    </nav>
  )
}

const MORE_ITEM = { Icon: LuMenu }

function NavTab({ item, active, onClick, ariaExpanded }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active && ariaExpanded === undefined ? 'page' : undefined}
      aria-expanded={ariaExpanded}
      className={`relative w-full h-full flex flex-col items-center justify-center gap-1 bg-transparent border-0 cursor-pointer
                  font-sans text-[12px] leading-none transition-colors duration-[120ms]
                  ${active ? 'text-gold font-semibold' : 'text-ink3 font-medium active:text-ink2'}`}
    >
      {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b bg-gold" />}
      <item.Icon size={21} strokeWidth={active ? 2.3 : 1.9} />
      <span className="truncate max-w-full px-1">{item.label}</span>
    </button>
  )
}
