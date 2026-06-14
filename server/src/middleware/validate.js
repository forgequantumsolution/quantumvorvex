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
    // Tolerate an empty/absent body for endpoints whose fields are all optional
    const result = schema.safeParse(req.body ?? {})
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

  // Forgot password — request a reset link
  forgotPassword: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
  }),

  // Reset password — submit new password with the emailed token
  resetPassword: z.object({
    token:    z.string().min(20, 'Invalid reset token').max(200),
    password: z.string()
                .min(8, 'Password must be at least 8 characters')
                .max(128)
                .regex(/[A-Z]/, 'Must contain an uppercase letter')
                .regex(/[0-9]/, 'Must contain a number'),
  }),

  // Change password (authenticated) — free-form (no strength rules)
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(1, 'New password is required').max(128),
  }),

  // Passwordless OTP — request a code
  requestOtp: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
  }),

  // Passwordless OTP — verify the code
  verifyOtp: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    code:  z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  }),

  // Password is optional — when omitted the server assigns the shared default
  // (Welcome@123). A user is assigned a Role via roleId. The legacy `role` string
  // is still accepted for back-compat but roleId takes precedence.
  createUser: z.object({
    name:     z.string().min(2).max(100).trim(),
    email:    z.string().email().toLowerCase().trim(),
    password: z.string()
                .min(8, 'Password must be at least 8 characters')
                .max(128)
                .regex(/[A-Z]/, 'Must contain uppercase letter')
                .regex(/[0-9]/, 'Must contain a number')
                .optional(),
    roleId:   z.string().cuid('Invalid role').optional().nullable(),
    phone:    z.string().max(20).optional().nullable(),
    status:   z.enum(['active', 'inactive']).default('active'),
  }),

  updateUser: z.object({
    name:     z.string().min(2).max(100).trim().optional(),
    email:    z.string().email().toLowerCase().trim().optional(),
    // Admin password reset: free-form, no strength rules (users harden their own
    // password via the authenticated change-password flow, which still enforces them).
    password: z.string().min(1).max(128).optional(),
    roleId:   z.string().cuid('Invalid role').optional().nullable(),
    phone:    z.string().max(20).optional().nullable(),
    status:   z.enum(['active', 'inactive']).optional(),
  }),

  // Roles (RBAC). Module/level pairs are additionally validated against the central
  // MODULES list in the controller. permissions may be an array or a {module:level} map.
  createRole: z.object({
    name:        z.string().min(2, 'Role name is required').max(50).trim(),
    description: z.string().max(200).optional().nullable(),
    permissions: z.array(z.object({
      module: z.string().min(1).max(40),
      level:  z.enum(['NONE', 'VIEW', 'MANAGE']),
    })).optional(),
  }),

  updateRole: z.object({
    name:        z.string().min(2).max(50).trim().optional(),
    description: z.string().max(200).optional().nullable(),
    permissions: z.array(z.object({
      module: z.string().min(1).max(40),
      level:  z.enum(['NONE', 'VIEW', 'MANAGE']),
    })).optional(),
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

  // Booking — create. The server computes subtotal/tax/total/balance from these inputs.
  createBooking: z.object({
    // Guest
    guestName:    z.string().min(2, 'Guest name is required').max(100).trim(),
    guestPhone:   z.string().max(20).optional().nullable(),
    guestEmail:   z.preprocess(v => (v === '' ? undefined : v),
                    z.string().email('Invalid email').max(120).optional().nullable()),
    guestAddress: z.string().max(300).optional().nullable(),
    nationality:  z.string().max(50).optional().nullable(),
    idType:       z.string().max(200).optional().nullable(),  // may list multiple, e.g. "Aadhaar, PAN"
    idNumber:     z.string().max(50).optional().nullable(),
    adults:       z.coerce.number().int().min(1).max(20).default(1),
    children:     z.coerce.number().int().min(0).max(20).default(0),
    // Room + stay
    roomId:       z.string().cuid('Select a valid room'),
    stayType:     z.enum(['daily', 'monthly']),
    fromDate:     z.string().datetime(),
    toDate:       z.string().datetime().optional().nullable(),
    months:       z.coerce.number().int().min(1).max(36).optional().nullable(),
    // Pricing inputs (server recomputes totals)
    roomRate:     z.coerce.number().min(0).max(1000000).optional(),
    discount:     z.coerce.number().min(0).max(1000000).default(0),
    taxRate:      z.coerce.number().min(0).max(30).optional(),
    extraCharges: z.coerce.number().min(0).max(1000000).default(0),
    advance:      z.coerce.number().min(0).max(1000000).default(0),
    // Meta
    notes:           z.string().max(1000).optional().nullable(),
    specialRequests: z.string().max(1000).optional().nullable(),
    source:          z.enum(['walk_in', 'phone', 'website', 'ota', 'referral', 'corporate']).default('walk_in'),
  }),

  // Booking — general edit (all optional)
  updateBooking: z.object({
    guestName:       z.string().min(2).max(100).trim().optional(),
    guestPhone:      z.string().max(20).optional().nullable(),
    guestEmail:      z.preprocess(v => (v === '' ? undefined : v),
                       z.string().email('Invalid email').max(120).optional().nullable()),
    guestAddress:    z.string().max(300).optional().nullable(),
    nationality:     z.string().max(50).optional().nullable(),
    idType:          z.string().max(200).optional().nullable(),
    idNumber:        z.string().max(50).optional().nullable(),
    adults:          z.coerce.number().int().min(1).max(20).optional(),
    children:        z.coerce.number().int().min(0).max(20).optional(),
    fromDate:        z.string().datetime().optional(),
    toDate:          z.string().datetime().optional().nullable(),
    months:          z.coerce.number().int().min(1).max(36).optional().nullable(),
    roomRate:        z.coerce.number().min(0).max(1000000).optional(),
    discount:        z.coerce.number().min(0).max(1000000).optional(),
    taxRate:         z.coerce.number().min(0).max(30).optional(),
    extraCharges:    z.coerce.number().min(0).max(1000000).optional(),
    advance:         z.coerce.number().min(0).max(1000000).optional(),
    notes:           z.string().max(1000).optional().nullable(),
    specialRequests: z.string().max(1000).optional().nullable(),
    source:          z.enum(['walk_in', 'phone', 'website', 'ota', 'referral', 'corporate']).optional(),
  }),

  // Booking — cancel
  cancelBooking: z.object({
    reason: z.string().max(500).optional().nullable(),
  }),

  // Booking — check-in (optionally completes guest ID details + advance)
  checkInBooking: z.object({
    idType:   z.string().max(200).optional().nullable(),
    idNumber: z.string().max(50).optional().nullable(),
    advance:  z.coerce.number().min(0).max(1000000).optional(),
  }),

  // Booking — check-out (settle balance + final extra charges)
  checkOutBooking: z.object({
    extraCharges:     z.coerce.number().min(0).max(1000000).optional(),
    finalPayment:     z.coerce.number().min(0).max(1000000).optional(),
    paymentMethod:    z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'other']).optional(),
    paymentReference: z.string().max(120).optional(),
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
    roomId:      z.string().cuid('Select a valid room'),
    category:    z.enum(['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Housekeeping', 'Other']).default('Other'),
    title:       z.string().min(2, 'A short title is required').max(120).trim(),
    description: z.string().max(1000).optional().nullable(),
    priority:    z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
    reportedBy:  z.string().max(100).optional().nullable(),
    assignedTo:  z.string().max(100).optional().nullable(),
    photoUrl:    z.string().max(500).optional().nullable(),
  }),

  // Guest-submitted ticket via room QR code (public, unauthenticated).
  // The room is resolved server-side from qrToken; priority/reportedBy/status
  // are never trusted from the client.
  createGuestMaintenanceRequest: z.object({
    qrToken:     z.string().min(8, 'Invalid QR code').max(128),
    category:    z.enum(['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Housekeeping', 'Other']).default('Other'),
    title:       z.string().min(2, 'Please describe the issue').max(120).trim(),
    description: z.string().max(1000).optional().nullable(),
  }),

  updateMaintenanceRequest: z.object({
    category:    z.enum(['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Housekeeping', 'Other']).optional(),
    title:       z.string().min(2).max(120).trim().optional(),
    description: z.string().max(1000).optional().nullable(),
    priority:    z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
    status:      z.enum(['Open', 'In Progress', 'Resolved']).optional(),
    assignedTo:  z.string().max(100).optional().nullable(),
  }),

  addMaintenanceNote: z.object({
    author:  z.string().max(100).optional().nullable(),
    content: z.string().min(1, 'Note cannot be empty').max(1000).trim(),
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
