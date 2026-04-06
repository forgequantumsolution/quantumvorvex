import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
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

// Controllers / utils
import { seedAdminUser } from './controllers/authController.js'
import { startCronJobs } from './utils/cron.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet())

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
)

// ── Rate limiter: 100 requests per 15 minutes ───────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
})
app.use(limiter)

// ── Body parsing / cookies ──────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── Static uploads ──────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/rooms', roomsRoutes)
app.use('/api/v1/guests', guestsRoutes)
app.use('/api/v1/billing', billingRoutes)
app.use('/api/v1/bookings', bookingsRoutes)
app.use('/api/v1/documents', documentsRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/notifications', notificationsRoutes)
app.use('/api/v1/reports', reportsRoutes)

// Food plans and food orders share a single router mounted at root level
// so the router handles both /api/v1/food-plans and /api/v1/food-orders paths
app.use('/api/v1', foodPlansRoutes)
app.use('/api/v1/maintenance', maintenanceRoutes)
app.use('/api/v1/housekeeping', housekeepingRoutes)
app.use('/api/v1/staff', staffRoutes)
app.use('/api/v1/pricing', pricingRoutes)
app.use('/api/v1/reminders', remindersRoutes)
app.use('/api/v1/users', usersRoutes)

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message)

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large.' })
  }

  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error.'
  return res.status(status).json({ message })
})

// ── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Quantum Vortex server running on port ${PORT}`)
  await seedAdminUser()
  startCronJobs()
})

export default app
