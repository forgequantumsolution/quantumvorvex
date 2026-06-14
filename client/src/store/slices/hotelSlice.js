import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  hotelName: 'Quantum Vorvex',
  ownerName: 'Admin',
}

const hotelSlice = createSlice({
  name: 'hotel',
  initialState,
  reducers: {
    setHotelName: (state, { payload }) => { state.hotelName = payload },
    setOwnerName: (state, { payload }) => { state.ownerName = payload },
  },
})

export const { setHotelName, setOwnerName } = hotelSlice.actions

export default hotelSlice.reducer
