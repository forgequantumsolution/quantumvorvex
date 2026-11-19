import { appLocale } from '../../../i18n'

export const MEMBER_TABS = ['all', 'active', 'expiring', 'expired', 'frozen', 'dues', 'no_plan']
export const GENDERS = ['male', 'female', 'other']
export const GOALS = ['weight_loss', 'muscle_gain', 'fitness', 'strength', 'other']
export const SOURCES = ['walk_in', 'referral', 'online', 'corporate']
export const PAY_MODES = ['cash', 'upi', 'card', 'bank']
export const ID_TYPES = ['aadhaar', 'pan', 'driving_licence', 'passport', 'voter_id', 'other']
// One-tap plan lengths in the plan form.
export const DURATION_PRESETS = [30, 90, 180, 365]

// Member status → pill colours (app tokens). Text label always shown with it.
export const STATUS_TONE = {
  active:   'bg-success-bg text-success-text',
  expiring: 'bg-warning-bg text-warning-text',
  upcoming: 'bg-info-bg text-info-text',
  frozen:   'bg-info-bg text-info-text',
  expired:  'bg-danger-bg text-danger-text',
  no_plan:  'bg-surface2 text-ink2',
  cancelled: 'bg-surface2 text-ink3',
}

export const PHONE_RE = /^\+?\d{10,15}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const cleanPhone = (v) => String(v || '').replace(/[\s-]/g, '')
export const todayInput = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
export const dateInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 10)
}
// Last day of a plan that starts on `start` (yyyy-mm-dd) and runs `days` days.
export const planEnd = (start, days) => {
  if (!start || !days) return null
  const d = new Date(`${start}T00:00`)
  d.setDate(d.getDate() + Number(days) - 1)
  return d
}

/** "1 month", "3 months", "1 year", or "45 days" — from a plan length in days. */
export function durationLabel(t, days) {
  const n = Number(days)
  if (n % 365 === 0) return t('duration.years', { count: n / 365 })
  if (n % 30 === 0) return t('duration.months', { count: n / 30 })
  if (n % 7 === 0) return t('duration.weeks', { count: n / 7 })
  return t('duration.days', { count: n })
}

/** "Ends in 5 days" / "Ends today" / "Expired 3 days ago" for a member row. */
export function daysLeftLabel(t, m) {
  if (m.daysLeft == null) return ''
  if (m.status === 'frozen') return t('left.frozen')
  if (m.status === 'upcoming') return t('left.starts', { date: shortDate(m.current?.startDate) })
  if (m.daysLeft < 0) return t('left.expiredAgo', { count: -m.daysLeft })
  if (m.daysLeft === 0) return t('left.today')
  return t('left.inDays', { count: m.daysLeft })
}

export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const monthLabel = (m) => (m ? new Date(`${m}-01T00:00`).toLocaleDateString(appLocale(), { month: 'short' }) : '')

// ₹1.2L / ₹45K for chart axes and labels.
export function compactMoney(v) {
  const a = Math.abs(Number(v) || 0)
  const f = (x, u) => `₹${x.toFixed(1).replace(/\.0$/, '')}${u}`
  return a >= 1e7 ? f(a / 1e7, 'Cr') : a >= 1e5 ? f(a / 1e5, 'L') : a >= 1e3 ? f(a / 1e3, 'K') : `₹${Math.round(a)}`
}

export const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** First server validation message per field, for the form's `errors`. */
export const fieldErrors = (err) =>
  Object.fromEntries((err.response?.data?.details || []).map((x) => [String(x.field).replace(/^membership\./, ''), x.message]))
