import * as Yup from 'yup'

export const loginSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email('Enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

export const loginInitialValues = { email: '', password: '' }

// ── Forgot password — request a reset link ─────────────────────────────────────
export const forgotPasswordSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
})
export const forgotPasswordInitialValues = { email: '' }

// ── Reset password — set a new password from the emailed link ───────────────────
export const resetPasswordSchema = Yup.object({
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain an uppercase letter')
    .matches(/[0-9]/, 'Must contain a number'),
  confirmPassword: Yup.string()
    .required('Please confirm your password')
    .oneOf([Yup.ref('password')], 'Passwords do not match'),
})
export const resetPasswordInitialValues = { password: '', confirmPassword: '' }

// ── OTP login — step 1: email, step 2: 6-digit code ────────────────────────────
export const otpEmailSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
})
export const otpCodeSchema = Yup.object({
  code: Yup.string()
    .required('Enter the 6-digit code')
    .matches(/^\d{6}$/, 'Code must be 6 digits'),
})
export const otpEmailInitialValues = { email: '' }
export const otpCodeInitialValues = { code: '' }
