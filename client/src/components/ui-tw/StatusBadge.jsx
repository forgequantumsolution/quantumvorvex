import { useTranslation } from 'react-i18next'
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

// status / priority value → { tone, key } — key is the display label in common.json
const STATUS_MAP = {
  // bookings
  Confirmed: { tone: 'blue', key: 'confirmed' },
  Pending: { tone: 'amber', key: 'pending' },
  CheckedIn: { tone: 'green', key: 'checkedIn' },
  CheckedOut: { tone: 'grey', key: 'checkedOut' },
  Cancelled: { tone: 'red', key: 'cancelled' },
  NoShow: { tone: 'red', key: 'noShow' },
  // payment status
  paid: { tone: 'green', key: 'paid' },
  partial: { tone: 'amber', key: 'partial' },
  unpaid: { tone: 'grey', key: 'unpaid' },
  // …and as invoices (and the demo data) spell them
  Paid: { tone: 'green', key: 'paid' },
  Partial: { tone: 'amber', key: 'partial' },
  Unpaid: { tone: 'grey', key: 'unpaid' },
  Overdue: { tone: 'red', key: 'overdue' },
  // maintenance tickets
  Open: { tone: 'amber', key: 'open' },
  'In Progress': { tone: 'blue', key: 'inProgress' },
  Resolved: { tone: 'green', key: 'resolved' },
  // priorities
  Low: { tone: 'grey', key: 'low' },
  Medium: { tone: 'blue', key: 'medium' },
  High: { tone: 'amber', key: 'high' },
  Urgent: { tone: 'red', key: 'urgent' },
}

export default function StatusBadge({ status, tone, label, dot = true }) {
  const { t } = useTranslation()
  const meta = STATUS_MAP[status] || { tone: 'grey' }
  const resolvedTone = tone || meta.tone
  const text = label || (meta.key ? t(meta.key) : status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
        TONE_CLASSES[resolvedTone] || TONE_CLASSES.grey
      }`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {text}
    </span>
  )
}
