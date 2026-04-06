import app from './app.js'
import logger from './utils/logger.js'
import { seedAdminUser } from './controllers/authController.js'
import { startCronJobs } from './utils/cron.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' })
  await seedAdminUser()
  startCronJobs()
})

export default app
