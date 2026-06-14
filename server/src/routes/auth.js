import express from 'express'
import rateLimit from 'express-rate-limit'
import {
  login,
  logout,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  requestOtp,
  verifyOtp,
} from '../controllers/authController.js'
import { verifyToken } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

const isProd = process.env.NODE_ENV === 'production'

// Non-intrusive brute-force throttle on login: counts only FAILED attempts
// (skipSuccessfulRequests), so a human who mistypes a few times is never blocked —
// only repeated failures from one IP accumulate. Generous in dev so E2E isn't affected.
const loginThrottle = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isProd ? 20 : 1000,
  skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many failed attempts. Please wait a few minutes and try again.', code: 'ERR_RATE_LIMIT' },
})

// Email-sending endpoints always return 200 (anti-enumeration), so count every request
// to prevent inbox spamming. Generous enough that requesting a few codes is fine.
const emailThrottle = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isProd ? 10 : 1000,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes and try again.', code: 'ERR_RATE_LIMIT' },
})

router.post('/login',  loginThrottle, validate(schemas.login), login)
router.post('/logout', logout)
router.get('/me',      verifyToken, me)
router.post('/change-password', verifyToken, validate(schemas.changePassword), changePassword)

// Password reset (email link)
router.post('/forgot-password', emailThrottle, validate(schemas.forgotPassword), forgotPassword)
router.post('/reset-password',  validate(schemas.resetPassword),  resetPassword)

// Passwordless email OTP login
router.post('/otp/request', emailThrottle, validate(schemas.requestOtp), requestOtp)
router.post('/otp/verify',  validate(schemas.verifyOtp),  verifyOtp)

export default router
