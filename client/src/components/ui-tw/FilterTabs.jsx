/**
 * Segmented filter tabs. `tabs` = [{ id, label, count? }]; controlled by
 * `active` / `onChange(id)`.
 *
 * `wrap` off keeps the strip on one line — for toolbars that scroll it sideways
 * rather than letting it grow a second row.
 */
export default function FilterTabs({ tabs, active, onChange, wrap = true, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 bg-surface2 border border-line rounded-lg p-1
                     ${wrap ? 'flex-wrap' : 'flex-nowrap'} ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              'whitespace-nowrap',
              isActive
                ? 'bg-surface text-ink shadow-soft'
                : 'text-ink2 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`text-[10.5px] font-mono px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-gold text-black' : 'bg-canvas text-ink3'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
