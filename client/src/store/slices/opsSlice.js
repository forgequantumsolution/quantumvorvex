import { createSlice } from '@reduxjs/toolkit'
import { SEED_BOOKINGS, SEED_TICKETS } from '../../data/opsSeed'

const todayISO = () => new Date().toISOString().slice(0, 10)

const initialState = {
  bookings: SEED_BOOKINGS,
  tickets: SEED_TICKETS,
}

const opsSlice = createSlice({
  name: 'ops',
  initialState,
  reducers: {
    // ── Bookings ──────────────────────────────────────────────────────────────
    addBooking: (state, { payload }) => {
      state.bookings.unshift(payload)
    },
    cancelBooking: (state, { payload }) => {
      const { id, reason } = payload
      const b = state.bookings.find((x) => x.id === id)
      if (b) {
        b.status = 'Cancelled'
        b.cancelReason = reason || 'No reason provided.'
        b.cancelledAt = todayISO()
      }
    },
    checkInBooking: (state, { payload }) => {
      const b = state.bookings.find((x) => x.id === payload)
      if (b) {
        b.status = 'CheckedIn'
        b.checkedInAt = todayISO()
      }
    },
    checkOutBooking: (state, { payload }) => {
      const b = state.bookings.find((x) => x.id === payload)
      if (b) {
        b.status = 'CheckedOut'
        b.checkedOutAt = todayISO()
      }
    },

    // ── Maintenance tickets ───────────────────────────────────────────────────
    addTicket: (state, { payload }) => {
      state.tickets.unshift(payload)
    },
    updateTicketStatus: (state, { payload }) => {
      const { id, status } = payload
      const t = state.tickets.find((x) => x.id === id)
      if (t) {
        t.status = status
        t.resolvedAt = status === 'Resolved' ? todayISO() : null
      }
    },
  },
})

export const {
  addBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  addTicket,
  updateTicketStatus,
} = opsSlice.actions

export default opsSlice.reducer
