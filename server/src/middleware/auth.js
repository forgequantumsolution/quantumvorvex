import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'
import { LEVEL_RANK } from '../config/modules.js'
import { getUserAccess, getPropertyAccess, listPropertyAccess } from '../utils/permissionCache.js'
import { enterProperty } from '../utils/propertyContext.js'

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

// ─── RBAC + property enforcement ───────────────────────────────────────────────
// Resolve the requester's CURRENT org-level access once per request (cached on req,
// backed by an in-memory cache). Used by the middleware below.
async function resolveAccess(req) {
  if (req._access !== undefined) return req._access
  req._access = await getUserAccess(req.user?.userId)
  return req._access
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Which property the request acts on: the X-Property-Id header (set by the SPA's
// property switcher), or ?propertyId= for links opened in a new tab (invoice PDFs),
// else the user's first accessible property. Returns { status, body } on failure.
async function resolveProperty(req, access) {
  const requested = req.get('x-property-id') || req.query?.propertyId
  if (requested) {
    const pa = await getPropertyAccess(access, String(requested))
    if (!pa) {
      return { error: { status: 403, body: { message: 'You do not have access to this property.', code: 'ERR_PROPERTY_FORBIDDEN' } } }
    }
    return { pa }
  }
  const all = await listPropertyAccess(access)
  const pa = all.find((p) => p.property.status === 'active') || all[0]
  if (!pa) {
    return { error: { status: 403, body: { message: 'Your account has not been assigned to any property yet.', code: 'ERR_NO_PROPERTY' } } }
  }
  return { pa }
}

// Shared core of requireProperty / requirePermission: authenticate the account,
// pick the property, optionally check a module level there, then continue the
// request inside that property's context (every query is scoped from here on).
const propertyGuard = (moduleKey, action) => async (req, res, next) => {
  let pa
  try {
    const access = await resolveAccess(req)
    if (!access) {
      return res.status(401).json({ message: 'Account is unavailable. Please sign in again.', code: 'ERR_SESSION_INVALID' })
    }
    if (access.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact an administrator.', code: 'ERR_ACCOUNT_INACTIVE' })
    }

    const resolved = await resolveProperty(req, access)
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body)
    pa = resolved.pa

    // Archived properties stay readable for the owner's records, but are frozen.
    if (pa.property.status !== 'active' && !READ_METHODS.has(req.method)) {
      return res.status(403).json({ message: 'This property is archived and read-only.', code: 'ERR_PROPERTY_ARCHIVED' })
    }

    if (moduleKey && !pa.isOwner) {
      const required = (action || (READ_METHODS.has(req.method) ? 'VIEW' : 'MANAGE')).toUpperCase()
      const have     = pa.perms[moduleKey] || 'NONE'
      if ((LEVEL_RANK[have] || 0) < (LEVEL_RANK[required] || 0)) {
        return res.status(403).json({
          message: 'Forbidden. Insufficient permissions.',
          code: 'ERR_FORBIDDEN', module: moduleKey, required, propertyId: pa.property.id,
        })
      }
    }
  } catch (err) {
    return res.status(500).json({ message: 'Authorization check failed.', code: 'ERR_INTERNAL' })
  }

  req.propertyId = pa.property.id
  req.propertyAccess = pa
  enterProperty(pa.property.id, next)
}

/**
 * requirePermission('billing')           — level inferred from method (GET→VIEW, else MANAGE)
 * requirePermission('reports', 'VIEW')   — explicit level (use when the verb ≠ intent,
 *                                           e.g. POST /reports/export is really a read)
 * The level is checked against the user's role AT THE CURRENT PROPERTY; org owners
 * pass everywhere. Must run after verifyToken. Sets req.propertyId.
 */
export const requirePermission = (moduleKey, action) => propertyGuard(moduleKey, action)

/**
 * requireProperty — any user with access to the current property, no module check
 * (e.g. notifications). Sets req.propertyId and the property context.
 */
export const requireProperty = propertyGuard(null)

/**
 * requireOwner — only users whose org role has isOwner. Used for role and
 * property management, which are organisation-wide.
 */
export const requireOwner = async (req, res, next) => {
  const access = await resolveAccess(req)
  if (!access || !access.isOwner) {
    return res.status(403).json({ message: 'Owner access required.', code: 'ERR_FORBIDDEN' })
  }
  next()
}
