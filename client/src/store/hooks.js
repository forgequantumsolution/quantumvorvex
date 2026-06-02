import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { bindActionCreators } from '@reduxjs/toolkit'

import * as ui from './slices/uiSlice'
import * as auth from './slices/authSlice'
import * as hotel from './slices/hotelSlice'
import * as ops from './slices/opsSlice'

// ── Base hooks ───────────────────────────────────────────────────────────────
export const useAppDispatch = () => useDispatch()
export const useAppSelector = useSelector

// ── Bound action hooks ───────────────────────────────────────────────────────
// Each returns dispatch-bound action creators so call sites can invoke them
// directly, e.g. `setActivePanel('staff')`, without threading `dispatch`.
export function useUiActions() {
  const dispatch = useDispatch()
  return useMemo(
    () =>
      bindActionCreators(
        {
          setDarkMode: ui.setDarkMode,
          toggleDarkMode: ui.toggleDarkMode,
          toggleSidebar: ui.toggleSidebar,
          closeSidebar: ui.closeSidebar,
          toggleSidebarCollapsed: ui.toggleSidebarCollapsed,
          setSidebarCollapsed: ui.setSidebarCollapsed,
          setActivePanel: ui.setActivePanel,
          setSearchOpen: ui.setSearchOpen,
        },
        dispatch,
      ),
    [dispatch],
  )
}

export function useAuthActions() {
  const dispatch = useDispatch()
  return useMemo(
    () =>
      bindActionCreators(
        {
          login: auth.login,
          logout: auth.logout,
          setCurrentUser: auth.setCurrentUser,
        },
        dispatch,
      ),
    [dispatch],
  )
}

export function useOpsActions() {
  const dispatch = useDispatch()
  return useMemo(
    () =>
      bindActionCreators(
        {
          addBooking: ops.addBooking,
          cancelBooking: ops.cancelBooking,
          checkInBooking: ops.checkInBooking,
          checkOutBooking: ops.checkOutBooking,
          addTicket: ops.addTicket,
          updateTicketStatus: ops.updateTicketStatus,
        },
        dispatch,
      ),
    [dispatch],
  )
}

export function useHotelActions() {
  const dispatch = useDispatch()
  return useMemo(
    () =>
      bindActionCreators(
        {
          setHotelName: hotel.setHotelName,
          setOwnerName: hotel.setOwnerName,
        },
        dispatch,
      ),
    [dispatch],
  )
}
