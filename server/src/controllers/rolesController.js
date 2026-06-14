import prisma from '../utils/prisma.js'
import { MODULES, ACCESS_LEVELS, isValidModule, isValidLevel } from '../config/modules.js'
import { bustRole } from '../utils/permissionCache.js'
import { audit } from '../utils/audit.js'

// Shape a Role row into the API form: permissions as a { module: level } map.
function shapeRole(role) {
  return {
    id:          role.id,
    name:        role.name,
    description: role.description,
    isSystem:    role.isSystem,
    isOwner:     role.isOwner,
    userCount:   role._count?.users ?? undefined,
    permissions: Object.fromEntries((role.permissions || []).map((p) => [p.module, p.level])),
  }
}

// Accepts either an array [{module, level}] or a map {module: level}; drops anything
// that isn't a known module / level so bad input can't create junk permission rows.
function sanitizePermissions(permissions) {
  const entries = Array.isArray(permissions)
    ? permissions.map((p) => [p.module, p.level])
    : Object.entries(permissions || {})
  const clean = []
  for (const [module, level] of entries) {
    if (isValidModule(module) && isValidLevel(level)) clean.push({ module, level })
  }
  return clean
}

// GET /api/v1/roles/modules — module catalog for building the permission matrix UI
export const getModules = async (req, res) => {
  res.json({ modules: MODULES, levels: ACCESS_LEVELS })
}

// GET /api/v1/roles
export const getRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: [{ isOwner: 'desc' }, { isSystem: 'desc' }, { createdAt: 'asc' }],
    })
    res.json(roles.map(shapeRole))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/v1/roles  (owner-only — enforced at the route)
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body
    const perms = sanitizePermissions(permissions)
    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        isSystem: false,
        isOwner:  false,
        permissions: { create: perms },
      },
      include: { permissions: true, _count: { select: { users: true } } },
    })
    await audit(req, 'role.create', { entity: 'role', entityId: role.id, detail: role.name })
    res.status(201).json(shapeRole(role))
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A role with that name already exists.' })
    res.status(500).json({ error: e.message })
  }
}

// PUT /api/v1/roles/:id  (owner-only)
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, permissions } = req.body

    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Role not found.' })
    if (existing.isOwner) return res.status(400).json({ error: 'The Owner role cannot be modified.' })

    const data = {}
    if (name !== undefined)        data.name = name
    if (description !== undefined) data.description = description

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.role.update({ where: { id }, data })
      if (permissions !== undefined) {
        const perms = sanitizePermissions(permissions)
        await tx.rolePermission.deleteMany({ where: { roleId: id } })
        if (perms.length) {
          await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, ...p })) })
        }
      }
    })

    bustRole(id)   // permission/role changes take effect on the next request
    await audit(req, 'role.update', { entity: 'role', entityId: id, detail: name || existing.name })

    const updated = await prisma.role.findUnique({
      where: { id },
      include: { permissions: true, _count: { select: { users: true } } },
    })
    res.json(shapeRole(updated))
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A role with that name already exists.' })
    res.status(500).json({ error: e.message })
  }
}

// DELETE /api/v1/roles/:id  (owner-only)
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!role) return res.status(404).json({ error: 'Role not found.' })
    if (role.isSystem) return res.status(400).json({ error: 'System roles cannot be deleted.' })
    if (role._count.users > 0) {
      return res.status(400).json({ error: 'Reassign the users on this role before deleting it.' })
    }
    await prisma.role.delete({ where: { id } })
    bustRole(id)
    await audit(req, 'role.delete', { entity: 'role', entityId: id, detail: role.name })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
