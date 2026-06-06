/**
 * Role-based access control for UI panels and features.
 *
 * Roles:
 *   owner   — Full access to everything including user management
 *   manager — Operational access, can view settings but not manage users
 *   staff   — Front-desk only: check-in, rooms, guests, housekeeping, maintenance
 *   admin   — Treated same as owner (legacy)
 */

export const ROLE_LABELS = {
  owner:   'Owner',
  manager: 'Manager',
  staff:   'Staff',
  admin:   'Owner',
}

export const ROLE_COLORS = {
  owner:   '#c9a84c',
  manager: '#4c9ac9',
  staff:   '#6bb56b',
  admin:   '#c9a84c',
}

// Panels each role can access. Panels are added here as their modules are
// wired to the real backend (see docs/FRONTEND_API_PLAN.md).
const FRONT_DESK_PANELS = ['today', 'bookings', 'checkin', 'checkout', 'cancellations', 'maintenance']
const OPERATIONS_PANELS = ['guests', 'rooms', 'housekeeping']
// Owner/manager panels (staff excluded).
const MANAGER_PANELS = ['documents', 'food', 'billing', 'reports', 'settings']
// Owner/admin-only administrative panels.
const ADMIN_PANELS = ['staff']

export const ROLE_PANELS = {
  owner:   [...FRONT_DESK_PANELS, ...OPERATIONS_PANELS, ...MANAGER_PANELS, ...ADMIN_PANELS],
  manager: [...FRONT_DESK_PANELS, ...OPERATIONS_PANELS, ...MANAGER_PANELS],
  staff:   [...FRONT_DESK_PANELS, ...OPERATIONS_PANELS],
  admin:   [...FRONT_DESK_PANELS, ...OPERATIONS_PANELS, ...MANAGER_PANELS, ...ADMIN_PANELS],
}

// Settings tabs each role can see
export const ROLE_SETTINGS_TABS = {
  owner:   ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'pricing', 'notifications', 'appearance', 'branding', 'preferences', 'properties', 'users'],
  manager: ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'notifications', 'appearance', 'preferences'],
  staff:   [],
  admin:   ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'pricing', 'notifications', 'appearance', 'branding', 'preferences', 'properties', 'users'],
}

export function canAccess(role, panel) {
  const allowed = ROLE_PANELS[role] || ROLE_PANELS.staff
  return allowed.includes(panel)
}

export function getAllowedPanels(role) {
  return ROLE_PANELS[role] || ROLE_PANELS.staff
}

export function canAccessSettingsTab(role, tab) {
  const allowed = ROLE_SETTINGS_TABS[role] || []
  return allowed.includes(tab)
}

export function isOwnerOrManager(role) {
  return role === 'owner' || role === 'manager' || role === 'admin'
}
