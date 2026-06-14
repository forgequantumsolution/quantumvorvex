/**
 * Audit log for authorization-sensitive actions (role/user/permission changes,
 * password changes, etc). Best-effort: a logging failure never blocks the request.
 */
import prisma from './prisma.js'
import logger from './logger.js'

export async function audit(req, action, { entity, entityId, detail } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:   req?.user?.userId || null,
        action,
        entity:   entity || null,
        entityId: entityId || null,
        detail:   detail ? String(detail).slice(0, 500) : null,
        ip:       req?.ip || null,
      },
    })
  } catch (e) {
    logger.warn('audit.failed', { error: e.message, action })
  }
}
