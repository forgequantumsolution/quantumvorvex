import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  toasts: [], // { id, message, type }
}

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    // Keep at most the 3 most recent toasts on screen.
    addToast: (state, { payload }) => {
      state.toasts = [...state.toasts.slice(-2), payload]
    },
    removeToast: (state, { payload }) => {
      state.toasts = state.toasts.filter((t) => t.id !== payload)
    },
  },
})

export const { addToast, removeToast } = toastSlice.actions

export default toastSlice.reducer
