import {
  LuLayoutDashboard, LuCalendarCheck, LuLogIn, LuLogOut, LuCalendarX, LuWrench,
  LuUsers, LuBedDouble, LuFileText, LuUtensils, LuSparkles,
  LuCreditCard, LuChartColumn, LuUserCog, LuSettings,
} from 'react-icons/lu'

// Single source of truth for the app's navigation structure — consumed by the
// Sidebar (nav rail) and the Topbar (breadcrumb).
export const NAV_SECTIONS = [
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

// panel id → { label, section } lookup, e.g. reports → { label: 'Reports', section: 'Finance' }
export const PANEL_META = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => [item.id, { label: item.label, section: section.label }]),
  ),
)
