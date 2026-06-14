import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../utils/prisma.js'
import logger, { securityLog } from '../utils/logger.js'
import { sendPasswordResetEmail, sendOtpEmail } from '../utils/email.js'

// In-memory failed login tracker (per IP, resets after window)
// For production: replace with Redis INCR + EXPIRE
const failedAttempts = new Map()
const MAX_ATTEMPTS   = 5
const LOCK_WINDOW_MS = 15 * 60 * 1000   // 15 minutes

function getAttemptKey(ip) { return `login:${ip}` }

function isLockedOut(ip) {
  const entry = failedAttempts.get(getAttemptKey(ip))
  if (!entry) return false
  if (Date.now() - entry.firstAt > LOCK_WINDOW_MS) {
    failedAttempts.delete(getAttemptKey(ip))
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

function recordFailure(ip) {
  const key   = getAttemptKey(ip)
  const entry = failedAttempts.get(key)
  if (!entry || Date.now() - entry.firstAt > LOCK_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstAt: Date.now() })
  } else {
    entry.count++
  }
}

function clearFailures(ip) {
  failedAttempts.delete(getAttemptKey(ip))
}

// One active session per user — only bump/track sessionVersion when enabled (production).
// Off in local dev so test/demo logins don't churn the counter. Mirrors the middleware flag.
const ENFORCE_SINGLE_SESSION = process.env.ENFORCE_SINGLE_SESSION === 'true'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,   // 7 days
  path:     '/',
}

// Token / OTP lifetimes
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000   // 30 minutes
const OTP_TTL_MS         = 10 * 60 * 1000   // 10 minutes
const OTP_MAX_ATTEMPTS   = 5

// sha256 hex — used to store reset tokens / OTP codes at rest (never store raw)
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

/**
 * Sign a 7-day JWT for the user and set it as an httpOnly cookie.
 * Returns the raw token so it can also be sent in the JSON body.
 */
function issueAuthToken(res, user) {
  const payload = { userId: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion }
  const token   = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn:  '7d',
    algorithm:  'HS256',
    issuer:     'quantum-vorvex',
    audience:   'quantum-vorvex-api',
  })
  res.cookie('token', token, COOKIE_OPTIONS)
  return token
}

// Seed default admin user if none exists (silent, no credentials logged)
export const seedAdminUser = async () => {
  try {
    const count = await prisma.user.count()
    if (count === 0) {
      const hashed = await bcrypt.hash('admin123', 12)
      await prisma.user.create({
        data: { name: 'Admin', email: 'admin@hotel.com', password: hashed, role: 'owner' },
      })
      logger.info('Default admin account created — change credentials immediately', {
        event: 'SYSTEM',
      })
    }
  } catch (err) {
    logger.error('Failed to seed admin user', { error: err.message, event: 'SYSTEM' })
  }
}

// POST /auth/login
export const login = async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown'
  const ua = req.headers['user-agent'] || 'unknown'

  try {
    const { email, password } = req.body   // Validated by Zod middleware

    // Brute-force lockout check
    if (isLockedOut(ip)) {
      securityLog.loginFailure(email, ip, ua, 'ip_locked_out')
      return res.status(429).json({
        error: 'Too many failed login attempts. Try again in 15 minutes.',
        code:  'ERR_ACCOUNT_LOCKED',
      })
    }

    // Lookup user — always run bcrypt even on miss to prevent timing attacks
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, status: true, password: true },
    })

    const DUMMY_HASH = '$2a$12$invalidhashinvalidhashinvalidhashx'
    const hash       = user?.password || DUMMY_HASH
    const isMatch    = await bcrypt.compare(password, hash)

    if (!user || !isMatch) {
      recordFailure(ip)
      securityLog.loginFailure(email, ip, ua, user ? 'wrong_password' : 'user_not_found')
      return res.status(401).json({ error: 'Invalid email or password.', code: 'ERR_AUTH' })
    }

    if (user.status === 'inactive') {
      securityLog.loginFailure(email, ip, ua, 'account_inactive')
      return res.status(403).json({ error: 'Account is inactive. Contact an administrator.', code: 'ERR_ACCOUNT_INACTIVE' })
    }

    // Login success — clear failures, issue token
    clearFailures(ip)

    // Single-session: bump sessionVersion so any token on a previously logged-in device
    // goes stale. Only when enforcement is enabled (see ENFORCE_SINGLE_SESSION).
    let sessionVersion
    if (ENFORCE_SINGLE_SESSION) {
      const bumped = await prisma.user.update({
        where:  { id: user.id },
        data:   { sessionVersion: { increment: 1 } },
        select: { sessionVersion: true },
      })
      sessionVersion = bumped.sessionVersion
    }

    const token = issueAuthToken(res, { ...user, sessionVersion })
    securityLog.loginSuccess(user.id, user.email, ip, ua)

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    logger.error('Login handler error', { error: err.message, ip, event: 'AUTH' })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// POST /auth/logout
export const logout = (req, res) => {
  try {
    const ip = req.ip || 'unknown'
    if (req.user?.userId) securityLog.logout(req.user.userId, ip)
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' })
    return res.status(200).json({ message: 'Logged out successfully.' })
  } catch (err) {
    logger.error('Logout error', { error: err.message })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// GET /auth/me (protected)
export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found.', code: 'ERR_NOT_FOUND' })
    return res.status(200).json({ user })
  } catch (err) {
    logger.error('Me endpoint error', { error: err.message, userId: req.user?.userId })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// Generic message returned by both forgot-password and otp-request so the
// response never reveals whether an email is registered (no user enumeration).
const GENERIC_RESET_MSG = 'If an account exists for that email, a reset link has been sent.'
const GENERIC_OTP_MSG   = 'If an account exists for that email, a login code has been sent.'

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
  const ip = req.ip || 'unknown'
  try {
    const { email } = req.body   // Validated + lowercased by Zod

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } })

    // Only issue a token for an existing, active account — but always respond identically.
    if (user && user.status !== 'inactive') {
      // Invalidate any outstanding tokens for this user, then mint a fresh one.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })

      const rawToken = crypto.randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({
        data: {
          userId:    user.id,
          tokenHash: sha256(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      })

      const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()
      const link = `${base}/reset-password?token=${rawToken}`
      await sendPasswordResetEmail(email, link)
      logger.info('Password reset requested', { event: 'AUTH', userId: user.id, ip })
    } else {
      logger.info('Password reset requested for unknown/inactive email', { event: 'AUTH', ip })
    }

    return res.status(200).json({ message: GENERIC_RESET_MSG })
  } catch (err) {
    logger.error('forgotPassword error', { error: err.message, ip })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// POST /auth/reset-password
export const resetPassword = async (req, res) => {
  const ip = req.ip || 'unknown'
  try {
    const { token, password } = req.body   // Validated by Zod (strong password)

    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: sha256(token), usedAt: null },
    })

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.', code: 'ERR_TOKEN_INVALID' })
    }

    const hashed = await bcrypt.hash(password, 12)

    // Update password and consume the token atomically.
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ])

    logger.info('Password reset completed', { event: 'AUTH', userId: record.userId, ip })
    return res.status(200).json({ message: 'Password updated. You can now sign in.' })
  } catch (err) {
    logger.error('resetPassword error', { error: err.message, ip })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// POST /auth/otp/request — passwordless login: send a 6-digit code
export const requestOtp = async (req, res) => {
  const ip = req.ip || 'unknown'
  try {
    const { email } = req.body   // Validated + lowercased by Zod

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } })

    if (user && user.status !== 'inactive') {
      // One active code at a time — clear previous unused codes for this email.
      await prisma.loginOtp.deleteMany({ where: { email, usedAt: null } })

      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
      await prisma.loginOtp.create({
        data: {
          email,
          codeHash:  sha256(code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      })

      await sendOtpEmail(email, code)
      logger.info('OTP requested', { event: 'AUTH', userId: user.id, ip })
    } else {
      logger.info('OTP requested for unknown/inactive email', { event: 'AUTH', ip })
    }

    return res.status(200).json({ message: GENERIC_OTP_MSG })
  } catch (err) {
    logger.error('requestOtp error', { error: err.message, ip })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}

// POST /auth/otp/verify — exchange a valid code for a JWT session
export const verifyOtp = async (req, res) => {
  const ip = req.ip || 'unknown'
  const ua = req.headers['user-agent'] || 'unknown'
  try {
    const { email, code } = req.body   // Validated by Zod (6 digits)

    const record = await prisma.loginOtp.findFirst({
      where:   { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Code is invalid or has expired. Request a new one.', code: 'ERR_OTP_INVALID' })
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.loginOtp.update({ where: { id: record.id }, data: { usedAt: new Date() } })
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.', code: 'ERR_OTP_LOCKED' })
    }

    if (sha256(code) !== record.codeHash) {
      await prisma.loginOtp.update({ where: { id: record.id }, data: { attempts: record.attempts + 1 } })
      securityLog.loginFailure(email, ip, ua, 'otp_wrong_code')
      return res.status(401).json({ error: 'Incorrect code.', code: 'ERR_OTP_WRONG' })
    }

    // Correct code — consume it and load the user.
    const user = await prisma.user.findUnique({
      where:  { email },
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    if (!user || user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is unavailable. Contact an administrator.', code: 'ERR_ACCOUNT_INACTIVE' })
    }

    await prisma.loginOtp.update({ where: { id: record.id }, data: { usedAt: new Date() } })

    // Single-session: bump sessionVersion so any token on a previously logged-in device
    // goes stale. Only when enforcement is enabled (see ENFORCE_SINGLE_SESSION).
    let sessionVersion
    if (ENFORCE_SINGLE_SESSION) {
      const bumped = await prisma.user.update({
        where:  { id: user.id },
        data:   { sessionVersion: { increment: 1 } },
        select: { sessionVersion: true },
      })
      sessionVersion = bumped.sessionVersion
    }

    const token = issueAuthToken(res, { ...user, sessionVersion })
    securityLog.loginSuccess(user.id, user.email, ip, ua)

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    logger.error('verifyOtp error', { error: err.message, ip })
    return res.status(500).json({ error: 'An unexpected error occurred.', code: 'ERR_INTERNAL' })
  }
}
