import axios from 'axios'
import { getMockResponse } from './mockData.js'

const MOCK = import.meta.env.VITE_MOCK === 'true'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
})

// ── Attach the persisted auth token + active property to every request ───────
// The server scopes every request to X-Property-Id (falls back to the user's
// first property when absent). The store mirrors the active property into
// localStorage — see store/index.js.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // A call may target another property explicitly (e.g. inviting someone into a
  // property you're not currently in) — don't overwrite that.
  const propertyId = localStorage.getItem('qv_property')
  if (propertyId && !config.headers['X-Property-Id']) config.headers['X-Property-Id'] = propertyId
  return config
})

// For links opened in a new tab (no custom headers possible): ?propertyId=…
const withProperty = (url) => {
  const propertyId = localStorage.getItem('qv_property')
  return propertyId ? `${url}${url.includes('?') ? '&' : '?'}propertyId=${encodeURIComponent(propertyId)}` : url
}

// ── Mock adapter — short-circuits all HTTP when VITE_MOCK=true ────────────────
if (MOCK) {
  api.defaults.adapter = async (config) => {
    const data = await getMockResponse(config.method, config.url, config.params, config.data, config.headers?.['X-Property-Id'])
    return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} }
  }
}

// ── 401 handling ──────────────────────────────────────────────────────────────
// On any 401 (missing / expired / invalid token) clear the stored session and
// notify the store to drop its credentials. The app then re-renders <LoginPage/>.
// We deliberately do NOT use window.location.href — a hard navigation reload-loops
// against the persisted session and causes the page to flicker. Auth endpoints are
// exempt so a wrong password on the login form surfaces as an error, not a wipe.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    const isAuthCall = /\/auth\/(login|me|otp|refresh)/.test(url)
    if (err.response?.status === 401 && !isAuthCall) {
      // For session-specific rejections (logged in elsewhere, or an expired/migrated
      // token), stash the server's reason so <LoginPage/> can explain the logout
      // instead of bouncing silently.
      const code = err.response?.data?.code
      if ((code === 'ERR_SESSION_SUPERSEDED' || code === 'ERR_SESSION_EXPIRED') && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          'qv_logout_reason',
          err.response.data.message || 'Your session has expired. Please sign in again.',
        )
      }
      localStorage.removeItem('qv_token')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }
    // A 403 from the RBAC layer means the user's access may have changed (role edited,
    // removed from / archived property). Nudge the app to resync the live permission
    // map + property list so the sidebar and property switcher update.
    const ACCESS_CODES = ['ERR_FORBIDDEN', 'ERR_PROPERTY_FORBIDDEN', 'ERR_NO_PROPERTY']
    if (err.response?.status === 403 && ACCESS_CODES.includes(err.response?.data?.code) && !isAuthCall) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:forbidden'))
      }
    }
    return Promise.reject(err)
  }
)

export default api

// API helpers
export const roomsApi = {
  getAll: (params) => api.get('/rooms', { params }),
  create: (data)   => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id)     => api.delete(`/rooms/${id}`),
}

export const guestsApi = {
  getAll: (params) => api.get('/guests', { params }),
  getStats: (params) => api.get('/guests/stats', { params }),
  create: (data)   => api.post('/guests', data),
  getOne: (id)     => api.get(`/guests/${id}`),
  update: (id, data) => api.put(`/guests/${id}`, data),
  delete: (id)     => api.delete(`/guests/${id}`),
  checkoutPreview: (id) => api.get(`/guests/${id}/checkout-preview`),
  checkout: (id, data) => api.post(`/guests/${id}/checkout`, data),
  renew:    (id, data) => api.post(`/guests/${id}/renew`, data),       // { months } | { checkOutDate }
  uploadDocuments: (id, form) => api.post(`/guests/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getCommunications: (id)       => api.get(`/guests/${id}/communications`),
  addCommunication:  (id, data) => api.post(`/guests/${id}/communications`, data), // { channel, direction, subject, content }
}

export const billingApi = {
  getAll: (params) => api.get('/billing', { params }),
  getStats: (params) => api.get('/billing/stats', { params }),
  generate: (data) => api.post('/billing/generate', data),
  // Raise PG rent invoices that have fallen due now (a daily job also does this).
  billPgRent: ()   => api.post('/billing/pg-rent'),
  collect: (id)    => api.put(`/billing/${id}/collect`),
  delete: (id)     => api.delete(`/billing/${id}`),
  getPdf: (id)     => api.get(`/billing/${id}/pdf`, { responseType: 'blob' }),
  getLetterhead:   ()        => api.get('/billing/letterhead'),
  getLedger:       (guestId) => api.get('/billing/ledger', { params: { guestId } }),
  getCashRegister: (date)    => api.get('/billing/cash-register', { params: { date } }),
  // Signed no-login link to the invoice for the guest → { url, token }
  shareLink:       (id)      => api.post(`/billing/${id}/share-link`),
}

// Public, no-login endpoints authorised by a signed token (guest-facing links).
export const publicApi = {
  invoice: (token) => api.get(`/public/invoice/${encodeURIComponent(token)}`), // → { invoice, hotel }
}

// Guest pay page (no login). kind 'b' = booking token, 'i' = billing invoice token.
export const payApi = {
  // → { kind, invoiceNo, guestName, total, paid, due, status, hotel: { name, logoUrl, upi, qrImage }, invoiceUrl, pendingClaim }
  get:   (kind, token)       => api.get(`/public/pay/${kind}/${encodeURIComponent(token)}`),
  // "I've paid": { utr, amount, payerName? } → { ok }
  claim: (kind, token, body) => api.post(`/public/pay/${kind}/${encodeURIComponent(token)}/claim`, body),
}

// UPI payments guests reported, for staff to check in their UPI app and confirm.
export const claimsApi = {
  list:    (params)   => api.get('/payment-claims', { params }),             // { status } → { claims, counts: { pending } }
  confirm: (id, data) => api.post(`/payment-claims/${id}/confirm`, data || {}), // { amount? } → { claim, shareUrl }
  reject:  (id, data) => api.post(`/payment-claims/${id}/reject`, data || {}),  // { reason? }
}

// Cash book: money out (expenses) and other money in, with a period summary.
// `propertyId` (optional) targets another property than the active one — the
// all-properties ledger acts on each row's own property.
const atProperty = (propertyId) => (propertyId ? { headers: { 'X-Property-Id': propertyId } } : undefined)
export const expensesApi = {
  list:           (params)   => api.get('/expenses', { params }),   // { from, to, type, status, paidFrom, categoryId, group, search, page, limit, scope: 'all', property }
  summary:        (params)   => api.get('/expenses/summary', { params }), // { from, to }
  get:            (id, propertyId)       => api.get(`/expenses/${id}`, atProperty(propertyId)), // { expense (with property, createdBy), canDelete }
  portfolio:      (params)   => api.get('/expenses/portfolio', { params }), // { from, to, properties: 'id1,id2' } — every property combined
  payees:         (propertyId)           => api.get('/expenses/payees', atProperty(propertyId)),
  create:         (data, propertyId)     => api.post('/expenses', data, atProperty(propertyId)),
  update:         (id, data, propertyId) => api.put(`/expenses/${id}`, data, atProperty(propertyId)),
  pay:            (id, data, propertyId) => api.post(`/expenses/${id}/pay`, data || {}, atProperty(propertyId)), // { date?, paymentMode?, paidFrom? }
  remove:         (id, propertyId)       => api.delete(`/expenses/${id}`, atProperty(propertyId)),
  categories:     (propertyId)           => api.get('/expenses/categories', atProperty(propertyId)),
  createCategory: (data)     => api.post('/expenses/categories', data),     // { name, group, monthlyBudget? }
  updateCategory: (id, data) => api.put(`/expenses/categories/${id}`, data), // { name?, group?, monthlyBudget?, active? }
}

export const bookingsApi = {
  // Guest link to the booking's tax invoice → { data: { url, token } }
  shareLink: (id) => api.get(`/bookings/${id}/share-link`),
  getAll:   (params)   => api.get('/bookings', { params }),
  getStats: (params)   => api.get('/bookings/stats', { params }),
  getOne:   (id)       => api.get(`/bookings/${id}`),
  create:   (data)     => api.post('/bookings', data),
  // PG: several occupants into one room let by bed — one booking per bed.
  createGroup: (data)  => api.post('/bookings/group', data),
  // PG: per-bed free/held status of a room over [from, to) (ISO strings).
  bedAvailability: (params) => api.get('/bookings/bed-availability', { params }),
  // Monthly tenancy: rent account (months billed, due, credit) and collect rent.
  rentAccount: (id)    => api.get(`/bookings/${id}/rent`),
  collectRent: (id, data) => api.post(`/bookings/${id}/collect-rent`, data),
  // After move-out: dues from the deposit, the rest recorded as refunded.
  refund:      (id, data) => api.post(`/bookings/${id}/refund`, data),
  update:   (id, data) => api.put(`/bookings/${id}`, data),
  confirm:  (id)       => api.post(`/bookings/${id}/confirm`),
  checkIn:  (id, data) => api.post(`/bookings/${id}/check-in`, data || {}),
  checkOut: (id, data) => api.post(`/bookings/${id}/check-out`, data || {}),
  cancel:   (id, data) => api.post(`/bookings/${id}/cancel`, data || {}),
  noShow:   (id)       => api.post(`/bookings/${id}/no-show`),
  remove:   (id)       => api.delete(`/bookings/${id}`),
  uploadDocuments: (id, form) => api.post(`/bookings/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Tax invoice for a completed booking. Returns invoice HTML (responseType blob);
  // pass { format: 'json' } for the structured data instead.
  getInvoice: (id, params) => api.get(`/bookings/${id}/invoice`, { params, responseType: 'blob' }),
  // Next auto invoice serial for today (create-form preview; not reserved).
  nextInvoiceNo: () => api.get('/bookings/next-invoice-no'),
  // Returning-guest lookup: details from the most recent stay on this number.
  lookupGuest: (phone) => api.get('/bookings/guest-lookup', { params: { phone } }),
  // Override the tax-invoice serial number for a booking.
  updateInvoiceNo: (id, invoiceNo) => api.patch(`/bookings/${id}/invoice-no`, { invoiceNo }),
  // Direct URL to open/print the invoice in a new tab.
  invoiceUrl: (id) => withProperty(`${api.defaults.baseURL}/bookings/${id}/invoice?print=1`),
}

export const documentsApi = {
  getAll: ()               => api.get('/documents'),
  upload: (guestId, form)  => api.post(`/documents/${guestId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verify: (id)             => api.put(`/documents/${id}/verify`),
  delete: (id)             => api.delete(`/documents/${id}`),
}

export const foodApi = {
  getPlans:   ()         => api.get('/food-plans'),
  getOrders:  ()         => api.get('/food-orders'),
  createPlan: (data)     => api.post('/food-plans', data),
  updatePlan: (id, data) => api.put(`/food-plans/${id}`, data),
  deletePlan: (id)       => api.delete(`/food-plans/${id}`),
}

export const reportsApi = {
  getDashboard: ()          => api.get('/reports/dashboard'),
  getRevenue: (params)      => api.get('/reports/revenue', { params }),
  getGst: (params)          => api.get('/reports/gst', { params }),
  getOccupancy: (params)    => api.get('/reports/occupancy', { params }),
  exportCsv: (type, params) => api.get('/reports/export/csv', { params: { type, ...params }, responseType: 'blob' }),
  exportPdf: (type, params) => api.get('/reports/export/pdf', { params: { type, ...params }, responseType: 'blob' }),
}

export const settingsApi = {
  get:        ()     => api.get('/settings'),
  update:     (data) => api.put('/settings', data),
  uploadLogo: (form) => api.post('/settings/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadStamp: (form) => api.post('/settings/stamp', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // The property's own payment QR image (PhonePe/Paytm/GPay business QR) → { upiQrUrl }
  uploadUpiQr: (file) => {
    const form = new FormData()
    form.append('upiQr', file, file.name || 'upi-qr.png')
    return api.post('/settings/upi-qr', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteUpiQr: () => api.delete('/settings/upi-qr'),
  // Where guest links point → { origin, isLocal, lan }
  linkOrigin:  () => api.get('/settings/link-origin'),
}

export const notificationsApi = {
  getAll:   ()   => api.get('/notifications'),
  dismiss:  (id) => api.put(`/notifications/${id}/dismiss`),
  clearAll: ()   => api.delete('/notifications'),
}

export const visitorsApi = {
  list:        (params)   => api.get('/visitors', { params }),   // { tab: today|inside|pending|expected|all, search, from, to, page, limit } → { visitors, total, counts }
  get:         (id)       => api.get(`/visitors/${id}`),         // { visitor, visits, blocked, canDelete }
  lookup:      (phone)    => api.get('/visitors/lookup', { params: { phone } }), // { visitor (last details), visits, blocked }
  create:      (data)     => api.post('/visitors', data),        // desk entry; { checkIn } or { expectedAt }
  update:      (id, data) => api.put(`/visitors/${id}`, data),
  checkIn:     (id)       => api.post(`/visitors/${id}/check-in`),
  checkOut:    (id)       => api.post(`/visitors/${id}/check-out`),
  reject:      (id, reason) => api.post(`/visitors/${id}/reject`, { reason }),
  block:       (id, reason) => api.post(`/visitors/${id}/block`, { reason }),
  unblock:     (id)       => api.delete(`/visitors/${id}/block`),
  remove:      (id)       => api.delete(`/visitors/${id}`),
  qr:          ()         => api.get('/visitors/qr'),            // { token, autoApprove, propertyName, canAdmin }
  regenerateQr: ()        => api.post('/visitors/qr/regenerate'),
  settings:    (data)     => api.put('/visitors/settings', data), // { autoApprove }
  // Public (no login): the QR form and the visitor's own pass
  publicForm:  (token)    => api.get(`/public/visit/${token}`),
  publicSubmit: (token, data) => api.post(`/public/visit/${token}`, data),
  publicPass:  (passToken) => api.get(`/public/pass/${passToken}`),
  publicCheckOut: (passToken) => api.post(`/public/pass/${passToken}/checkout`),
}

export const maintenanceApi = {
  getAll:    (params)   => api.get('/maintenance', { params }),
  create:    (data)     => api.post('/maintenance', data),
  update:    (id, data) => api.put(`/maintenance/${id}`, data),
  addNote:   (id, data) => api.post(`/maintenance/${id}/notes`, data),
  remove:    (id)       => api.delete(`/maintenance/${id}`),
  schedules:      ()     => api.get('/maintenance/schedule'),
  createSchedule: (data) => api.post('/maintenance/schedule', data),
  // Public guest QR flow (no auth header needed, but harmless if present)
  getPublicRoom: (token) => api.get('/maintenance/public/room', { params: { t: token } }),
  createPublic:  (data)  => api.post('/maintenance/public', data),
}

export const housekeepingApi = {
  getBoard:         ()             => api.get('/housekeeping/board'),
  updateStatus:     (roomId, data) => api.put(`/housekeeping/${roomId}/status`, data),
  getDaily:         ()             => api.get('/housekeeping/daily'),
  getLinen:         ()             => api.get('/housekeeping/linen'),
  markLinen:        (roomId, data) => api.put(`/housekeeping/linen/${roomId}`, data),
  submitInspection: (data)         => api.post('/housekeeping/inspection', data),
}

export const usersApi = {
  getAll: ()         => api.get('/users'),
  create: (data)     => api.post('/users', data),       // assigned to the active property
  // Create an account directly in a given property (owner inviting staff to a branch).
  createIn: (propertyId, data) => api.post('/users', data, { headers: { 'X-Property-Id': propertyId } }),
  update: (id, data) => api.put(`/users/${id}`, data),  // role change applies to the active property
  remove: (id)       => api.delete(`/users/${id}`),     // non-owners: removes from the active property only
  // Owner-only: every property the user can open + their role at each.
  setAccess: (id, access) => api.put(`/users/${id}/access`, { access }), // [{ propertyId, roleId }]
}

export const propertiesApi = {
  getAll:     ()         => api.get('/properties'),           // properties the caller can open
  // portfolio stats per property + totals; params { forecast: 7|14|30, trend: '7'|'30'|'90'|'month' }
  summary:    (params)   => api.get('/properties/summary', { params }),
  create:     (data)     => api.post('/properties', data),    // { name, code?, address?, phone?, email?, gstin?, copyFromPropertyId? }
  update:     (id, data) => api.put(`/properties/${id}`, data), // { name?, code?, status: 'active'|'archived' }
  getMembers: (id)       => api.get(`/properties/${id}/members`),
  // Give a person access to a property with a role there, or change that role.
  setMember:    (id, userId, roleId) => api.put(`/properties/${id}/members/${userId}`, { roleId }),
  removeMember: (id, userId)         => api.delete(`/properties/${id}/members/${userId}`),
}

export const rolesApi = {
  getAll:     ()         => api.get('/roles'),
  getModules: ()         => api.get('/roles/modules'),
  create:     (data)     => api.post('/roles', data),       // { name, description, permissions: [{module, level}] }
  update:     (id, data) => api.put(`/roles/${id}`, data),
  remove:     (id)       => api.delete(`/roles/${id}`),
}

export const pricingApi = {
  getRules:  ()      => api.get('/pricing/rules'),
  saveRules: (rules) => api.put('/pricing/rules', { rules }),
  compute:   (data)  => api.post('/pricing/compute', data),
  getCompetitors:    ()         => api.get('/pricing/competitors'),
  createCompetitor:  (data)     => api.post('/pricing/competitors', data),     // { name, roomType, theirRate }
  updateCompetitor:  (id, data) => api.put(`/pricing/competitors/${id}`, data),
  deleteCompetitor:  (id)       => api.delete(`/pricing/competitors/${id}`),
}

export const remindersApi = {
  send:           (data)     => api.post('/reminders/send', data),
  getTemplates:   ()         => api.get('/reminders/templates'),
  createTemplate: (data)     => api.post('/reminders/templates', data),  // { trigger, content, active }
  updateTemplate: (id, data) => api.put(`/reminders/templates/${id}`, data),
}

export const authApi = {
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  me:             ()     => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  requestOtp:     (data) => api.post('/auth/otp/request', data),
  verifyOtp:      (data) => api.post('/auth/otp/verify', data),
}
