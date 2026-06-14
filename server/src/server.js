import app from './app.js'
import logger from './utils/logger.js'
import { ensureRbac } from './utils/rbac.js'
import { startCronJobs } from './utils/cron.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' })
  // Self-heal RBAC on every boot: ensure system roles exist, the protected super-admin
  // is present, and every user has a role — so a `migrate deploy` (which doesn't seed)
  // never locks the app out, even on a brand-new database.
  await ensureRbac()
  startCronJobs()
})

export default app
