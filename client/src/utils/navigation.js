import {
  LuLayoutDashboard, LuCalendarCheck, LuCalendarX, LuWrench,
  LuUsers, LuBedDouble, LuFileText, LuUtensils, LuSparkles,
  LuCreditCard, LuChartColumn, LuUserCog, LuSettings, LuBuilding2,
} from 'react-icons/lu'

// Single source of truth for the app's navigation structure — consumed by the
// Sidebar (nav rail) and the Topbar (breadcrumb).
export const NAV_SECTIONS = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { id: 'portfolio',     label: 'Portfolio',     Icon: LuBuilding2 },
      { id: 'today',         label: 'Today',         Icon: LuLayoutDashboard },
    ],
  },
  {
    key: 'frontDesk',
    label: 'Front Desk',
    items: [
      { id: 'bookings',      label: 'Bookings',      Icon: LuCalendarCheck },
      { id: 'cancellations', label: 'Cancellations', Icon: LuCalendarX },
      { id: 'maintenance',   label: 'Maintenance',   Icon: LuWrench },
    ],
  },
  {
    key: 'operations',
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
    key: 'finance',
    label: 'Finance',
    items: [
      { id: 'billing',       label: 'Billing',       Icon: LuCreditCard },
      { id: 'reports',       label: 'Reports',       Icon: LuChartColumn },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    items: [
      { id: 'users',         label: 'Users & Roles', Icon: LuUserCog },
      { id: 'settings',      label: 'Settings',      Icon: LuSettings },
    ],
  },
]

// English labels are kept as fallbacks; screens show them translated with
// t(`nav:${id}`) / t(`nav:${section.key}`) at render time (see navLabel below).
// panel id → { label, section, sectionKey, Icon } lookup, e.g. reports → { label: 'Reports', section: 'Finance', Icon }
export const PANEL_META = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => [item.id, { label: item.label, section: section.label, sectionKey: section.key, Icon: item.Icon }]),
  ),
)

// Phone bottom bar: the everyday front-desk pages, one tap away. Everything
// else (and these, too) stays in the drawer opened by the bar's "More" tab.
// Items the user can't access are dropped, exactly as in the sidebar.
export const BOTTOM_NAV_IDS = ['today', 'bookings', 'rooms', 'billing']

// Translated label for a panel id or section key, e.g. navLabel(t, 'users') → "Users & Roles"
// in the current language. Falls back to the English label when the key is missing.
export const navLabel = (t, id) => t(`nav:${id}`, { defaultValue: PANEL_META[id]?.label || id })
