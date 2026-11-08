import { useTranslation } from 'react-i18next'
import { LuTrash2 } from 'react-icons/lu'
import { StatusBadge } from '../../ui-tw'
import { TICKET_STATUSES } from '../../../data/opsSeed'
import { formatDate } from '../../../utils/format'

const PRIORITY_BAR = {
  Urgent: 'bg-danger',
  High: 'bg-warning',
  Medium: 'bg-info',
  Low: 'bg-line2',
}

/**
 * A single maintenance ticket with an inline status switcher.
 * The switcher is a segmented control sized to its labels so all three
 * statuses fit on one line at 360px; the delete button sits beside it.
 */
export default function TicketCard({ ticket, busy, onStatusChange, onDelete }) {
  const { t } = useTranslation('maintenance')
  return (
    <div className="relative min-w-0 bg-surface border border-line rounded-xl shadow-soft overflow-hidden flex flex-col">
      <span className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_BAR[ticket.priority] || 'bg-line2'}`} />

      <div className="p-4 pl-5 flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-ink">{t('roomNo', { number: ticket.roomNumber || ticket.room })}</span>
              <StatusBadge status={ticket.priority} label={t(`priority.${ticket.priority}`, ticket.priority)} />
            </div>
            <div className="text-xs text-ink3 font-mono mt-0.5 truncate">{ticket.ticketNo} · {t(`category.${ticket.category}`, ticket.category)}</div>
          </div>
          <div className="shrink-0"><StatusBadge status={ticket.status} label={t(`status.${ticket.status}`, ticket.status)} /></div>
        </div>

        <div className="min-w-0">
          <div className="font-medium text-ink text-[15px] break-words">{ticket.title}</div>
          {ticket.description && <p className="text-sm text-ink2 mt-1 leading-snug break-words">{ticket.description}</p>}
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-ink3 mt-auto pt-1">
          <span className="min-w-0 truncate">👤 {ticket.assignedTo || t('unassigned')}</span>
          <span aria-hidden="true">•</span>
          <span>{formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pl-4 py-2.5 border-t border-line bg-surface2">
        <div role="group" aria-label={t('common:status')} className="flex-1 min-w-0 flex gap-1 p-0.5 bg-surface border border-line rounded-lg">
          {TICKET_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-pressed={ticket.status === s}
              onClick={() => onStatusChange(ticket.id, s)}
              className={[
                'flex-auto min-w-0 truncate text-xs px-1.5 py-1.5 pointer-coarse:min-h-10 rounded-md font-medium transition-colors disabled:opacity-50',
                ticket.status === s
                  ? 'bg-gold text-black'
                  : 'text-ink2 hover:text-gold',
              ].join(' ')}
            >
              {t(`status.${s}`, s)}
            </button>
          ))}
        </div>
        {onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(ticket)}
            title={t('deleteTicket')}
            aria-label={t('deleteTicket')}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg transition-colors disabled:opacity-50 bg-danger-bg text-danger-text hover:bg-danger hover:text-white"
          >
            <LuTrash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
