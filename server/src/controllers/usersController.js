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
}

// Count of active users whose role grants owner (isOwner) — used to protect the last owner.
function activeOwnerCount() {
  return prisma.user.count({ where: { status: 'active', roleRef: { isOwner: true } } })
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
    const { name, email, password, roleId, phone, status } = req.body
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }

    // Resolve the role from roleId; fall back to the Staff role when none given.
    let role = roleId
      ? await prisma.role.findUnique({ where: { id: roleId } })
      : await prisma.role.findFirst({ where: { name: 'Staff' } })
    if (roleId && !role) return res.status(400).json({ error: 'Selected role does not exist.' })

    // Only an owner can mint another owner-level account.
    if (role?.isOwner && !req._access?.isOwner) {
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
      },
      select: SAFE_SELECT,
    })
    securityLog.userCreated(req.user?.userId, user.id, role?.name)
    await audit(req, 'user.create', { entity: 'user', entityId: user.id, detail: `${user.email} → ${role?.name || 'no role'}` })
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
    const { name, email, phone, roleId, status, password } = req.body

    const target = await prisma.user.findUnique({ where: { id }, include: { roleRef: true } })
    if (!target) return res.status(404).json({ error: 'User not found.' })

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

    const roleChangeRequested = roleId !== undefined
    let newRole = target.roleRef
    if (roleChangeRequested) {
      newRole = roleId ? await prisma.role.findUnique({ where: { id: roleId } }) : null
      if (roleId && !newRole) return res.status(400).json({ error: 'Selected role does not exist.' })
      if (newRole?.isOwner && !req._access?.isOwner) {
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
    if (roleChangeRequested)  data.roleId = newRole?.id || null

    const user = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT })
    bustUser(id)   // role reassignment / deactivation takes effect on the next request
    if (roleChangeRequested) await audit(req, 'user.role_change', { entity: 'user', entityId: id, detail: `→ ${newRole?.name || 'none'}` })
    if (status !== undefined) await audit(req, 'user.status_change', { entity: 'user', entityId: id, detail: status })
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

    if (target.isSuperAdmin) {
      return res.status(403).json({ error: 'The super admin account cannot be deleted.' })
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
    res.status(500).json({ error: e.message })
  }
}
