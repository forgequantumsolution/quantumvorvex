import { useMemo, useEffect, useRef } from 'react'
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
          requestPrimaryAction: ui.requestPrimaryAction,
        },
        dispatch,
      ),
    [dispatch],
  )
}

// Run `handler` when the contextual header button fires for this `panel`.
// Fires once per click (tracks the nonce) and always calls the latest handler.
export function usePrimaryAction(panel, handler) {
  const nonce    = useSelector((s) => s.ui.primaryActionNonce)
  const reqPanel = useSelector((s) => s.ui.primaryActionPanel)
  const seen = useRef(nonce)
  const cb = useRef(handler)
  cb.current = handler
  useEffect(() => {
    if (nonce !== seen.current) {
      seen.current = nonce
      if (reqPanel === panel) cb.current()
    }
  }, [nonce, reqPanel, panel])
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
