import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  darkMode: false,
  sidebarOpen: false,       // mobile drawer open/closed
  sidebarCollapsed: false,  // desktop icon-rail collapse
  activePanel: 'today',
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
    setActivePanel: (state, { payload }) => { state.activePanel = payload },
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
  setSearchOpen,
  requestPrimaryAction,
} = uiSlice.actions

export default uiSlice.reducer
