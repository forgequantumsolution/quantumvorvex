import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'
import { LEVEL_RANK } from '../config/modules.js'
import { getUserAccess } from '../utils/permissionCache.js'

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

// ─── RBAC enforcement ──────────────────────────────────────────────────────────
// Resolve the requester's CURRENT role + permissions once per request (cached on req,
// backed by an in-memory cache). Used by requirePermission / requireOwner below.
async function resolveAccess(req) {
  if (req._access !== undefined) return req._access
  req._access = await getUserAccess(req.user?.userId)
  return req._access
}

/**
 * requirePermission('billing')           — level inferred from method (GET→VIEW, else MANAGE)
 * requirePermission('reports', 'VIEW')   — explicit level (use when the verb ≠ intent,
 *                                           e.g. POST /reports/export is really a read)
 * Owner roles (isOwner) bypass all checks. Must run after verifyToken.
 */
export const requirePermission = (moduleKey, action) => async (req, res, next) => {
  try {
    const access = await resolveAccess(req)
    if (!access) {
      return res.status(401).json({ message: 'Account is unavailable. Please sign in again.', code: 'ERR_SESSION_INVALID' })
    }
    if (access.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact an administrator.', code: 'ERR_ACCOUNT_INACTIVE' })
    }
    if (access.isOwner) return next()

    const required = (action || (req.method === 'GET' ? 'VIEW' : 'MANAGE')).toUpperCase()
    const have     = access.perms[moduleKey] || 'NONE'
    if ((LEVEL_RANK[have] || 0) >= (LEVEL_RANK[required] || 0)) return next()

    return res.status(403).json({
      message: 'Forbidden. Insufficient permissions.',
      code: 'ERR_FORBIDDEN', module: moduleKey, required,
    })
  } catch (err) {
    return res.status(500).json({ message: 'Authorization check failed.', code: 'ERR_INTERNAL' })
  }
}

/**
 * requireOwner — only users whose role has isOwner. Used for role management.
 */
export const requireOwner = async (req, res, next) => {
  const access = await resolveAccess(req)
  if (!access || !access.isOwner) {
    return res.status(403).json({ message: 'Owner access required.', code: 'ERR_FORBIDDEN' })
  }
  next()
}
