import * as Yup from 'yup'

// User create/edit. Password is optional — when blank, the server assigns the shared
// default (Welcome@123). When provided it must meet the backend's strength rules.
export const userSchema = Yup.object({
  name:  Yup.string().trim().min(2, 'Name is too short').max(100).required('Name is required'),
  email: Yup.string().trim().email('Invalid email').required('Email is required'),
  phone: Yup.string().max(20).nullable(),
  roleId: Yup.string().required('Select a role'),
  status: Yup.string().oneOf(['active', 'inactive']).default('active'),
  password: Yup.string()
    .transform((v) => (v === '' ? undefined : v))
    .min(8, 'At least 8 characters')
    .matches(/[A-Z]/, 'Must contain an uppercase letter')
    .matches(/[0-9]/, 'Must contain a number')
    .notRequired(),
})
