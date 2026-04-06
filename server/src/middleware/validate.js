/**
 * Zod-based request validation middleware
 * Usage: router.post('/route', validate(schema), handler)
 */
import { z } from 'zod'
import logger from '../utils/logger.js'

/**
 * Returns Express middleware that validates req.body against a Zod schema.
 * Responds 400 with structured errors on failure.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field:   i.path.join('.'),
        message: i.message,
      }))

      logger.warn('input.validation_failure', {
        endpoint:  req.path,
        method:    req.method,
        errors:    errors.map(e => ({ field: e.field, message: e.message })),
        ip:        req.ip,
        requestId: req.requestId,
        event:     'INPUT',
      })

      return res.status(400).json({
        error:   'Validation failed',
        code:    'ERR_VALIDATION',
        details: errors,
      })
    }
    req.body = result.data   // Use parsed + coerced data
    next()
  }
}

// ─── Shared schemas ────────────────────────────────────────────────────────────

export const schemas = {
  // Auth
  login: z.object({
    email:    z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required').max(128),
  }),

  createUser: z.object({
    name:     z.string().min(2).max(100).trim(),
    email:    z.string().email().toLowerCase().trim(),
    password: z.string()
                .min(8, 'Password must be at least 8 characters')
                .max(128)
                .regex(/[A-Z]/, 'Must contain uppercase letter')
                .regex(/[0-9]/, 'Must contain a number'),
    role:     z.enum(['owner', 'manager', 'staff']).default('staff'),
    phone:    z.string().max(20).optional().nullable(),
    status:   z.enum(['active', 'inactive']).default('active'),
  }),

  updateUser: z.object({
    name:     z.string().min(2).max(100).trim().optional(),
    email:    z.string().email().toLowerCase().trim().optional(),
    password: z.string().min(8).max(128)
                .regex(/[A-Z]/, 'Must contain uppercase letter')
                .regex(/[0-9]/, 'Must contain a number')
                .optional(),
    role:     z.enum(['owner', 'manager', 'staff']).optional(),
    phone:    z.string().max(20).optional().nullable(),
    status:   z.enum(['active', 'inactive']).optional(),
  }),

  // Rooms
  createRoom: z.object({
    number:      z.string().min(1).max(10).trim(),
    typeId:      z.string().cuid('Invalid room type ID'),
    floor:       z.number().int().min(1).max(100),
    status:      z.enum(['available', 'occupied', 'maintenance', 'reserved']).default('available'),
    dailyRate:   z.number().positive().max(100000),
    monthlyRate: z.number().positive().max(3000000),
    propertyId:  z.string().cuid().optional().nullable(),
  }),

  // Guests
  checkIn: z.object({
    name:           z.string().min(2).max(100).trim(),
    phone:          z.string().min(7).max(20).trim(),
    email:          z.string().email().optional().nullable(),
    gender:         z.enum(['Male', 'Female', 'Other']).optional().nullable(),
    dob:            z.string().datetime().optional().nullable(),
    nationality:    z.string().max(50).optional().nullable(),
    idType:         z.string().min(1).max(50),
    idNumber:       z.string().min(1).max(50).trim(),
    stayType:       z.enum(['daily', 'monthly']),
    roomId:         z.string().cuid('Invalid room ID'),
    checkInDate:    z.string().datetime(),
    checkOutDate:   z.string().datetime().optional().nullable(),
    months:         z.number().int().min(1).max(36).optional().nullable(),
    roomRate:       z.number().positive().max(1000000),
    deposit:        z.number().min(0).max(1000000).optional().nullable(),
    occupants:      z.number().int().min(1).max(20).default(1),
    specialRequests:z.string().max(500).optional().nullable(),
    foodPlan:       z.string().max(50).optional().nullable(),
    amenities:      z.string().default('[]'),
    facilities:     z.string().default('[]'),
    source:         z.enum(['walk_in', 'booking', 'online', 'referral', 'corporate']).default('walk_in'),
    whatsappOptIn:  z.boolean().default(true),
    notes:          z.string().max(500).optional().nullable(),
    address:        z.string().max(300).optional().nullable(),
    emergencyName:  z.string().max(100).optional().nullable(),
    emergencyPhone: z.string().max(20).optional().nullable(),
    docId:          z.string().min(1).max(50).trim(),
    tags:           z.string().default('[]'),
  }),

  // Booking
  createBooking: z.object({
    guestName: z.string().min(2).max(100).trim(),
    roomId:    z.string().cuid(),
    stayType:  z.enum(['daily', 'monthly']),
    fromDate:  z.string().datetime(),
    toDate:    z.string().datetime().optional().nullable(),
    months:    z.number().int().min(1).max(36).optional().nullable(),
    amount:    z.number().positive().max(1000000),
    advance:   z.number().min(0).max(1000000).default(0),
    notes:     z.string().max(500).optional().nullable(),
    source:    z.enum(['walk_in', 'booking', 'online', 'referral', 'corporate']).default('walk_in'),
  }),

  // Invoice / Payment
  createInvoice: z.object({
    guestId:    z.string().cuid(),
    period:     z.string().min(1).max(50),
    rent:       z.number().min(0).max(1000000),
    food:       z.number().min(0).max(100000).default(0),
    amenities:  z.number().min(0).max(100000).default(0),
    gstRate:    z.number().min(0).max(30),
    hsnCode:    z.string().max(20).optional().nullable(),
  }),

  collectPayment: z.object({
    guestId:   z.string().cuid(),
    invoiceId: z.string().cuid().optional().nullable(),
    amount:    z.number().positive().max(1000000),
    method:    z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).default('cash'),
    reference: z.string().max(100).optional().nullable(),
    type:      z.enum(['collection', 'deposit', 'refund', 'advance']).default('collection'),
  }),

  // Settings / Hotel
  updateHotel: z.object({
    name:              z.string().min(2).max(100).trim().optional(),
    ownerName:         z.string().max(100).trim().optional(),
    phone:             z.string().max(20).optional().nullable(),
    email:             z.string().email().optional().nullable(),
    gstin:             z.string().max(20).optional().nullable(),
    licenseNo:         z.string().max(50).optional().nullable(),
    address:           z.string().max(300).optional().nullable(),
    gstRate:           z.number().min(0).max(30).optional(),
    gstType:           z.enum(['CGST+SGST', 'IGST']).optional(),
    gstApplyOn:        z.string().max(20).optional(),
    lateFeeRate:       z.number().min(0).max(100).optional(),
    gracePeriod:       z.number().int().min(0).max(30).optional(),
    termsAndConditions:z.string().max(5000).optional().nullable(),
    wifiPassword:      z.string().max(50).optional().nullable(),
  }),

  // Room type
  createRoomType: z.object({
    name:           z.string().min(1).max(50).trim(),
    dailyRate:      z.number().positive().max(100000),
    monthlyRate:    z.number().positive().max(3000000),
    peakDailyRate:  z.number().positive().max(100000),
    peakMonthlyRate:z.number().positive().max(3000000),
    maxOccupancy:   z.number().int().min(1).max(20),
  }),

  // Maintenance
  createMaintenanceRequest: z.object({
    roomId:      z.string().cuid(),
    issueType:   z.string().min(1).max(50),
    description: z.string().min(5).max(1000).trim(),
    priority:    z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
    reportedBy:  z.string().min(1).max(100).trim(),
    assignedTo:  z.string().max(100).optional().nullable(),
  }),

  // Food plan
  createFoodPlan: z.object({
    name:        z.string().min(2).max(100).trim(),
    description: z.string().max(300).optional().nullable(),
    oneTimeRate: z.number().min(0).max(10000),
    weeklyRate:  z.number().min(0).max(50000),
    monthlyRate: z.number().min(0).max(100000),
  }),
}
