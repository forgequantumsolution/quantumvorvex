/**
 * RBAC module registry — the single source of truth for valid permission modules.
 *
 * A "module" is a backend route domain that access is granted on. These keys are
 * stored in RolePermission.module and validated here (the column is a String, not a
 * DB enum, so new panels can be added with a one-line change — no migration).
 *
 * NOTE: `today` and `cancellations` are UI-only sidebar panels (visibility derived in
 * the frontend from reports/bookings) and are intentionally NOT backend modules.
 */

export const MODULES = [
  'bookings',
  'maintenance',
  'guests',
  'rooms',
  'documents',
  'food',
  'housekeeping',
  'billing',
  'reports',
  'settings',
  'users', // Users & Roles management (user CRUD + role management)
]

export const ACCESS_LEVELS = ['NONE', 'VIEW', 'MANAGE']

// Rank for comparisons: a user's level must be >= the level a route requires.
export const LEVEL_RANK = { NONE: 0, VIEW: 1, MANAGE: 2 }

export const isValidModule = (m) => MODULES.includes(m)
export const isValidLevel = (l) => ACCESS_LEVELS.includes(l)
