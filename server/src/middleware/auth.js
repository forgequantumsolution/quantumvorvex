import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'

// One active session per user. Off by default so local dev / E2E logins don't evict
// each other; enable with ENFORCE_SINGLE_SESSION=true (production).
const ENFORCE_SINGLE_SESSION = process.env.ENFORCE_SINGLE_SESSION === 'true'

export const verifyToken = async (req, res, next) => {
  try {
    let token = null

    // Try Authorization header first
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }

    // Fall back to httpOnly cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token
    }

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Single-session enforcement: the token's sessionVersion must match the user's
    // current value. A newer login elsewhere bumps it, making this token stale.
    // Skipped entirely (stateless, no DB hit) when the flag is off.
    if (ENFORCE_SINGLE_SESSION) {
      const user = await prisma.user.findUnique({
        where:  { id: decoded.userId },
        select: { sessionVersion: true, status: true },
      })

      if (!user || user.status === 'inactive') {
        return res.status(401).json({ message: 'Account is unavailable. Please sign in again.', code: 'ERR_SESSION_INVALID' })
      }

      // Token predates the feature (no sessionVersion claim) — not a takeover, just needs
      // one fresh login. Avoid the misleading "logged in elsewhere" copy.
      if (decoded.sessionVersion === undefined) {
        return res.status(401).json({ message: 'Your session has expired. Please sign in again.', code: 'ERR_SESSION_EXPIRED' })
      }

      if (user.sessionVersion !== decoded.sessionVersion) {
        return res.status(401).json({ message: 'You were signed out because your account logged in on another device.', code: 'ERR_SESSION_SUPERSEDED' })
      }
    }

    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

// Role hierarchy: owner > manager > staff
const ROLE_RANK = { owner: 3, manager: 2, staff: 1, admin: 3 }

/**
 * requireRole(['owner', 'manager']) — passes if token role is in the allowed list
 */
export const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const userRole = req.user?.role
  if (!userRole || !allowed.includes(userRole)) {
    return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' })
  }
  next()
}

/**
 * requireMinRole('manager') — passes if user rank >= minRole rank
 */
export const requireMinRole = (minRole) => (req, res, next) => {
  const userRank = ROLE_RANK[req.user?.role] || 0
  const minRank  = ROLE_RANK[minRole] || 0
  if (userRank < minRank) {
    return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' })
  }
  next()
}
