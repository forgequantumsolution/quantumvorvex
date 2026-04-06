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

// Panels each role can access
export const ROLE_PANELS = {
  owner: [
    'dashboard', 'rooms', 'floorplan', 'checkin', 'guests', 'bookings',
    'documents', 'food', 'billing', 'reports', 'settings',
    'maintenance', 'housekeeping', 'staff', 'channels',
  ],
  manager: [
    'dashboard', 'rooms', 'floorplan', 'checkin', 'guests', 'bookings',
    'documents', 'food', 'billing', 'reports', 'settings',
    'maintenance', 'housekeeping', 'channels',
  ],
  staff: [
    'dashboard', 'rooms', 'checkin', 'guests', 'housekeeping', 'maintenance',
  ],
  admin: [
    'dashboard', 'rooms', 'floorplan', 'checkin', 'guests', 'bookings',
    'documents', 'food', 'billing', 'reports', 'settings',
    'maintenance', 'housekeeping', 'staff', 'channels',
  ],
}

// Settings tabs each role can see
export const ROLE_SETTINGS_TABS = {
  owner:   ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'pricing', 'notifications', 'properties', 'users'],
  manager: ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'notifications'],
  staff:   [],
  admin:   ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'pricing', 'notifications', 'properties', 'users'],
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
