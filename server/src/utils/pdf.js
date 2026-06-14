/**
 * HTML → PDF rendering via Puppeteer.
 *
 * We skip Puppeteer's bundled-Chromium download (see `.npmrc`) and drive an
 * already-installed Chrome/Chromium instead. The executable is resolved from
 * env first, then common OS locations. A single browser instance is reused
 * across requests and relaunched if it disconnects.
 */
import fs from 'fs'
import puppeteer from 'puppeteer'
import logger from './logger.js'

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const resolveChrome = () => {
  for (const p of CHROME_CANDIDATES) {
    try { if (fs.existsSync(p)) return p } catch { /* ignore */ }
  }
  return undefined   // let Puppeteer try its own resolution as a last resort
}

let browserPromise = null

const launch = () =>
  puppeteer.launch({
    headless: true,
    executablePath: resolveChrome(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

const getBrowser = async () => {
  if (browserPromise) {
    try {
      const b = await browserPromise
      if (b.connected) return b
    } catch { /* fall through and relaunch */ }
  }
  browserPromise = launch()
  return browserPromise
}

/**
 * Render an HTML document to a PDF Buffer (A4). `baseUrl` is injected as a
 * <base> href so the template's relative asset URLs (e.g. `/uploads/logo.png`)
 * resolve against the running server.
 */
export const htmlToPdf = async (html, { baseUrl } = {}) => {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    const content = baseUrl ? html.replace('<head>', `<head><base href="${baseUrl}/">`) : html
    await page.setContent(content, { waitUntil: 'networkidle0' })
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await page.close().catch(() => {})
  }
}

// Best-effort shutdown so the headless Chrome doesn't linger after the server stops.
export const closePdfBrowser = async () => {
  if (!browserPromise) return
  try { (await browserPromise).close() } catch (err) { logger.warn?.('closePdfBrowser failed', { error: err.message }) }
  browserPromise = null
}

export default htmlToPdf
