import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  darkMode: false,
  sidebarOpen: false,       // mobile drawer open/closed
  sidebarCollapsed: false,  // desktop icon-rail collapse
  activePanel: 'bookings',
  searchOpen: false,
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
} = uiSlice.actions

export default uiSlice.reducer
