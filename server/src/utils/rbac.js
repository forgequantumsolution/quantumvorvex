/**
 * RBAC bootstrap — idempotent, safe to run on every server start.
 *
 * Migrations create the Role/RolePermission tables and the nullable User.roleId, but they
 * DON'T seed roles or link users. Without this, a fresh `migrate deploy` leaves every user
 * with roleId = null → enforcement 403s everyone (the "locked out after deploy" bug).
 *
 * ensureRbac() guarantees:
 *   1. the three system roles exist with their permission matrix,
 *   2. every user has a role (sensible default), and
 *   3. at least one active Owner exists — so the app is never locked out.
 */
import bcrypt from 'bcryptjs'
import prisma from './prisma.js'
import { MODULES } from '../config/modules.js'
import logger from './logger.js'

// Protected super-admin — always present, role/status locked, cannot be deleted.
// Credentials are overridable via env for production; defaults are the founder account.
export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'info@forgequantumsolution.com').toLowerCase()
const SUPER_ADMIN_PASSWORD     = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123'
const SUPER_ADMIN_NAME         = process.env.SUPER_ADMIN_NAME || 'Super Admin'

const M = (level) => Object.fromEntries(MODULES.map((m) => [m, level]))

// System roles mirror the legacy owner/manager/staff behavior.
export const SYSTEM_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to everything, including users and roles.',
    isSystem: true, isOwner: true,
    perms: M('MANAGE'),
  },
  {
    name: 'Manager',
    description: 'Operational and finance access; cannot manage users or roles.',
    isSystem: true, isOwner: false,
    perms: { ...M('MANAGE'), users: 'NONE' },
  },
  {
    name: 'Staff',
    description: 'Front-desk and operations only.',
    isSystem: true, isOwner: false,
    perms: {
      ...M('NONE'),
      bookings: 'MANAGE', maintenance: 'MANAGE', guests: 'MANAGE',
      rooms: 'MANAGE', housekeeping: 'MANAGE',
    },
  },
]

// Upsert the system roles + their permissions. Returns { Owner, Manager, Staff } → roleId.
export async function ensureSystemRoles() {
  const ids = {}
  for (const def of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where:  { name: def.name },
      update: { description: def.description, isSystem: def.isSystem, isOwner: def.isOwner },
      create: { name: def.name, description: def.description, isSystem: def.isSystem, isOwner: def.isOwner },
    })
    ids[def.name] = role.id
    for (const [module, level] of Object.entries(def.perms)) {
      await prisma.rolePermission.upsert({
        where:  { roleId_module: { roleId: role.id, module } },
        update: { level },
        create: { roleId: role.id, module, level },
      })
    }
  }
  return ids
}

// Known seeded accounts → their intended role (for backfilling after an upgrade).
const KNOWN_OWNERS   = ['owner@quantumvorvex.com', 'admin@hotel.com']
const KNOWN_MANAGERS = ['manager@quantumvorvex.com']

/**
 * Ensure the protected super-admin exists with the Owner role. Runs on every boot, so
 * it's present on a fresh DB and re-asserted on upgrades. Never resets an existing
 * password (the admin may have changed it) — it only enforces role/super-admin/active.
 */
export async function ensureSuperAdmin(ownerRoleId) {
  const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data:  { roleId: ownerRoleId, isSuperAdmin: true, status: 'active' },
    })
    return existing.id
  }
  const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)
  const created = await prisma.user.create({
    data: {
      name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL, password: hash,
      roleId: ownerRoleId, isSuperAdmin: true, status: 'active',
    },
  })
  logger.info('Super-admin account seeded', { event: 'SYSTEM', email: SUPER_ADMIN_EMAIL })
  return created.id
}

export async function ensureRbac() {
  try {
    const ids = await ensureSystemRoles()

    // Protected super-admin — always present and an Owner.
    await ensureSuperAdmin(ids.Owner)

    // Backfill any user without a role so they aren't locked out.
    const unassigned = await prisma.user.findMany({
      where: { roleId: null },
      select: { id: true, email: true },
    })
    for (const u of unassigned) {
      const email = (u.email || '').toLowerCase()
      let roleId = ids.Staff
      if (KNOWN_OWNERS.includes(email))        roleId = ids.Owner
      else if (KNOWN_MANAGERS.includes(email)) roleId = ids.Manager
      await prisma.user.update({ where: { id: u.id }, data: { roleId } })
    }
    if (unassigned.length) {
      logger.info(`RBAC bootstrap: assigned roles to ${unassigned.length} user(s)`, { event: 'SYSTEM' })
    }

    // Safety net: never leave the system without an owner.
    const ownerCount = await prisma.user.count({ where: { status: 'active', roleRef: { isOwner: true } } })
    if (ownerCount === 0) {
      const first = await prisma.user.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } })
      if (first) {
        await prisma.user.update({ where: { id: first.id }, data: { roleId: ids.Owner } })
        logger.warn('RBAC bootstrap: no active owner found — promoted earliest active user to Owner', {
          event: 'SYSTEM', userId: first.id,
        })
      }
    }
  } catch (err) {
    logger.error('RBAC bootstrap failed', { error: err.message, event: 'SYSTEM' })
  }
}
