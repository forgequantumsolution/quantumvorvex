/**
 * Standalone RBAC repair — `npm run db:rbac`.
 *
 * Seeds the system roles and links any unassigned users WITHOUT touching demo data.
 * Use this to unlock a deployment where `migrate deploy` ran but `db:seed` didn't.
 */
import prisma from './prisma.js'
import { ensureRbac } from './rbac.js'

ensureRbac()
  .then(() => console.log('✅ RBAC ensured: system roles present, all users have a role, owner guaranteed.'))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
