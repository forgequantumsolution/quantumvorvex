import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'
import logger, { securityLog } from '../utils/logger.js'

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

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,   // 7 days
  path:     '/',
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

    const payload = { userId: user.id, email: user.email, role: user.role }
    const token   = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn:  '7d',
      algorithm:  'HS256',
      issuer:     'quantum-vorvex',
      audience:   'quantum-vorvex-api',
    })

    res.cookie('token', token, COOKIE_OPTIONS)
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
