import * as Yup from 'yup'

export const guestEditSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
  phone: Yup.string()
    .trim()
    .matches(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .required('Phone is required'),
  email: Yup.string().trim().email('Enter a valid email').nullable(),
  room: Yup.string().trim().required('Room is required'),
  stayType: Yup.string().oneOf(['daily', 'monthly']).required(),
  checkInDate: Yup.string().required('Check-in date is required'),
  checkOutDate: Yup.string().when('stayType', {
    is: 'daily',
    then: (s) => s.required('Check-out date is required'),
    otherwise: (s) => s.notRequired(),
  }),
  months: Yup.number().when('stayType', {
    is: 'monthly',
    then: (s) => s.typeError('Enter a number').min(1, 'At least 1 month').required('Months is required'),
    otherwise: (s) => s.notRequired(),
  }),
})
