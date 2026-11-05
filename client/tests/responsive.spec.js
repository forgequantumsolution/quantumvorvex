/**
 * Responsive sweep — every panel at every device size, light and dark.
 *
 * Runs against the DEMO build (built-in data, auto-login, no backend), so start
 * a mock dev server first and point the suite at it:
 *
 *   VITE_MOCK=true npx vite --port 5187 --strictPort          # terminal 1
 *   E2E_BASE_URL=http://localhost:5187 npm run test:e2e -- tests/responsive.spec.js
 *
 * One project per device (playwright.config.js): phone-360, phone-390,
 * phone-pixel7 (412), tablet-portrait (768), tablet-landscape (1024),
 * laptop (1280), desktop-large (1920). Narrow it with --project=phone-390.
 * Dark mode runs on phone-390 and laptop only (DARK_PROJECTS).
 *
 * Each test fails when the page scrolls sideways: the document, or the #content
 * scroller, is wider than the viewport. Content inside an intentional
 * horizontal scroller (overflow-x auto/scroll — tab strips, wide tables) is
 * fine and isn't counted. The failure message lists the elements that stick out.
 *
 * Screenshots: set E2E_SHOTS=<dir> to save a full-page PNG of every panel per
 * project (<dir>/<project>/<panel>[-dark].png).
 */
/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

// Every routable panel (src/utils/permissions.js PANEL_MODULE), plus the
// Settings sub-tabs that carry their own layouts.
const PANELS = [
  'today', 'portfolio', 'bookings', 'cancellations', 'guests', 'rooms',
  'billing', 'housekeeping', 'maintenance', 'documents', 'food', 'reports',
  'users', 'settings',
  'settings?tab=rooms', 'settings?tab=tax', 'settings?tab=invoice',
  'settings?tab=properties',
]

// Modals and sub-views checked on phones and tablets. `open` is the button to
// press; `dialog: false` marks a view that opens inline instead of in a modal.
const MODALS = [
  { name: 'new-booking',      panel: 'bookings',    open: /new booking/i, dialog: false },
  { name: 'check-out',        panel: 'bookings',    open: /^check-out$/i },
  { name: 'collect-rent',     panel: 'bookings',    open: /^collect rent$/i },
  { name: 'add-room',         panel: 'rooms',       open: /add room/i },
  { name: 'generate-invoice', panel: 'billing',     open: /generate invoice/i },
  { name: 'collect-payment',  panel: 'billing',     open: /^collect$/i },
  { name: 'new-ticket',       panel: 'maintenance', open: /new ticket/i },
]

const DARK_PROJECTS = ['phone-390', 'laptop']
const SHOTS = process.env.E2E_SHOTS

// redux-persist's ui slice: only darkMode + sidebarCollapsed persist.
function seed(dark) {
  return `
    try {
      localStorage.setItem('persist:qv-ui', JSON.stringify({
        darkMode: '${dark}',
        sidebarCollapsed: 'false',
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }));
      sessionStorage.setItem('qv_install_dismissed', '1');
    } catch (e) {}
  `
}

// Runs in the page: is anything wider than the viewport, and what sticks out?
function measureOverflow() {
  const vw = document.documentElement.clientWidth
  const content = document.getElementById('content')
  const docOverflow = document.documentElement.scrollWidth > vw + 1
  const contentOverflow = content ? content.scrollWidth > content.clientWidth + 1 : false

  const scrollsX = (el) => {
    const ox = getComputedStyle(el).overflowX
    return ox === 'auto' || ox === 'scroll'
  }
  const offenders = []
  if (docOverflow || contentOverflow) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || r.right <= vw + 1) continue
      let p = el.parentElement
      let contained = false
      while (p && p !== document.body) {
        if (scrollsX(p) && p.id !== 'content') { contained = true; break }
        p = p.parentElement
      }
      if (contained) continue
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : ''
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)
      offenders.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} "${text}"`)
      if (offenders.length >= 8) break
    }
  }
  return { vw, docOverflow, contentOverflow, offenders }
}

async function openPanel(page, panel) {
  await page.goto(`/${panel}`)
  await page.locator('#content').waitFor()
  await page.waitForLoadState('networkidle')
  // Mock API latency (~280ms per call) plus lazy chunks and skeletons.
  await page.waitForTimeout(800)
}

async function expectNoOverflow(page, label) {
  const m = await page.evaluate(measureOverflow)
  expect(
    m.docOverflow || m.contentOverflow,
    `${label} scrolls sideways at ${m.vw}px:\n  ${m.offenders.join('\n  ')}`,
  ).toBe(false)
}

async function shoot(page, testInfo, name, { fullPage = true } = {}) {
  if (!SHOTS) return
  const dir = path.join(SHOTS, testInfo.project.name)
  fs.mkdirSync(dir, { recursive: true })
  // #content is the scroller, so grow the viewport to its height for a full page.
  const vp = page.viewportSize()
  const full = await page.evaluate(() => {
    const c = document.getElementById('content')
    return c ? c.scrollHeight + c.getBoundingClientRect().top + 80 : document.body.scrollHeight
  })
  if (!fullPage) {
    await page.screenshot({ path: path.join(dir, `${name}.png`) })
    return
  }
  if (full > vp.height) await page.setViewportSize({ width: vp.width, height: Math.min(full, 9000) })
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
  await page.setViewportSize(vp)
}

const slug = (panel) => panel.replace(/[?&=]+/g, '-')

for (const dark of [false, true]) {
  test.describe(dark ? 'dark mode' : 'light mode', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(dark && !DARK_PROJECTS.includes(testInfo.project.name), 'dark mode runs on phone-390 and laptop only')
      await page.addInitScript(seed(dark))
    })

    for (const panel of PANELS) {
      test(`${panel} has no horizontal overflow`, async ({ page }, testInfo) => {
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        await openPanel(page, panel)
        if (dark) await expect(page.locator('html')).toHaveClass(/dark/)
        await shoot(page, testInfo, `${slug(panel)}${dark ? '-dark' : ''}`)
        await expectNoOverflow(page, panel)
        expect(errors, 'uncaught page errors').toEqual([])
      })
    }
  })
}

test.describe('modals', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1280, 'modals are checked on phones and tablets')
    await page.addInitScript(seed(false))
  })

  for (const { name, panel, open, dialog = true } of MODALS) {
    test(`${name} fits the screen`, async ({ page }, testInfo) => {
      await openPanel(page, panel)
      // The page button, or the topbar's icon-only primary action on phones.
      await page.getByRole('button', { name: open }).first().click()
      await page.waitForTimeout(500)
      if (dialog) {
        const modal = page.locator('[role="dialog"][aria-modal="true"]').last()
        await modal.waitFor()
        const box = await modal.boundingBox()
        const vw = page.viewportSize().width
        expect(box.x, `${name} starts off-screen`).toBeGreaterThanOrEqual(-1)
        expect(box.x + box.width, `${name} is wider than the screen`).toBeLessThanOrEqual(vw + 1)
      }
      // Modals are shot at the real screen size (a sheet sits at its bottom edge).
      await shoot(page, testInfo, `modal-${name}`, { fullPage: !dialog })
      await expectNoOverflow(page, name)
    })
  }
})
