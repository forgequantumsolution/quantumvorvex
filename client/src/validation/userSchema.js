import * as Yup from 'yup'

// User create/edit. Password is optional — when blank on create, the server assigns the
// shared default (Welcome@123). On edit it's a free-form reset with no strength rules
// (an admin may set any password; users harden their own via Change Password).
export const userSchema = Yup.object({
  name:  Yup.string().trim().min(2, 'Name is too short').max(100).required('Name is required'),
  email: Yup.string().trim().email('Invalid email').required('Email is required'),
  phone: Yup.string().max(20).nullable(),
  roleId: Yup.string().required('Select a role'),
  status: Yup.string().oneOf(['active', 'inactive']).default('active'),
  password: Yup.string().max(128).notRequired(),
})
