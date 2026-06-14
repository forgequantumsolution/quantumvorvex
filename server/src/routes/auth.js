import express from 'express'
import {
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  requestOtp,
  verifyOtp,
} from '../controllers/authController.js'
import { verifyToken } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.post('/login',  validate(schemas.login), login)
router.post('/logout', logout)
router.get('/me',      verifyToken, me)

// Password reset (email link)
router.post('/forgot-password', validate(schemas.forgotPassword), forgotPassword)
router.post('/reset-password',  validate(schemas.resetPassword),  resetPassword)

// Passwordless email OTP login
router.post('/otp/request', validate(schemas.requestOtp), requestOtp)
router.post('/otp/verify',  validate(schemas.verifyOtp),  verifyOtp)

export default router
