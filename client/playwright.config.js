/* global process */
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
 *
 * Exception: tests/responsive.spec.js runs against the demo build instead
 * (VITE_MOCK=true — built-in data, auto-login, no backend). It runs once per
 * device project below; every other spec runs on the desktop project only.
 * See the top of that file for the command.
 */
const RESPONSIVE = /responsive\.spec\.js$/

// Phone and tablet projects run the responsive sweep only.
const device = (name, use) => ({ name, testMatch: RESPONSIVE, use })

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
    { name: 'chromium', testIgnore: RESPONSIVE, use: { ...devices['Desktop Chrome'] } },
    // Responsive sweep — phones, tablets (both orientations), laptop, large screen.
    // All on Chromium (the only browser installed); the device presets supply
    // viewport, touch and mobile emulation.
    device('phone-360',        { ...devices['Galaxy S8'] }),
    device('phone-390',        { ...devices['iPhone 13'], browserName: 'chromium' }),
    device('phone-pixel7',     { ...devices['Pixel 7'] }),
    device('tablet-portrait',  { ...devices['iPad Mini'], browserName: 'chromium' }),
    device('tablet-landscape', { ...devices['iPad Mini landscape'], browserName: 'chromium' }),
    device('laptop',           { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }),
    device('desktop-large',    { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } }),
  ],
})
