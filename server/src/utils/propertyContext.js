/**
 * Request-scoped "current property" (tenant) context.
 *
 * The auth middleware resolves which property a request acts on and runs the rest
 * of the request inside runWithProperty(). The tenant-aware Prisma client
 * (./prisma.js) reads it to scope every query, so controllers never pass
 * propertyId around by hand.
 *
 * Code that runs outside a request (cron, seeds, public QR routes) must say what
 * it wants explicitly:
 *   runWithProperty(id, fn) — act on one property (e.g. a guest QR scan for a room)
 *   runUnscoped(fn)         — deliberately see every property (cron sweeps, the
 *                             owner's cross-property summary, boot-time bootstrap)
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage()

// fn is awaited *inside* the context: Prisma queries are lazy and only execute
// when awaited, so returning the bare promise would run the query outside it.
export const runWithProperty = (propertyId, fn) => {
  if (!propertyId) throw new Error('runWithProperty requires a propertyId')
  return storage.run({ propertyId }, async () => await fn())
}

export const runUnscoped = (fn) => storage.run({ unscoped: true }, async () => await fn())

// For middleware: continue the request chain inside the property context.
export const enterProperty = (propertyId, next) => storage.run({ propertyId }, next)

// undefined → no context at all (a bug in request code; see prisma.js warning)
export const getPropertyContext = () => storage.getStore()
