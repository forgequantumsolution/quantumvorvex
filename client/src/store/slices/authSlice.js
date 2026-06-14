import { createSlice } from '@reduxjs/toolkit'
import { authApi } from '../../api/client'
import { setActivePanel, panelFromUrl } from './uiSlice'

const initialState = {
  token: null,
  currentUser: null, // { id, name, email, role, phone? }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, { payload }) => {
      state.token = payload.token
      state.currentUser = payload.user
    },
    clearCredentials: (state) => {
      state.token = null
      state.currentUser = null
    },
    setCurrentUser: (state, { payload }) => {
      state.currentUser = payload
    },
  },
})

export const { setCredentials, clearCredentials, setCurrentUser } = authSlice.actions

export default authSlice.reducer

// ── Thunks ───────────────────────────────────────────────────────────────────
// The axios client reads the token from localStorage (see api/client.js), so we
// mirror it there in addition to persisting it in the Redux store.
export const login = (token, user) => (dispatch) => {
  localStorage.setItem('qv_token', token)
  dispatch(setCredentials({ token, user }))
  // Honour a deep link (e.g. /rooms opened while logged out); otherwise land
  // on the default front-desk panel.
  dispatch(setActivePanel(panelFromUrl('bookings')))
}

export const logout = () => async (dispatch) => {
  try { await authApi.logout() } catch { /* ignore errors on logout */ }
  localStorage.removeItem('qv_token')
  dispatch(clearCredentials())
  dispatch(setActivePanel('bookings'))
}
