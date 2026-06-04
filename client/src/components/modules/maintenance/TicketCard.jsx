import { StatusBadge } from '../../ui-tw'
import { TICKET_STATUSES } from '../../../data/opsSeed'
import { formatDate } from '../../../utils/format'

const PRIORITY_BAR = {
  Urgent: 'bg-danger',
  High: 'bg-warning',
  Medium: 'bg-info',
  Low: 'bg-line2',
}

/** A single maintenance ticket with an inline status switcher. */
export default function TicketCard({ ticket, busy, onStatusChange }) {
  return (
    <div className="relative bg-surface border border-line rounded-xl shadow-soft overflow-hidden flex flex-col">
      <span className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_BAR[ticket.priority] || 'bg-line2'}`} />

      <div className="p-4 pl-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-ink">Room {ticket.roomNumber || ticket.room}</span>
              <StatusBadge status={ticket.priority} />
            </div>
            <div className="text-xs text-ink3 font-mono mt-0.5">{ticket.ticketNo} · {ticket.category}</div>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        <div>
          <div className="font-medium text-ink text-[15px]">{ticket.title}</div>
          {ticket.description && <p className="text-sm text-ink2 mt-1 leading-snug">{ticket.description}</p>}
        </div>

        <div className="flex items-center gap-3 text-xs text-ink3 mt-auto pt-1">
          <span>👤 {ticket.assignedTo}</span>
          <span>•</span>
          <span>{formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pl-5 py-3 border-t border-line bg-surface2">
        <span className="text-[11px] text-ink3 uppercase tracking-wide mr-1">Status</span>
        {TICKET_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => onStatusChange(ticket.id, s)}
            className={[
              'text-xs px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-50',
              ticket.status === s
                ? 'bg-gold text-black'
                : 'bg-surface border border-line2 text-ink2 hover:border-gold hover:text-gold',
            ].join(' ')}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
