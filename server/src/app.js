/**
 * Express application factory — no app.listen() here.
 * Imported by:
 *   - server/src/server.js  (local dev, calls app.listen)
 *   - api/index.js          (Vercel serverless, exports handler)
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import path from 'path'
import { fileURLToPath } from 'url'

// Route imports
import authRoutes from './routes/auth.js'
import roomsRoutes from './routes/rooms.js'
import guestsRoutes from './routes/guests.js'
import billingRoutes from './routes/billing.js'
import bookingsRoutes from './routes/bookings.js'
import documentsRoutes from './routes/documents.js'
import settingsRoutes from './routes/settings.js'
import notificationsRoutes from './routes/notifications.js'
import reportsRoutes from './routes/reports.js'
import foodPlansRoutes from './routes/foodPlans.js'
import maintenanceRoutes from './routes/maintenance.js'
import housekeepingRoutes from './routes/housekeeping.js'
import staffRoutes from './routes/staff.js'
import pricingRoutes from './routes/pricing.js'
import remindersRoutes from './routes/reminders.js'
import usersRoutes from './routes/users.js'

import logger, { requestLogger } from './utils/logger.js'
import prisma from './utils/prisma.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app = express()

// ── Trust proxy (correct IP behind nginx / Vercel edge) ───────────────────────
app.set('trust proxy', 1)

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", 'data:', 'https:'],
      fontSrc:        ["'self'"],
      connectSrc:     ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts:            { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:         true,
  xssFilter:       true,
  frameguard:      { action: 'deny' },
  referrerPolicy:  { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
}))

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()')
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  next()
})

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Limit'],
  credentials:    true,
  maxAge:         86400,
}))

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth requests. Try again in 15 minutes.', code: 'ERR_RATE_LIMIT' },
  skip: (req) => req.path === '/logout',
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Rate limit exceeded.', code: 'ERR_RATE_LIMIT' },
})

const apiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, delayAfter: 50, delayMs: () => 500,
})

// ── Body parsing / cookies ────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(cookieParser())
app.use(requestLogger)

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')))

// ── Health endpoints ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
    uptime:    Math.floor(process.uptime()),
  })
})

app.get('/health/ready', async (req, res) => {
  const checks = {}
  let allOk = true
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart }
  } catch {
    checks.database = { status: 'down' }
    allOk = false
  }
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() })
})

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authLimiter, authRoutes)
app.use('/api/v1/rooms',         apiLimiter, apiSlowDown, roomsRoutes)
app.use('/api/v1/guests',        apiLimiter, apiSlowDown, guestsRoutes)
app.use('/api/v1/billing',       apiLimiter, apiSlowDown, billingRoutes)
app.use('/api/v1/bookings',      apiLimiter, apiSlowDown, bookingsRoutes)
app.use('/api/v1/documents',     apiLimiter, documentsRoutes)
app.use('/api/v1/settings',      apiLimiter, settingsRoutes)
app.use('/api/v1/notifications', apiLimiter, notificationsRoutes)
app.use('/api/v1/reports',       apiLimiter, reportsRoutes)
app.use('/api/v1',               apiLimiter, foodPlansRoutes)
app.use('/api/v1/maintenance',   apiLimiter, maintenanceRoutes)
app.use('/api/v1/housekeeping',  apiLimiter, housekeepingRoutes)
app.use('/api/v1/staff',         apiLimiter, staffRoutes)
app.use('/api/v1/pricing',       apiLimiter, pricingRoutes)
app.use('/api/v1/reminders',     apiLimiter, remindersRoutes)
app.use('/api/v1/users',         apiLimiter, usersRoutes)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'ERR_NOT_FOUND' })
})

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message, stack: err.stack,
    path: req.path, method: req.method,
    requestId: req.requestId, userId: req.user?.userId,
  })
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'File too large.', code: 'ERR_FILE_SIZE' })
  if (err.message?.startsWith('CORS:'))
    return res.status(403).json({ error: 'CORS policy violation.', code: 'ERR_CORS' })
  const statusCode = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message
  return res.status(statusCode).json({ error: message, code: 'ERR_INTERNAL', requestId: req.requestId })
})

export default app
