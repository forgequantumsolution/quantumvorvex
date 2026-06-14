import bcrypt from 'bcryptjs'
import prisma from '../utils/prisma.js'
import logger, { securityLog } from '../utils/logger.js'

// Shared default for new accounts when no password is supplied (changeable in Settings).
const DEFAULT_PASSWORD = 'Welcome@123'

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  roleId: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  roleRef: { select: { id: true, name: true, isOwner: true } },
}

// Keep the legacy `role` string roughly in sync with the assigned Role so the JWT /
// static sidebar keep working until the frontend reads permissions dynamically.
function legacyRoleFor(role) {
  if (!role) return 'staff'
  if (role.isOwner) return 'owner'
  if (role.name === 'Manager') return 'manager'
  if (role.name === 'Staff') return 'staff'
  return 'staff'
}

// Count of active users whose role grants owner (isOwner) — used to protect the last owner.
function activeOwnerCount() {
  return prisma.user.count({ where: { status: 'active', roleRef: { isOwner: true } } })
}

// Resolve a Role from either an explicit roleId (preferred) or the legacy role string
// (so the older Settings → Users tab, which sends 'owner'/'manager'/'staff', keeps working).
async function resolveRole({ roleId, role }) {
  if (roleId) return prisma.role.findUnique({ where: { id: roleId } })
  if (role === 'owner')   return prisma.role.findFirst({ where: { isOwner: true } })
  if (role === 'manager') return prisma.role.findFirst({ where: { name: 'Manager' } })
  if (role === 'staff')   return prisma.role.findFirst({ where: { name: 'Staff' } })
  return null
}

// GET /api/v1/users
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: SAFE_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/v1/users
export const createUser = async (req, res) => {
  try {
    const { name, email, password, roleId, role: legacyRole, phone, status } = req.body
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }

    // Resolve the role: explicit roleId / legacy role string, else fall back to Staff.
    let role = await resolveRole({ roleId, role: legacyRole })
    if (roleId && !role) return res.status(400).json({ error: 'Selected role does not exist.' })
    if (!role) role = await prisma.role.findFirst({ where: { name: 'Staff' } })

    // Only an owner can mint another owner-level account.
    if (role?.isOwner && req.user.role !== 'owner') {
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
        role: legacyRoleFor(role),
        phone: phone || null,
        status: status || 'active',
        mustChangePassword: usedDefault,
      },
      select: SAFE_SELECT,
    })
    securityLog.userCreated(req.user?.userId, user.id, role?.name)
    // Surface the default password once so the admin can hand it to the new user.
    res.status(201).json(usedDefault ? { ...user, defaultPassword: DEFAULT_PASSWORD } : user)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists.' })
    res.status(500).json({ error: e.message })
  }
}

// PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, roleId, role: legacyRole, status, password } = req.body

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })

    // A role change is requested if either roleId or the legacy role string is present.
    const roleChangeRequested = roleId !== undefined || legacyRole !== undefined
    let newRole = target.roleRef
    if (roleChangeRequested) {
      newRole = await resolveRole({ roleId, role: legacyRole })
      if (roleId && !newRole) return res.status(400).json({ error: 'Selected role does not exist.' })
      if (newRole?.isOwner && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Only an owner can assign the Owner role.' })
      }
    }

    // Last-owner invariant: block any change that would drop the final active owner
    // (demotion, role removal, or deactivation).
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
    if (roleChangeRequested) {
      data.roleId = newRole?.id || null
      data.role   = legacyRoleFor(newRole)
    }

    const user = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
    res.json(user)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists.' })
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found.' })
    res.status(500).json({ error: e.message })
  }
}

// DELETE /api/v1/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account.' })
    }

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })

    // Protect the last active owner.
    if (target.roleRef?.isOwner && target.status === 'active') {
      const owners = await activeOwnerCount()
      if (owners <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last active owner.' })
      }
    }

    await prisma.user.delete({ where: { id } })
    securityLog.userDeleted(req.user?.userId, id)
    res.json({ success: true })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'User not found.' })
    res.status(500).json({ error: e.message })
  }
}
