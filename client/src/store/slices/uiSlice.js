import { createSlice } from '@reduxjs/toolkit'
import { ALL_PANELS } from '../../utils/permissions'

// Resolve the panel encoded in the current URL path (e.g. /rooms → 'rooms').
// Returns `fallback` when the path isn't a known panel.
export function panelFromUrl(fallback = 'today') {
  if (typeof window === 'undefined') return fallback
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return ALL_PANELS.includes(slug) ? slug : fallback
}

const initialState = {
  darkMode: false,
  sidebarOpen: false,       // phone drawer / tablet rail expanded
  sidebarCollapsed: false,  // desktop icon-rail collapse
  // Deep links / refreshes land on the panel in the URL, not always 'today'.
  activePanel: panelFromUrl('today'),
  // Optional params handed to the incoming panel (e.g. a target sub-tab when
  // Today deep-links into Bookings). Cleared on any plain setActivePanel.
  activePanelParams: null,
  // What the Portfolio dashboard shows: every property combined ('all') or just
  // the active property ('property'). Driven by the topbar property switcher.
  dashboardScope: 'all',
  // Same for the Expenses page. Owners (anyone who may see every property) start
  // on "All properties"; with one property, or without that right, the page
  // falls back to the active property. Kept apart from dashboardScope so leaving
  // one page in "All properties" doesn't change the other.
  expenseScope: 'all',
  searchOpen: false,
  // Generic "primary action" trigger fired by the contextual header button.
  // A page listens for its own panel name + a changing nonce, then runs its action.
  primaryActionPanel: null,
  primaryActionNonce: 0,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDarkMode: (state, { payload }) => { state.darkMode = payload },
    toggleDarkMode: (state) => { state.darkMode = !state.darkMode },
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen },
    openSidebar: (state) => { state.sidebarOpen = true },
    closeSidebar: (state) => { state.sidebarOpen = false },
    toggleSidebarCollapsed: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed },
    setSidebarCollapsed: (state, { payload }) => { state.sidebarCollapsed = payload },
    setActivePanel: (state, { payload }) => { state.activePanel = payload; state.activePanelParams = null },
    // Navigate to a panel while handing it params (e.g. { tab: 'CheckedIn' }).
    navigateTo: (state, { payload }) => {
      state.activePanel = payload.panel
      state.activePanelParams = payload.params || null
    },
    setSearchOpen: (state, { payload }) => { state.searchOpen = payload },
    setDashboardScope: (state, { payload }) => { state.dashboardScope = payload },
    setExpenseScope: (state, { payload }) => { state.expenseScope = payload },
    // Navigate to the target panel and bump the nonce so that page runs its primary action.
    requestPrimaryAction: (state, { payload }) => {
      state.activePanel = payload
      state.primaryActionPanel = payload
      state.primaryActionNonce += 1
    },
  },
})

export const {
  setDarkMode,
  toggleDarkMode,
  toggleSidebar,
  openSidebar,
  closeSidebar,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setActivePanel,
  navigateTo,
  setSearchOpen,
  setDashboardScope,
  setExpenseScope,
  requestPrimaryAction,
} = uiSlice.actions

export default uiSlice.reducer
