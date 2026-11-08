import { createSlice } from '@reduxjs/toolkit'

/**
 * The page header bar (components/layout/PageHeader.jsx): title, subtitle,
 * search box and action buttons of the page on screen. Pages fill it with
 * usePageHeader (store/hooks.js). Only plain data lives here; click handlers
 * and icons sit in utils/headerRegistry.js under the same ids.
 *
 *   owner     id of the page instance that set it, so a page leaving the
 *             screen only clears its own header
 *   search    { placeholder, value } or null
 *   actions   [{ id, label, variant: 'primary'|'secondary'|'icon', hasIcon,
 *                disabled, badge, active, menu: [{ id, label, hasIcon, danger, disabled }] }]
 */
const initialState = { owner: null, title: '', subtitle: '', search: null, actions: [] }

const pageHeaderSlice = createSlice({
  name: 'pageHeader',
  initialState,
  reducers: {
    setPageHeader: (state, { payload }) => ({ ...initialState, ...payload }),
    clearPageHeader: (state, { payload: owner }) => (state.owner === owner ? initialState : state),
  },
})

export const { setPageHeader, clearPageHeader } = pageHeaderSlice.actions
export default pageHeaderSlice.reducer
