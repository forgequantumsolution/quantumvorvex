import bcrypt from 'bcryptjs'
import prisma from '../utils/prisma.js'
import logger, { securityLog } from '../utils/logger.js'
import { bustUser } from '../utils/permissionCache.js'
import { audit } from '../utils/audit.js'

// Shared default for new accounts when no password is supplied (changeable in Settings).
const DEFAULT_PASSWORD = 'Welcome@123'

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  roleId: true,
  status: true,
  isSuperAdmin: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  roleRef: { select: { id: true, name: true, isOwner: true } },
  propertyAccess: {
    select: { propertyId: true, role: { select: { id: true, name: true } }, property: { select: { name: true, code: true } } },
  },
}

// API shape. Owners hold their org role everywhere; everyone else is shown with
// their role AT THE CURRENT PROPERTY (roleId/roleRef), plus the full `access`
// list (all properties + role at each) for the owner's access matrix.
function shapeUser(u, propertyId) {
  const { propertyAccess, ...user } = u
  const access = propertyAccess.map((a) => ({
    propertyId: a.propertyId, propertyName: a.property.name, propertyCode: a.property.code,
    roleId: a.role.id, roleName: a.role.name,
  }))
  const isOwner = !!user.roleRef?.isOwner
  const here = access.find((a) => a.propertyId === propertyId)
  return {
    ...user,
    isOwner,
    roleId:  isOwner ? user.roleId : here?.roleId ?? null,
    roleRef: isOwner ? user.roleRef : here ? { id: here.roleId, name: here.roleName, isOwner: false } : null,
    access,
  }
}

// Count of active users whose role grants owner (isOwner) — used to protect the last owner.
function activeOwnerCount() {
  return prisma.user.count({ where: { status: 'active', roleRef: { isOwner: true } } })
}

const requesterIsOwner = (req) => !!req.propertyAccess?.isOwner

// A non-owner admin may only manage people who work at the current property and
// are not owners. Returns an error message, or null when allowed.
function manageableBy(req, target) {
  if (requesterIsOwner(req)) return null
  if (target.roleRef?.isOwner) return 'Only an owner can manage an owner account.'
  if (!target.propertyAccess.some((a) => a.propertyId === req.propertyId)) return 'User not found.'
  return null
}

// GET /api/v1/users — owners see everyone; others see the current property's team.
export const getUsers = async (req, res) => {
  try {
    const where = requesterIsOwner(req) ? {} : { propertyAccess: { some: { propertyId: req.propertyId } } }
    const users = await prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { createdAt: 'asc' } })
    res.json(users.map((u) => shapeUser(u, req.propertyId)))
  } catch (e) {
    logger.error('getUsers error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// POST /api/v1/users — creates the account and gives it access to the CURRENT
// property with the chosen role (owners need no property access).
export const createUser = async (req, res) => {
  try {
    const { name, email, password, roleId, phone, status } = req.body
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }

    // Resolve the role from roleId; fall back to the Staff role when none given.
    const role = roleId
      ? await prisma.role.findUnique({ where: { id: roleId } })
      : await prisma.role.findFirst({ where: { name: 'Staff' } })
    if (roleId && !role) return res.status(400).json({ error: 'Selected role does not exist.' })

    // Only an owner can mint another owner-level account.
    if (role?.isOwner && !requesterIsOwner(req)) {
      return res.status(403).json({ error: 'Only an owner can assign the Owner role.' })
    }

    const usedDefault = !password
    const hash = await bcrypt.hash(password || DEFAULT_PASSWORD, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        roleId: role?.id || null,
        phone: phone || null,
        status: status || 'active',
        mustChangePassword: usedDefault,
        ...(role && !role.isOwner
          ? { propertyAccess: { create: { propertyId: req.propertyId, roleId: role.id } } }
          : {}),
      },
      select: SAFE_SELECT,
    })
    securityLog.userCreated(req.user?.userId, user.id, role?.name)
    await audit(req, 'user.create', { entity: 'user', entityId: user.id, detail: `${user.email} → ${role?.name || 'no role'} @ ${req.propertyId}` })
    const shaped = shapeUser(user, req.propertyId)
    // Surface the default password once so the admin can hand it to the new user.
    res.status(201).json(usedDefault ? { ...shaped, defaultPassword: DEFAULT_PASSWORD } : shaped)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists.' })
    logger.error('createUser error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// PUT /api/v1/users/:id — profile/status edits, and a role change that applies to
// the CURRENT property (or promotes to / demotes from org-wide Owner).
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, roleId, status, password } = req.body

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true, propertyAccess: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })
    const denied = manageableBy(req, target)
    if (denied) return res.status(denied === 'User not found.' ? 404 : 403).json({ error: denied })

    // The protected super-admin's role, status, and email are immutable (name/phone/
    // password may still be updated). Re-seeded on every boot regardless.
    if (target.isSuperAdmin) {
      if (roleId !== undefined && roleId !== target.roleId)
        return res.status(403).json({ error: "The super admin's role cannot be changed." })
      if (status !== undefined && status !== target.status)
        return res.status(403).json({ error: 'The super admin cannot be deactivated.' })
      if (email !== undefined && email.toLowerCase() !== target.email.toLowerCase())
        return res.status(403).json({ error: "The super admin's email cannot be changed." })
    }

    const roleChangeRequested = roleId !== undefined && roleId !== null
    let newRole = target.roleRef
    if (roleChangeRequested) {
      newRole = await prisma.role.findUnique({ where: { id: roleId } })
      if (!newRole) return res.status(400).json({ error: 'Selected role does not exist.' })
      if (newRole.isOwner && !requesterIsOwner(req)) {
        return res.status(403).json({ error: 'Only an owner can assign the Owner role.' })
      }
    }

    // Last-owner invariant: block any change that would drop the final active owner
    // (demotion or deactivation).
    const wasOwner     = !!target.roleRef?.isOwner
    const willBeOwner  = roleChangeRequested ? !!newRole?.isOwner : wasOwner
    const willBeActive = status !== undefined ? status === 'active' : target.status === 'active'
    if (wasOwner && (!willBeOwner || !willBeActive)) {
      const owners = await activeOwnerCount()
      if (owners <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last active owner.' })
      }
    }

    const data = {}
    if (name !== undefined)   data.name   = name
    if (email !== undefined)  data.email  = email
    if (phone !== undefined)  data.phone  = phone
    if (status !== undefined) data.status = status
    if (password)             data.password = await bcrypt.hash(password, 12)
    // The org role is the user's owner status / default role; a non-owner role is
    // also (re)applied to the current property.
    if (roleChangeRequested)  data.roleId = newRole.id

    const user = await prisma.$transaction(async (tx) => {
      if (roleChangeRequested && !newRole.isOwner) {
        await tx.propertyAccess.upsert({
          where:  { userId_propertyId: { userId: id, propertyId: req.propertyId } },
          update: { roleId: newRole.id },
          create: { userId: id, propertyId: req.propertyId, roleId: newRole.id },
        })
      }
      return tx.user.update({ where: { id }, data, select: SAFE_SELECT })
    })
    bustUser(id)   // role reassignment / deactivation takes effect on the next request
    if (roleChangeRequested) await audit(req, 'user.role_change', { entity: 'user', entityId: id, detail: `→ ${newRole.name} @ ${newRole.isOwner ? 'all properties' : req.propertyId}` })
    if (status !== undefined) await audit(req, 'user.status_change', { entity: 'user', entityId: id, detail: status })
    res.json(shapeUser(user, req.propertyId))
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists.' })
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found.' })
    logger.error('updateUser error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// PUT /api/v1/users/:id/access (owner) — replace the full set of properties a
// non-owner can open, with their role at each.
export const setUserAccess = async (req, res) => {
  try {
    const { id } = req.params
    const { access } = req.body

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })
    if (target.roleRef?.isOwner) {
      return res.status(400).json({ error: 'Owners already have access to every property.' })
    }

    const propertyIds = [...new Set(access.map((a) => a.propertyId))]
    const roleIds = [...new Set(access.map((a) => a.roleId))]
    const [properties, roles] = await Promise.all([
      prisma.property.count({ where: { id: { in: propertyIds } } }),
      prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, isOwner: true } }),
    ])
    if (properties !== propertyIds.length) return res.status(400).json({ error: 'Unknown property in access list.' })
    if (roles.length !== roleIds.length) return res.status(400).json({ error: 'Unknown role in access list.' })
    if (roles.some((r) => r.isOwner)) {
      return res.status(400).json({ error: 'Owner is an organisation-wide role; change the user\'s role instead.' })
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.propertyAccess.deleteMany({ where: { userId: id } })
      if (access.length) {
        await tx.propertyAccess.createMany({
          data: access.map((a) => ({ userId: id, propertyId: a.propertyId, roleId: a.roleId })),
          skipDuplicates: true,
        })
      }
      return tx.user.findUnique({ where: { id }, select: SAFE_SELECT })
    })
    bustUser(id)
    await audit(req, 'user.access_change', {
      entity: 'user', entityId: id, detail: access.map((a) => `${a.propertyId}:${a.roleId}`).join(', ') || 'none',
    })
    res.json(shapeUser(user, req.propertyId))
  } catch (e) {
    logger.error('setUserAccess error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// DELETE /api/v1/users/:id — an owner deletes the account; a property admin
// removes the user from the current property only (their other properties and
// the account itself are untouched).
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account.' })
    }

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true, propertyAccess: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })
    const denied = manageableBy(req, target)
    if (denied) return res.status(denied === 'User not found.' ? 404 : 403).json({ error: denied })

    if (target.isSuperAdmin) {
      return res.status(403).json({ error: 'The super admin account cannot be deleted.' })
    }

    if (!requesterIsOwner(req)) {
      await prisma.propertyAccess.delete({ where: { userId_propertyId: { userId: id, propertyId: req.propertyId } } })
      bustUser(id)
      await audit(req, 'user.access_remove', { entity: 'user', entityId: id, detail: `${target.email} @ ${req.propertyId}` })
      return res.json({ success: true, removedFromProperty: true })
    }

    // Protect the last active owner.
    if (target.roleRef?.isOwner && target.status === 'active') {
      const owners = await activeOwnerCount()
      if (owners <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last active owner.' })
      }
    }

    await prisma.user.delete({ where: { id } })
    bustUser(id)
    securityLog.userDeleted(req.user?.userId, id)
    await audit(req, 'user.delete', { entity: 'user', entityId: id, detail: target.email })
    res.json({ success: true })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found.' })
    logger.error('deleteUser error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}
