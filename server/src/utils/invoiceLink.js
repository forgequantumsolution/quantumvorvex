/**
 * Signed, unguessable public links to one invoice, for guests who open it from
 * a WhatsApp message without logging in. No DB column: the token carries the
 * invoice id plus an HMAC of it, so it can be verified statelessly.
 *
 *   token = base64url(invoiceId) "." base64url(HMAC-SHA256(invoiceId)[0..18))
 *
 * Secret: INVOICE_LINK_SECRET, falling back to JWT_SECRET. Rotating the secret
 * revokes every link already sent. A soft-deleted invoice stops resolving.
 */
import crypto from 'node:crypto'
import os from 'node:os'

const MAC_BYTES = 18 // 144-bit MAC — comfortably unguessable, still a short URL

const secret = () => {
  const s = process.env.INVOICE_LINK_SECRET || process.env.JWT_SECRET
  if (!s) throw new Error('INVOICE_LINK_SECRET / JWT_SECRET is not set')
  return s
}

// `kind` keeps the two link types apart: a billing-invoice token can't open a
// booking invoice and vice versa.
const mac = (id, kind = 'invoice') =>
  crypto.createHmac('sha256', secret()).update(`${kind}:${id}`).digest().subarray(0, MAC_BYTES)

export const signInvoiceToken = (invoiceId, kind = 'invoice') =>
  `${Buffer.from(String(invoiceId)).toString('base64url')}.${mac(invoiceId, kind).toString('base64url')}`

// Day-booking tax invoices (built from the booking itself, no Invoice row).
export const signBookingToken = (bookingId) => signInvoiceToken(bookingId, 'booking')
export const verifyBookingToken = (token) => verifyInvoiceToken(token, 'booking')

// → the invoice id, or null when the token is malformed or its MAC doesn't match.
export const verifyInvoiceToken = (token, kind = 'invoice') => {
  if (typeof token !== 'string' || token.length > 200) return null
  const [idPart, macPart, extra] = token.split('.')
  if (!idPart || !macPart || extra !== undefined) return null
  const invoiceId = Buffer.from(idPart, 'base64url').toString('utf8')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(invoiceId)) return null
  const given = Buffer.from(macPart, 'base64url')
  const expected = mac(invoiceId, kind)
  if (given.length !== expected.length) return null
  return crypto.timingSafeEqual(given, expected) ? invoiceId : null
}

// This machine's first non-internal IPv4 (the Wi-Fi/LAN address), or null.
const lanIpv4 = () => {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) return a.address
    }
  }
  return null
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
// Addresses only reachable on this machine or the local network.
const isPrivateHost = (h) =>
  LOOPBACK.has(h) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.)/.test(h) || h.endsWith('.local')

// Web address for links we hand out to guests: the property's "public web
// address" setting, else CLIENT_URL (first entry, as the password-reset email
// uses), else the requesting app's origin. A localhost result is swapped for this
// machine's LAN IP (same protocol and port) so a phone on the same Wi-Fi can open
// it. → { origin, isLocal (not reachable from the internet), lan (host swapped) }
export const linkOrigin = (req, hotel) => {
  const configured = hotel?.publicUrl?.trim() || (process.env.CLIENT_URL || '').split(',')[0].trim()
  let origin = (configured || req?.get?.('origin') || 'http://localhost:5173').replace(/\/+$/, '')
  let lan = false
  try {
    const u = new URL(origin)
    const ip = LOOPBACK.has(u.hostname) ? lanIpv4() : null
    if (ip) {
      u.hostname = ip
      origin = u.origin
      lan = true
    }
    return { origin, isLocal: isPrivateHost(u.hostname), lan }
  } catch {
    return { origin, isLocal: false, lan }
  }
}

export const clientOrigin = (req, hotel) => linkOrigin(req, hotel).origin

export const invoiceShareUrl = (req, invoiceId, hotel) =>
  `${clientOrigin(req, hotel)}/invoice?t=${encodeURIComponent(signInvoiceToken(invoiceId))}`
