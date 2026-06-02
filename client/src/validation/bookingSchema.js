import * as Yup from 'yup'

export const bookingInitialValues = {
  guestName: '',
  room: '',
  stayType: 'daily',
  fromDate: '',
  toDate: '',
  months: 1,
  amount: '',
  advance: '',
  notes: '',
}

export const bookingSchema = Yup.object({
  guestName: Yup.string().trim().required('Guest name is required'),
  room: Yup.string().required('Select a room'),
  stayType: Yup.string().oneOf(['daily', 'monthly']).required(),
  fromDate: Yup.string().required('From date is required'),
  toDate: Yup.string().when('stayType', {
    is: 'daily',
    then: (s) => s.required('To date is required'),
    otherwise: (s) => s.notRequired(),
  }),
  months: Yup.number().when('stayType', {
    is: 'monthly',
    then: (s) => s.typeError('Enter a number').min(1, 'At least 1 month').required('Months is required'),
    otherwise: (s) => s.notRequired(),
  }),
  amount: Yup.number().typeError('Enter a number').min(0, 'Must be ≥ 0'),
  advance: Yup.number().typeError('Enter a number').min(0, 'Must be ≥ 0'),
  notes: Yup.string(),
})
