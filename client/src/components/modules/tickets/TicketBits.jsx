import { useTranslation } from 'react-i18next'
import { LuClock } from 'react-icons/lu'
import { ACTIVE, PRIORITY_TONE, STATUS_DOT, STATUS_TONE, formatWhen, isOverdue, span } from './ticketUtils'

export function Avatar({ name, size = 28, muted }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={`shrink-0 rounded-full inline-flex items-center justify-center font-bold ${muted ? 'bg-surface2 text-ink3 border border-dashed border-line2' : 'bg-gold-bg text-gold'}`}>
      {muted ? '?' : initials}
    </span>
  )
}

export function StatusPill({ status }) {
  const { t } = useTranslation('tickets')
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATUS_TONE[status]}`}>
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {t(`status.${status}`)}
    </span>
  )
}

export function PriorityPill({ priority }) {
  const { t } = useTranslation('tickets')
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${PRIORITY_TONE[priority]}`}>
      {t(`priority.${priority}`)}
    </span>
  )
}

// Due date with "3h overdue" / "in 5h" underneath.
export function Due({ ticket, compact }) {
  const { t } = useTranslation('tickets')
  if (!ticket.dueAt) return <span className="text-ink3 text-xs">{compact ? '' : t('table.noDue')}</span>
  const overdue = isOverdue(ticket)
  const active = ACTIVE.includes(ticket.status)
  const ms = new Date(ticket.dueAt) - new Date()
  return (
    <span className={`inline-flex ${compact ? 'items-center gap-1' : 'flex-col'} leading-tight whitespace-nowrap`}>
      <span className={`inline-flex items-center gap-1 ${overdue ? 'text-danger-text font-semibold' : 'text-ink'} ${compact ? 'text-xs' : ''}`}>
        {compact && <LuClock size={12} aria-hidden />}{formatWhen(ticket.dueAt)}
      </span>
      {active && !compact && (
        <span className={`text-xs ${overdue ? 'text-danger-text' : ms < 4 * 3600e3 ? 'text-warning-text' : 'text-ink3'}`}>
          {overdue ? t('table.overdueBy', { time: span(ms) }) : t('table.dueIn', { time: span(ms) })}
        </span>
      )}
    </span>
  )
}
