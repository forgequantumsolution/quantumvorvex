/**
 * Property lifecycle: creating a property with a ready-to-use configuration, and
 * the boot-time guarantee that at least one property (with settings) exists.
 */
import prisma from './prisma.js'
import { runWithProperty, runUnscoped } from './propertyContext.js'
import { bustProperties } from './permissionCache.js'
import logger from './logger.js'

// Hotel (settings) fields carried over when a property is cloned from another.
// Identity fields (name, address, GSTIN, logo, …) are always the new property's own.
const CLONED_SETTINGS = [
  'ownerName', 'gstRate', 'gstType', 'gstApplyOn', 'lateFeeRate', 'gracePeriod',
  'termsAndConditions', 'invoicePrefix', 'invoiceYear', 'invoicePadding', 'placeOfSupply',
  'bankAccountName', 'bankName', 'bankAccountNo', 'bankIfsc',
  'documentsConfig', 'branding', 'preferences', 'appearance',
]

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))
const withoutKeys = (rows, ...keys) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))))

// "Sea View Residency" → "SEAV", then "SEAV-2", "SEAV-3"… until free.
export async function uniquePropertyCode(name) {
  const base = String(name).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'PROP'
  const taken = new Set((await prisma.property.findMany({ select: { code: true } })).map((p) => p.code))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

// Catalog + settings of an existing property, to seed a new one.
async function loadTemplate(propertyId) {
  return runWithProperty(propertyId, async () => {
    const [hotel, roomTypes, foodPlans, amenities] = await Promise.all([
      prisma.hotel.findFirst(),
      prisma.roomType.findMany(),
      prisma.foodPlan.findMany(),
      prisma.amenity.findMany(),
    ])
    return { hotel, roomTypes, foodPlans, amenities }
  })
}

/**
 * Create a property, its settings row and a starter catalog — atomically.
 * With copyFromPropertyId, the room types / food plans / amenities and the
 * tax + invoice configuration are copied from that property.
 */
export async function createProperty({ name, code, address, phone, email, gstin, copyFromPropertyId }) {
  const template = copyFromPropertyId ? await loadTemplate(copyFromPropertyId) : null
  const finalCode = code || (await uniquePropertyCode(name))

  const property = await prisma.$transaction(async (tx) => {
    const created = await tx.property.create({ data: { name, code: finalCode } })

    // Everything below is stamped with the new property's id by the scoped client.
    await runWithProperty(created.id, async () => {
      await tx.hotel.create({
        data: {
          ...(template?.hotel ? pick(template.hotel, CLONED_SETTINGS) : {}),
          name,
          address: address ?? null,
          phone: phone ?? null,
          email: email ?? null,
          gstin: gstin ?? null,
        },
      })

      const roomTypes = template?.roomTypes?.length
        ? withoutKeys(template.roomTypes, 'id', 'propertyId')
        : [{ name: 'Standard' }]
      await tx.roomType.createMany({ data: roomTypes })
      if (template?.foodPlans?.length) await tx.foodPlan.createMany({ data: withoutKeys(template.foodPlans, 'id', 'propertyId') })
      if (template?.amenities?.length) await tx.amenity.createMany({ data: withoutKeys(template.amenities, 'id', 'propertyId') })
    })
    return created
  })

  bustProperties()
  return property
}

/**
 * Boot-time self-heal (idempotent): a fresh database gets a "Main Property", and
 * any property missing its settings row gets one. Runs before RBAC bootstrap.
 */
export async function ensureProperties() {
  try {
    await runUnscoped(async () => {
      if ((await prisma.property.count()) === 0) {
        await createProperty({ name: 'Main Property', code: 'MAIN' })
        logger.info('Property bootstrap: created "Main Property"', { event: 'SYSTEM' })
        return
      }
      const missing = await prisma.property.findMany({ where: { settings: null }, select: { id: true, name: true } })
      for (const p of missing) {
        await runWithProperty(p.id, () => prisma.hotel.create({ data: { name: p.name } }))
        logger.warn('Property bootstrap: created missing settings row', { event: 'SYSTEM', propertyId: p.id })
      }
    })
  } catch (err) {
    logger.error('Property bootstrap failed', { error: err.message, event: 'SYSTEM' })
  }
}
