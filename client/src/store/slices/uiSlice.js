import { createSlice } from '@reduxjs/toolkit'
import { ROLE_PANELS } from '../../utils/permissions'

// Every routable panel id (the owner role can access all of them).
const ALL_PANELS = ROLE_PANELS.owner

// Resolve the panel encoded in the current URL path (e.g. /rooms → 'rooms').
// Returns `fallback` when the path isn't a known panel.
export function panelFromUrl(fallback = 'today') {
  if (typeof window === 'undefined') return fallback
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return ALL_PANELS.includes(slug) ? slug : fallback
}

const initialState = {
  darkMode: false,
  sidebarOpen: false,       // mobile drawer open/closed
  sidebarCollapsed: false,  // desktop icon-rail collapse
  // Deep links / refreshes land on the panel in the URL, not always 'today'.
  activePanel: panelFromUrl('today'),
  // Optional params handed to the incoming panel (e.g. a target sub-tab when
  // Today deep-links into Bookings). Cleared on any plain setActivePanel.
  activePanelParams: null,
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
  closeSidebar,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setActivePanel,
  navigateTo,
  setSearchOpen,
  requestPrimaryAction,
} = uiSlice.actions

export default uiSlice.reducer
