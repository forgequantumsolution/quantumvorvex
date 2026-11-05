import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { bindActionCreators } from '@reduxjs/toolkit'
import { setPageHeader, clearPageHeader } from './slices/pageHeaderSlice'
import { setEntry, clearOwner, nextOwner } from '../utils/headerRegistry'

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
          openSidebar: ui.openSidebar,
          closeSidebar: ui.closeSidebar,
          toggleSidebarCollapsed: ui.toggleSidebarCollapsed,
          setSidebarCollapsed: ui.setSidebarCollapsed,
          setActivePanel: ui.setActivePanel,
          navigateTo: ui.navigateTo,
          setSearchOpen: ui.setSearchOpen,
          setDashboardScope: ui.setDashboardScope,
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
  // Refresh the handler after each render (before the nonce check below runs).
  useEffect(() => { cb.current = handler })
  useEffect(() => {
    if (nonce !== seen.current) {
      seen.current = nonce
      if (reqPanel === panel) cb.current()
    }
  }, [nonce, reqPanel, panel])
}

/**
 * Fill the page header bar (layout/PageHeader.jsx) for as long as the calling
 * page is on screen. Every page header looks the same: title on the left,
 * search and buttons on the right.
 *
 *   usePageHeader({
 *     title: 'Bookings', subtitle: '…',
 *     search: { value, onChange: (v) => …, placeholder: 'Search…' },   // optional
 *     actions: [
 *       { id: 'new', label: 'New booking', icon: <LuPlus />, variant: 'primary', onClick },
 *       { id: 'export', label: 'Export CSV', icon: <LuDownload />, onClick },              // secondary
 *       { id: 'refresh', label: 'Refresh', icon: <LuRefreshCw />, variant: 'icon', onClick },
 *       { id: 'bulk', label: 'Bulk update', icon: <LuLayers />, menu: [{ id, label, icon, onClick, danger }] },
 *       cond && { … },   // falsy entries are skipped
 *     ],
 *   })
 *
 * `disabled`, `badge` (a count on the button) and `active` (highlighted, e.g. a
 * filter panel that is open) are also accepted. Ids must be unique per page.
 */
export function usePageHeader({ title = '', subtitle = '', search = null, actions = [] } = {}) {
  const dispatch = useDispatch()
  const [owner] = useState(nextOwner)

  const list = actions.filter(Boolean)

  // Handlers and icons go to the registry after every render (so the header
  // always calls the latest closure) and again after a remount — StrictMode's
  // unmount cleanup below clears them. Only plain data goes to the store.
  useLayoutEffect(() => {
    for (const a of list) {
      setEntry(owner, a.id, { onClick: a.onClick, icon: a.icon })
      for (const m of a.menu || []) if (m) setEntry(owner, `${a.id}/${m.id}`, { onClick: m.onClick, icon: m.icon })
    }
    if (search) setEntry(owner, '__search', { onChange: search.onChange })
  })

  const data = JSON.stringify({
    owner,
    title: title || '',
    subtitle: subtitle || '',
    search: search ? { placeholder: search.placeholder || 'Search…', value: search.value ?? '' } : null,
    actions: list.map((a) => ({
      id: a.id,
      label: a.label,
      variant: a.variant || 'secondary',
      hasIcon: !!a.icon,
      disabled: !!a.disabled,
      badge: a.badge || 0,
      active: !!a.active,
      menu: a.menu
        ? a.menu.filter(Boolean).map((m) => ({ id: m.id, label: m.label, hasIcon: !!m.icon, danger: !!m.danger, disabled: !!m.disabled }))
        : null,
    })),
  })

  useEffect(() => { dispatch(setPageHeader(JSON.parse(data))) }, [dispatch, data])
  useEffect(() => () => { dispatch(clearPageHeader(owner)); clearOwner(owner) }, [dispatch, owner])
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
          setActiveProperty: auth.setActiveProperty,
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
