import { appLocale } from '../../../i18n'

export const CATEGORIES = ['general', 'front_desk', 'housekeeping', 'maintenance', 'guest_request', 'purchase', 'accounts', 'it', 'other']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low']
export const ACTIVE = ['open', 'in_progress', 'on_hold']
// Board columns (closed / cancelled stay in the list).
export const BOARD_COLUMNS = ['open', 'in_progress', 'on_hold', 'resolved']

// Suggested time to finish, by priority (hours).
export const SLA_HOURS = { urgent: 4, high: 24, medium: 72, low: 168 }

export const STATUS_TONE = {
  open:        'bg-info-bg text-info-text',
  in_progress: 'bg-gold-bg text-gold',
  on_hold:     'bg-warning-bg text-warning-text',
  resolved:    'bg-violet-bg text-violet-text',
  closed:      'bg-success-bg text-success-text',
  cancelled:   'bg-surface2 text-ink3',
}
export const STATUS_DOT = {
  open: 'bg-info', in_progress: 'bg-gold', on_hold: 'bg-warning', resolved: 'bg-violet', closed: 'bg-success', cancelled: 'bg-line2',
}
export const PRIORITY_TONE = {
  urgent: 'bg-danger text-white',
  high:   'bg-danger-bg text-danger-text',
  medium: 'bg-warning-bg text-warning-text',
  low:    'bg-surface2 text-ink2',
}

// <input type="datetime-local"> value for a date (local time).
export const localInput = (d) => {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}
export const suggestedDue = (priority) => localInput(Date.now() + (SLA_HOURS[priority] || 72) * 3600e3)

export const isOverdue = (t) => !!t.dueAt && ACTIVE.includes(t.status) && new Date(t.dueAt) < new Date()

// 3h · 2d · 45m
export const span = (ms) => {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000))
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`
}

export const formatWhen = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  const today = new Date().toDateString() === date.toDateString()
  return date.toLocaleString(appLocale(), today
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const timeAgo = (d) => {
  const ms = Date.now() - new Date(d)
  return ms < 60000 ? 'now' : span(ms)
}

// Assignee <option>s; the email tells apart two people with the same name.
export function assigneeOptions(assignees, meId, t) {
  const dup = (n) => assignees.filter((a) => a.name === n).length > 1
  return assignees.map((a) => ({
    value: a.id,
    label: `${a.id === meId ? t('form.you', { name: a.name }) : a.name}${dup(a.name) ? ` · ${a.email}` : ''}${a.role ? ` — ${a.role}` : ''}`,
  }))
}
