import prisma from '../utils/prisma.js'
import bcrypt from 'bcryptjs'

export const getStaff = async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({ select: { id:true, name:true, phone:true, email:true, role:true, status:true, lastLogin:true, createdAt:true }, orderBy: { createdAt: 'asc' } })
    res.json(staff)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const createStaff = async (req, res) => {
  try {
    const { name, phone, email, role, password } = req.body
    const passwordHash = await bcrypt.hash(password || 'Welcome@123', 12)
    const staff = await prisma.staff.create({ data: { name, phone, email, role, passwordHash } })
    const { passwordHash: _, ...safe } = staff
    res.status(201).json(safe)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: e.message })
  }
}

export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params
    const { password, ...rest } = req.body
    const data = { ...rest }
    if (password) data.passwordHash = await bcrypt.hash(password, 12)
    const staff = await prisma.staff.update({ where: { id }, data })
    const { passwordHash: _, ...safe } = staff
    res.json(safe)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getActivity = async (req, res) => {
  try {
    const { staffId, module, from, to } = req.query
    const where = {}
    if (staffId) where.staffId = staffId
    if (module) where.module = module
    if (from || to) where.createdAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) }
    const logs = await prisma.activityLog.findMany({ where, include: { staff: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
    res.json(logs)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getPermissions = async (req, res) => {
  try {
    const perms = await prisma.permission.findMany()
    res.json(perms)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const updatePermissions = async (req, res) => {
  try {
    const { permissions } = req.body // [{ role, module, level }]
    await Promise.all(permissions.map(p =>
      prisma.permission.upsert({ where: { role_module: { role: p.role, module: p.module } }, update: { level: p.level }, create: p })
    ))
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
}
