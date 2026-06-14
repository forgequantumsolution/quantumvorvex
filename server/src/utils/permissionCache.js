/**
 * In-memory permission cache for RBAC enforcement.
 *
 * The JWT only carries `userId`, so each request resolves the user's CURRENT role +
 * permissions here. That means role reassignment, permission edits, and deactivation
 * take effect immediately (after a cache bust) without waiting for the token to expire.
 *
 * Two layers:
 *   userCache: userId  -> { status, roleId }
 *   roleCache: roleId  -> { isOwner, perms: { module: level } }
 *
 * Bust on the relevant mutation (see rolesController / usersController). Single-process
 * only — for multi-instance deployments move this to Redis (see single-session TODO).
 */
import prisma from './prisma.js'

const userCache = new Map()
const roleCache = new Map()

async function loadUser(userId) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, roleId: true },
  })
  if (!row) return null
  const u = { status: row.status, roleId: row.roleId }
  userCache.set(userId, u)
  return u
}

async function loadRole(roleId) {
  const r = await prisma.role.findUnique({
    where: { id: roleId },
    select: { isOwner: true, permissions: { select: { module: true, level: true } } },
  })
  const role = r
    ? { isOwner: r.isOwner, perms: Object.fromEntries(r.permissions.map((p) => [p.module, p.level])) }
    : { isOwner: false, perms: {} }
  roleCache.set(roleId, role)
  return role
}

/**
 * Returns { status, roleId, isOwner, perms } for a user, or null if the user is gone.
 */
export async function getUserAccess(userId) {
  if (!userId) return null
  const u = userCache.get(userId) || (await loadUser(userId))
  if (!u) return null
  let role = { isOwner: false, perms: {} }
  if (u.roleId) role = roleCache.get(u.roleId) || (await loadRole(u.roleId))
  return { status: u.status, roleId: u.roleId, isOwner: role.isOwner, perms: role.perms }
}

export function bustUser(userId) { if (userId) userCache.delete(userId) }
export function bustRole(roleId) { if (roleId) roleCache.delete(roleId) }
export function bustAll() { userCache.clear(); roleCache.clear() }
