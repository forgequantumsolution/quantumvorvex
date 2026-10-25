/**
 * Tenant-aware Prisma client.
 *
 * Every operational model belongs to a Property. Inside a property context (see
 * ./propertyContext.js) this client transparently:
 *   - adds `propertyId = <current>` to the where-clause of every read/update/delete
 *     (including findUnique/update/delete by id, so an id from another property
 *     simply isn't found), and
 *   - stamps `propertyId` onto every create / createMany / upsert-create.
 *
 * Child tables without their own column (documents, notes, …) are scoped through
 * their parent relation instead.
 *
 * Controllers keep writing plain `prisma.room.findMany(...)`; isolation between
 * properties cannot be forgotten in a single handler.
 */
import { PrismaClient } from '@prisma/client'
import { getPropertyContext } from './propertyContext.js'
import logger from './logger.js'

// Models with a required propertyId column.
export const PROPERTY_MODELS = new Set([
  'Hotel', 'Room', 'RoomType', 'Guest', 'Booking', 'Invoice', 'Payment', 'Notification',
  'FoodPlan', 'Amenity', 'PricingRule', 'CompetitorRate', 'MessageTemplate',
  'MaintenanceRequest', 'MaintenanceSchedule', 'LinenRecord', 'RoomInspection',
])

// Child models scoped through a parent relation: model → relation field name.
// Their creates are not stamped; the parent FK (already validated through a
// scoped lookup in the controller) ties them to the property.
const PARENT_SCOPED = {
  Document:           'guest',
  BookingDocument:    'booking',
  MaintenanceNote:    'request',
  HousekeepingStatus: 'room',
  Reminder:           'guest',
  GuestCommunication: 'guest',
}

const WHERE_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
])
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn'])

const scopeFilter = (model, propertyId) => {
  if (PROPERTY_MODELS.has(model)) return { propertyId }
  return { [PARENT_SCOPED[model]]: { propertyId } }
}

// AND the scope onto the caller's where. Keeps top-level unique fields in place
// (required by findUnique/update/delete) and never clobbers a caller's own
// relation filter of the same name.
const withScope = (where = {}, filter) => {
  const and = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND]
  return { ...where, AND: [...and, filter] }
}

const stamp = (data, propertyId) =>
  Array.isArray(data) ? data.map((d) => ({ ...d, propertyId })) : { ...data, propertyId }

// A record never moves between properties: drop propertyId (or a property
// relation write) from update payloads, which are often built from req.body.
const unstamp = (data) => {
  if (!data || typeof data !== 'object') return data
  const { propertyId, property, ...rest } = data
  return rest
}

const base = new PrismaClient()

const prisma = base.$extends({
  name: 'property-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const scoped = PROPERTY_MODELS.has(model) || model in PARENT_SCOPED
        if (!scoped) return query(args)

        const ctx = getPropertyContext()
        if (!ctx?.propertyId) {
          // No context at all means request code ran without the property middleware
          // — almost certainly a bug. Background work opts out via runUnscoped().
          if (!ctx?.unscoped) {
            logger.warn('Unscoped query on a property model', { event: 'TENANCY', model, operation })
          }
          return query(args)
        }

        const { propertyId } = ctx
        const next = { ...args }
        if (WHERE_OPS.has(operation)) next.where = withScope(args.where, scopeFilter(model, propertyId))
        if (PROPERTY_MODELS.has(model)) {
          if (CREATE_OPS.has(operation)) next.data = stamp(args.data, propertyId)
          if (operation === 'update' || operation === 'updateMany') next.data = unstamp(args.data)
          if (operation === 'upsert') {
            next.create = stamp(args.create, propertyId)
            next.update = unstamp(args.update)
          }
        }
        return query(next)
      },
    },
  },
})

export default prisma
