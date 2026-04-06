import bcrypt from 'bcryptjs'
import prisma from '../utils/prisma.js'
import logger, { securityLog } from '../utils/logger.js'

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
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
    const { name, email, password, role, phone } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' })
    }

    const validRoles = ['owner', 'manager', 'staff']
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` })
    }

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hash, role: role || 'staff', phone: phone || null },
      select: SAFE_SELECT,
    })
    securityLog.userCreated(req.user?.userId, user.id, user.role)
    res.status(201).json(user)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists.' })
    res.status(500).json({ error: e.message })
  }
}

// PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, role, status, password } = req.body

    // Prevent non-owners from escalating to owner role
    if (role === 'owner' && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only an owner can assign owner role.' })
    }

    const data = {}
    if (name !== undefined)   data.name   = name
    if (email !== undefined)  data.email  = email
    if (phone !== undefined)  data.phone  = phone
    if (role !== undefined)   data.role   = role
    if (status !== undefined) data.status = status
    if (password)             data.password = await bcrypt.hash(password, 12)

    const user = await prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    })
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

    // Prevent self-deletion
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account.' })
    }

    // Prevent deleting the last owner
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (target?.role === 'owner') {
      const ownerCount = await prisma.user.count({ where: { role: 'owner', status: 'active' } })
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last owner account.' })
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
