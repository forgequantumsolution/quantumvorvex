/**
 * Structured logger — Winston
 * All logs: JSON in production, colorized in development
 * Never log: passwords, tokens, card numbers, SSNs
 */
import { createLogger, format, transports } from 'winston'

const { combine, timestamp, json, colorize, printf, errors } = format

// PII field names that must be redacted before logging
const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'accessToken', 'refreshToken',
  'authorization', 'cookie', 'jwt', 'apiKey', 'api_key', 'privateKey',
  'cardNumber', 'cvv', 'ssn', 'idNumber', 'passportNumber',
])

function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(item => redact(item, depth + 1))
  const out = {}
  for (const [key, val] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1)
  }
  return out
}

const isDev = process.env.NODE_ENV !== 'production'

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(redact(meta)) : ''
    return `${ts} ${level}: ${message}${metaStr}`
  })
)

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json({
    replacer: (key, value) =>
      SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value,
  })
)

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  defaultMeta: {
    service: 'quantum-vorvex-api',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    new transports.Console(),
  ],
  // Prevent unhandled exceptions from crashing the process without logging
  exceptionHandlers: [new transports.Console()],
  rejectionHandlers: [new transports.Console()],
})

/**
 * Middleware: attach requestId + log every incoming request
 */
export function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)

  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level]('HTTP request', {
      requestId,
      method:     req.method,
      path:       req.path,
      statusCode: res.statusCode,
      durationMs: ms,
      ip:         req.ip || req.connection?.remoteAddress,
      userAgent:  req.headers['user-agent'],
      userId:     req.user?.userId || null,
    })
  })
  next()
}

/**
 * Security event helpers
 */
export const securityLog = {
  loginSuccess: (userId, email, ip, ua) =>
    logger.info('auth.login_success', { userId, email, ip, userAgent: ua, event: 'AUTH' }),

  loginFailure: (email, ip, ua, reason) =>
    logger.warn('auth.login_failure', { email, ip, userAgent: ua, reason, event: 'AUTH' }),

  logout: (userId, ip) =>
    logger.info('auth.logout', { userId, ip, event: 'AUTH' }),

  tokenInvalid: (ip, reason) =>
    logger.warn('auth.token_invalid', { ip, reason, event: 'AUTH' }),

  permissionDenied: (userId, resource, permission, ip) =>
    logger.warn('authz.permission_denied', { userId, resource, permission, ip, event: 'AUTHZ' }),

  rateLimitHit: (ip, endpoint, userId = null) =>
    logger.warn('rate.limit_hit', { ip, endpoint, userId, event: 'RATE' }),

  validationFailure: (endpoint, field, reason, ip) =>
    logger.warn('input.validation_failure', { endpoint, field, reason, ip, event: 'INPUT' }),

  adminAction: (userId, action, resourceId, before, after) =>
    logger.info('admin.action', { userId, action, resourceId, before: redact(before), after: redact(after), event: 'ADMIN' }),

  userCreated: (actorId, newUserId, role) =>
    logger.info('admin.user_created', { actorId, newUserId, role, event: 'ADMIN' }),

  userDeleted: (actorId, deletedUserId) =>
    logger.info('admin.user_deleted', { actorId, deletedUserId, event: 'ADMIN' }),
}

export default logger
