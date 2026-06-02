/**
 * Pill that maps a booking/ticket status or priority to a colour + readable label.
 * Pass `tone` to override the inferred colour.
 */
const TONE_CLASSES = {
  green: 'bg-success-bg text-success-text',
  red: 'bg-danger-bg text-danger-text',
  amber: 'bg-warning-bg text-warning-text',
  blue: 'bg-info-bg text-info-text',
  gold: 'bg-gold-bg text-gold border border-gold-border',
  grey: 'bg-canvas text-ink2 border border-line',
  purple: 'bg-violet-bg text-violet-text',
}

// status / priority value → { tone, label }
const STATUS_MAP = {
  // bookings
  Confirmed: { tone: 'blue', label: 'Confirmed' },
  Pending: { tone: 'amber', label: 'Pending' },
  CheckedIn: { tone: 'green', label: 'Checked In' },
  CheckedOut: { tone: 'grey', label: 'Checked Out' },
  Cancelled: { tone: 'red', label: 'Cancelled' },
  // maintenance tickets
  Open: { tone: 'amber', label: 'Open' },
  'In Progress': { tone: 'blue', label: 'In Progress' },
  Resolved: { tone: 'green', label: 'Resolved' },
  // priorities
  Low: { tone: 'grey', label: 'Low' },
  Medium: { tone: 'blue', label: 'Medium' },
  High: { tone: 'amber', label: 'High' },
  Urgent: { tone: 'red', label: 'Urgent' },
}

export default function StatusBadge({ status, tone, label, dot = true }) {
  const meta = STATUS_MAP[status] || { tone: 'grey', label: status }
  const resolvedTone = tone || meta.tone
  const text = label || meta.label
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap ${
        TONE_CLASSES[resolvedTone] || TONE_CLASSES.grey
      }`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {text}
    </span>
  )
}
