import jwt from 'jsonwebtoken'

export const verifyToken = (req, res, next) => {
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
