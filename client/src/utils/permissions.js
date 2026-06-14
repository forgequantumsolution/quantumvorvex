/**
 * Role-based access control for the UI.
 *
 * Permissions are now DATA, resolved by the backend and delivered on the user object
 * (`currentUser.permissions` = { module: 'NONE'|'VIEW'|'MANAGE' }, plus `isOwner`).
 * The frontend mirrors the backend's check so the sidebar and action controls reflect
 * the user's real access. The backend still enforces every request — this is UX only.
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

const LEVEL_RANK = { NONE: 0, VIEW: 1, MANAGE: 2 }

// Each sidebar panel → the backend module that governs it. `today` and `cancellations`
// are UI-only panels that derive from the bookings module.
export const PANEL_MODULE = {
  today:         'bookings',
  bookings:      'bookings',
  cancellations: 'bookings',
  maintenance:   'maintenance',
  guests:        'guests',
  rooms:         'rooms',
  documents:     'documents',
  food:          'food',
  housekeeping:  'housekeeping',
  billing:       'billing',
  reports:       'reports',
  users:         'users',
  settings:      'settings',
}

// Every known panel id (used by the URL router to validate ?panel paths).
export const ALL_PANELS = Object.keys(PANEL_MODULE)

function isOwnerUser(user) {
  return !!(user && (user.isOwner || user.role === 'owner' || user.role === 'admin'))
}

/**
 * hasModule(user, 'billing', 'MANAGE') — does the user meet the required level on a module?
 * Owner roles always pass. `user` is the currentUser object.
 */
export function hasModule(user, module, level = 'VIEW') {
  if (!user) return false
  if (isOwnerUser(user)) return true
  const have = user.permissions?.[module] || 'NONE'
  return (LEVEL_RANK[have] || 0) >= (LEVEL_RANK[level] || 0)
}

/** Can the user open a sidebar panel (needs at least VIEW on its module). */
export function canAccess(user, panel) {
  const module = PANEL_MODULE[panel]
  if (!module) return true // unknown/utility panel — don't hard-block
  return hasModule(user, module, 'VIEW')
}

/** The panels the user may see, in canonical order. */
export function getAllowedPanels(user) {
  return ALL_PANELS.filter((panel) => canAccess(user, panel))
}

// ── Settings sub-tabs ──────────────────────────────────────────────────────────
// The RBAC model is module-level (one `settings` module), so sub-tab visibility is
// derived: owners see everything; anyone else with settings access sees the standard set.
const OWNER_SETTINGS_TABS   = ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'pricing', 'notifications', 'appearance', 'branding', 'preferences', 'properties']
const MANAGER_SETTINGS_TABS = ['profile', 'rooms', 'facilities', 'food', 'tax', 'documents', 'notifications', 'appearance', 'preferences']

export function canAccessSettingsTab(user, tab) {
  if (isOwnerUser(user)) return OWNER_SETTINGS_TABS.includes(tab)
  if (hasModule(user, 'settings', 'VIEW')) return MANAGER_SETTINGS_TABS.includes(tab)
  return false
}
