import axios from 'axios'
import { getMockResponse } from './mockData.js'

const MOCK = import.meta.env.VITE_MOCK === 'true'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
})

// ── Attach the persisted auth token to every request ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Mock adapter — short-circuits all HTTP when VITE_MOCK=true ────────────────
if (MOCK) {
  api.defaults.adapter = async (config) => {
    const data = await getMockResponse(config.method, config.url)
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
    // A 403 from the RBAC layer means the user's access may have changed (e.g. role
    // edited). Nudge the app to resync the live permission map so the sidebar updates.
    if (err.response?.status === 403 && err.response?.data?.code === 'ERR_FORBIDDEN' && !isAuthCall) {
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
  collect: (id)    => api.put(`/billing/${id}/collect`),
  delete: (id)     => api.delete(`/billing/${id}`),
  getPdf: (id)     => api.get(`/billing/${id}/pdf`, { responseType: 'blob' }),
  getLedger:       (guestId) => api.get('/billing/ledger', { params: { guestId } }),
  getCashRegister: (date)    => api.get('/billing/cash-register', { params: { date } }),
}

export const bookingsApi = {
  getAll:   (params)   => api.get('/bookings', { params }),
  getStats: (params)   => api.get('/bookings/stats', { params }),
  getOne:   (id)       => api.get(`/bookings/${id}`),
  create:   (data)     => api.post('/bookings', data),
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
  // Override the tax-invoice serial number for a booking.
  updateInvoiceNo: (id, invoiceNo) => api.patch(`/bookings/${id}/invoice-no`, { invoiceNo }),
  // Direct URL to open/print the invoice in a new tab.
  invoiceUrl: (id) => `${api.defaults.baseURL}/bookings/${id}/invoice?print=1`,
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
}

export const notificationsApi = {
  getAll:   ()   => api.get('/notifications'),
  dismiss:  (id) => api.put(`/notifications/${id}/dismiss`),
  clearAll: ()   => api.delete('/notifications'),
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
  create: (data)     => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id)       => api.delete(`/users/${id}`),
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
