/**
 * In-memory access cache for RBAC + multi-property enforcement.
 *
 * The JWT only carries `userId`, so each request resolves the user's CURRENT access
 * here. Role reassignment, permission edits, property membership changes and
 * deactivation take effect immediately (after a cache bust) without waiting for
 * the token to expire.
 *
 * Three layers:
 *   userCache:  userId -> { status, roleId, memberships: { propertyId: roleId } }
 *   roleCache:  roleId -> { name, isOwner, perms: { module: level } }
 *   properties: all Property rows (a handful per install) — null until loaded
 *
 * Access model: a user whose org role (User.roleId) isOwner can open every
 * property with full rights. Anyone else can open only the properties they hold a
 * PropertyAccess row for, with the permissions of the role on that row.
 *
 * Bust on the relevant mutation (see roles/users/properties controllers).
 * Single-process only — for multi-instance deployments move this to Redis.
 */
import prisma from './prisma.js'

const userCache = new Map()
const roleCache = new Map()
let properties = null

const NO_ROLE = { name: null, isOwner: false, perms: {} }

async function loadUser(userId) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, roleId: true, propertyAccess: { select: { propertyId: true, roleId: true } } },
  })
  if (!row) return null
  const u = {
    status: row.status,
    roleId: row.roleId,
    memberships: Object.fromEntries(row.propertyAccess.map((a) => [a.propertyId, a.roleId])),
  }
  userCache.set(userId, u)
  return u
}

async function loadRole(roleId) {
  const r = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, isOwner: true, permissions: { select: { module: true, level: true } } },
  })
  const role = r
    ? { name: r.name, isOwner: r.isOwner, perms: Object.fromEntries(r.permissions.map((p) => [p.module, p.level])) }
    : NO_ROLE
  roleCache.set(roleId, role)
  return role
}

const getRole = async (roleId) => (roleId ? roleCache.get(roleId) || loadRole(roleId) : NO_ROLE)

export async function getProperties() {
  if (!properties) {
    properties = await prisma.property.findMany({
      select: { id: true, name: true, code: true, status: true },
      orderBy: { createdAt: 'asc' },
    })
  }
  return properties
}

/**
 * Organisation-level access: { status, roleId, roleName, isOwner, perms, memberships },
 * or null if the user is gone. `perms` is the org role's map (meaningful for owners;
 * for everyone else per-property perms come from getPropertyAccess).
 */
export async function getUserAccess(userId) {
  if (!userId) return null
  const u = userCache.get(userId) || (await loadUser(userId))
  if (!u) return null
  const role = await getRole(u.roleId)
  return {
    status: u.status, roleId: u.roleId, roleName: role.name,
    isOwner: role.isOwner, perms: role.perms, memberships: u.memberships,
  }
}

/**
 * The user's access to one property, or null if they may not open it:
 *   { property, roleId, roleName, isOwner, perms }
 * Archived properties are visible to owners only.
 */
export async function getPropertyAccess(access, propertyId) {
  if (!access || !propertyId) return null
  const property = (await getProperties()).find((p) => p.id === propertyId)
  if (!property) return null

  if (access.isOwner) {
    return { property, roleId: access.roleId, roleName: access.roleName, isOwner: true, perms: access.perms }
  }
  if (property.status !== 'active') return null
  const roleId = access.memberships[propertyId]
  if (!roleId) return null
  const role = await getRole(roleId)
  return { property, roleId, roleName: role.name, isOwner: false, perms: role.perms }
}

/** Every property the user may open, each with their role/permissions there. */
export async function listPropertyAccess(access) {
  if (!access) return []
  const all = await getProperties()
  const resolved = await Promise.all(all.map((p) => getPropertyAccess(access, p.id)))
  return resolved.filter(Boolean)
}

export function bustUser(userId) { if (userId) userCache.delete(userId) }
export function bustRole(roleId) { if (roleId) roleCache.delete(roleId) }
export function bustProperties() { properties = null }
export function bustAll() { userCache.clear(); roleCache.clear(); properties = null }
