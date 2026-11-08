import i18n, { appLocale } from '../i18n'
const MONEY_LOCALE = 'en-IN-u-nu-latn'

// Indian currency formatting (₹X,XX,XXX)
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0'
  const num = Number(amount)
  if (isNaN(num)) return '₹0'
  // Money always uses Indian grouping (₹4,44,000) and 0–9 digits, whatever the
  // language: mr-IN would group it the Western way. Only dates follow appLocale().
  const formatted = new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num)
  return formatted
}

export function formatCurrencyCompact(amount) {
  const num = Number(amount)
  if (isNaN(num)) return '₹0'
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`
  return formatCurrency(num)
}

// Date formatting
export function formatDate(date, opts = {}) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString(appLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleString(appLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return i18n.t('shell:ago.seconds', { count: diff })
  if (diff < 3600) return i18n.t('shell:ago.minutes', { count: Math.floor(diff / 60) })
  if (diff < 86400) return i18n.t('shell:ago.hours', { count: Math.floor(diff / 3600) })
  return i18n.t('shell:ago.days', { count: Math.floor(diff / 86400) })
}

// ID generation
let counter = 1
export function generateDocId(existingIds = []) {
  const maxNum = existingIds
    .map(id => parseInt(id?.replace('DOC-', '') || 0))
    .filter(n => !isNaN(n))
  const max = maxNum.length ? Math.max(...maxNum) : 0
  return `DOC-${String(max + 1).padStart(4, '0')}`
}

export function generateInvoiceNo(existingNos = []) {
  const maxNum = existingNos
    .map(n => parseInt(n?.replace('INV-', '') || 0))
    .filter(n => !isNaN(n))
  const max = maxNum.length ? Math.max(...maxNum) : 0
  return `INV-${String(max + 1).padStart(3, '0')}`
}

export function generateBookingNo() {
  const year = new Date().getFullYear()
  return `BK-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`
}

// Status color helpers
export function statusColor(status) {
  const s = status?.toLowerCase()
  if (s === 'available' || s === 'paid' || s === 'active') return 'badge-green'
  if (s === 'occupied' || s === 'overdue') return 'badge-red'
  if (s === 'maintenance' || s === 'due' || s === 'pending') return 'badge-amber'
  if (s === 'reserved' || s === 'confirmed') return 'badge-blue'
  if (s === 'checked out') return 'badge-grey'
  return 'badge-grey'
}

export function stayTypeColor(type) {
  return type === 'monthly' ? 'badge-purple' : 'badge-blue'
}
