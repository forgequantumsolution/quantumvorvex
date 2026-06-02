import { StatusBadge, Button } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { balance, stayLabel } from '../../../utils/booking'

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Arrival card for an expected guest, with a one-click Check-In action. */
export default function ArrivalCard({ booking, isToday, onCheckIn }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-soft p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gold-bg border border-gold-border text-gold flex items-center justify-center font-syne font-bold text-sm shrink-0">
          {initials(booking.guestName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink">{booking.guestName}</span>
            <StatusBadge status={booking.status} />
          </div>
          <div className="text-xs text-ink3 font-mono mt-0.5">{booking.bookingNo}</div>
        </div>
        {isToday && (
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gold bg-gold-bg border border-gold-border rounded-full px-2 py-0.5">
            Today
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm border-t border-line pt-3">
        <Detail label="Room" value={`${booking.room} · ${booking.roomType}`} />
        <Detail label="Guests" value={booking.guests} />
        <Detail label="Arrival" value={formatDate(booking.fromDate)} />
        <Detail label="Stay" value={stayLabel(booking)} />
        <Detail label="Amount" value={formatCurrency(booking.amount)} />
        <Detail
          label="Balance"
          value={balance(booking) > 0 ? formatCurrency(balance(booking)) : 'Paid'}
          highlight={balance(booking) > 0}
        />
      </div>

      {booking.notes && (
        <div className="text-xs text-ink2 bg-surface2 border border-line rounded-lg px-3 py-2">
          📝 {booking.notes}
        </div>
      )}

      <Button className="w-full" icon="↗" onClick={() => onCheckIn(booking)}>
        Check In
      </Button>
    </div>
  )
}

function Detail({ label, value, highlight }) {
  return (
    <div>
      <div className="text-[11px] text-ink3 uppercase tracking-wide">{label}</div>
      <div className={`text-sm ${highlight ? 'text-danger-text font-semibold' : 'text-ink'}`}>{value}</div>
    </div>
  )
}
