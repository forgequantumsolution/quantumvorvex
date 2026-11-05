import * as Yup from 'yup'
import i18n from '../i18n'

// Messages are functions so Yup reads them in the current language each time it validates.
const m = (key, opts) => () => i18n.t(`auth:validation.${key}`, opts)

export const loginSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email(m('emailInvalid'))
    .required(m('emailRequired')),
  password: Yup.string()
    .required(m('passwordRequired'))
    .min(6, m('passwordMin', { count: 6 })),
})

export const loginInitialValues = { email: '', password: '' }

// ── Forgot password — request a reset link ─────────────────────────────────────
export const forgotPasswordSchema = Yup.object({
  email: Yup.string().trim().email(m('emailInvalid')).required(m('emailRequired')),
})
export const forgotPasswordInitialValues = { email: '' }

// ── Reset password — set a new password from the emailed link ───────────────────
export const resetPasswordSchema = Yup.object({
  password: Yup.string()
    .required(m('passwordRequired'))
    .min(8, m('passwordMin', { count: 8 }))
    .matches(/[A-Z]/, m('needUppercase'))
    .matches(/[0-9]/, m('needNumber')),
  confirmPassword: Yup.string()
    .required(m('confirmRequired'))
    .oneOf([Yup.ref('password')], m('mismatch')),
})
export const resetPasswordInitialValues = { password: '', confirmPassword: '' }

// ── OTP login — step 1: email, step 2: 6-digit code ────────────────────────────
export const otpEmailSchema = Yup.object({
  email: Yup.string().trim().email(m('emailInvalid')).required(m('emailRequired')),
})
export const otpCodeSchema = Yup.object({
  code: Yup.string()
    .required(m('codeRequired'))
    .matches(/^\d{6}$/, m('codeDigits')),
})
export const otpEmailInitialValues = { email: '' }
export const otpCodeInitialValues = { code: '' }
