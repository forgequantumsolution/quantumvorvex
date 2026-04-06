/**
 * Vercel Serverless Function entry point.
 * Imports the Express app (no listen) and exports it as the handler.
 *
 * Vercel routes all /api/* and /health requests here via vercel.json rewrites.
 */
import app from '../server/src/app.js'

// Seed admin user on cold start (only runs when count === 0)
import { seedAdminUser } from '../server/src/controllers/authController.js'
seedAdminUser().catch(() => {})

export default app
