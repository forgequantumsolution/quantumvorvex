import * as Yup from 'yup'

export const staffSchema = Yup.object({
  name: Yup.string().trim().required('Full name is required'),
  phone: Yup.string()
    .trim()
    .matches(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .required('Phone is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  role: Yup.string().required('Role is required'),
})
