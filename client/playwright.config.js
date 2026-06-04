import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for Quantum Vorvex client.
 *
 * Assumes the dev stack is already running:
 *   - frontend  http://localhost:5173  (npm run dev:client)
 *   - backend   http://localhost:5000  (npm run dev:server, with Postgres up + seeded)
 *
 * Tests hit the REAL backend (no mock mode). Seed the DB first:
 *   cd server && npm run db:seed
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
