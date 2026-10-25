import { createSlice } from '@reduxjs/toolkit'
import { authApi } from '../../api/client'
import { setActivePanel, setDashboardScope, panelFromUrl } from './uiSlice'
import { canSeePortfolio } from '../../utils/permissions'

const initialState = {
  token: null,
  currentUser: null, // { id, name, email, roleName, isOwner, permissions, properties: [...] }
  // The property the app is working in. Every API call is scoped to it (the axios
  // client sends it as X-Property-Id — see store/index.js + api/client.js).
  activePropertyId: null,
}

// Pick a valid active property for the user and mirror that property's role onto
// currentUser.roleName / currentUser.permissions. Everything that checks
// permissions (sidebar, useCan, canAccess…) therefore reflects the role the user
// holds AT THE ACTIVE PROPERTY without knowing about properties at all.
function applyActiveProperty(state) {
  const user = state.currentUser
  const properties = user?.properties
  if (!properties) return // older payload / mock user — single-property behaviour
  const active =
    properties.find((p) => p.id === state.activePropertyId) ||
    properties.find((p) => p.status === 'active') ||
    properties[0] ||
    null
  state.activePropertyId = active?.id ?? null
  if (active) {
    user.roleName = active.roleName
    user.permissions = active.permissions
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, { payload }) => {
      state.token = payload.token
      state.currentUser = payload.user
      applyActiveProperty(state)
    },
    clearCredentials: (state) => {
      state.token = null
      state.currentUser = null
    },
    setCurrentUser: (state, { payload }) => {
      state.currentUser = payload
      applyActiveProperty(state)
    },
    setActiveProperty: (state, { payload }) => {
      state.activePropertyId = payload
      applyActiveProperty(state)
    },
  },
})

export const { setCredentials, clearCredentials, setCurrentUser, setActiveProperty } = authSlice.actions

export default authSlice.reducer

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectProperties = (s) => s.auth.currentUser?.properties || []
export const selectActiveProperty = (s) =>
  selectProperties(s).find((p) => p.id === s.auth.activePropertyId) || null

// ── Thunks ───────────────────────────────────────────────────────────────────
// The axios client reads the token from localStorage (see api/client.js), so we
// mirror it there in addition to persisting it in the Redux store.
export const login = (token, user) => (dispatch) => {
  localStorage.setItem('qv_token', token)
  dispatch(setCredentials({ token, user }))
  // Honour a deep link (e.g. /rooms opened while logged out); otherwise land on
  // the all-properties dashboard when the user runs several properties, else on
  // the default front-desk panel.
  const multi = (user?.properties || []).filter((p) => p.status === 'active').length > 1
  dispatch(setDashboardScope('all'))
  dispatch(setActivePanel(panelFromUrl(multi && canSeePortfolio(user) ? 'portfolio' : 'bookings')))
}

export const logout = () => async (dispatch) => {
  try { await authApi.logout() } catch { /* ignore errors on logout */ }
  localStorage.removeItem('qv_token')
  dispatch(clearCredentials())
  dispatch(setActivePanel('bookings'))
}
