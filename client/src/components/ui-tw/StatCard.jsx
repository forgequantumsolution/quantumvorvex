/**
 * Compact KPI tile: icon chip, value, label, optional hint/trend line.
 * `tone` colours the icon chip (gold | green | red | amber | blue | grey).
 */
const TONES = {
  gold: 'bg-gold-bg text-gold',
  green: 'bg-success-bg text-success-text',
  red: 'bg-danger-bg text-danger-text',
  amber: 'bg-warning-bg text-warning-text',
  blue: 'bg-info-bg text-info-text',
  grey: 'bg-canvas text-ink2',
}

export default function StatCard({ icon, label, value, hint, tone = 'gold' }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-soft p-4 flex items-start gap-3.5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${TONES[tone] || TONES.gold}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-display font-bold text-2xl text-ink leading-none">{value}</div>
        <div className="text-xs text-ink2 mt-1.5 font-medium">{label}</div>
        {hint && <div className="text-[11px] text-ink3 mt-0.5">{hint}</div>}
      </div>
    </div>
  )
}
