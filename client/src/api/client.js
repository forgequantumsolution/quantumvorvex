import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// API helpers
export const roomsApi = {
  getAll: (params) => api.get('/rooms', { params }),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
}

export const guestsApi = {
  getAll: (params) => api.get('/guests', { params }),
  create: (data) => api.post('/guests', data),
  getOne: (id) => api.get(`/guests/${id}`),
  update: (id, data) => api.put(`/guests/${id}`, data),
  checkout: (id, data) => api.post(`/guests/${id}/checkout`, data),
}

export const billingApi = {
  getAll: (params) => api.get('/billing', { params }),
  generate: (data) => api.post('/billing/generate', data),
  collect: (id) => api.put(`/billing/${id}/collect`),
  getPdf: (id) => api.get(`/billing/${id}/pdf`, { responseType: 'blob' }),
}

export const bookingsApi = {
  getAll: (params) => api.get('/bookings', { params }),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.put(`/bookings/${id}`, data),
}

export const documentsApi = {
  getAll: () => api.get('/documents'),
  upload: (guestId, formData) => api.post(`/documents/${guestId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verify: (id) => api.put(`/documents/${id}/verify`),
}

export const foodApi = {
  getPlans: () => api.get('/food-plans'),
  getOrders: () => api.get('/food-orders'),
}

export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getRevenue: (params) => api.get('/reports/revenue', { params }),
  getGst: (params) => api.get('/reports/gst', { params }),
  exportCsv: (type, params) => api.get('/reports/export/csv', { params: { type, ...params }, responseType: 'blob' }),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  uploadLogo: (formData) => api.post('/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  dismiss: (id) => api.put(`/notifications/${id}/dismiss`),
  clearAll: () => api.delete('/notifications'),
}

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}
