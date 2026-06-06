/**
 * Centered empty placeholder for tables/lists with nothing to show.
 */
export default function EmptyState({ icon = '◌', title = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-full bg-canvas border border-line flex items-center justify-center text-2xl text-ink3 mb-4">
        {icon}
      </div>
      <h4 className="font-display font-semibold text-ink text-base">{title}</h4>
      {message && <p className="text-sm text-ink3 mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
