/**
 * Segmented switch between two (or more) layouts of the same list.
 * `options` = [{ id, label, icon }]; controlled by `value` / `onChange(id)`.
 * Icon-only so it costs a toolbar almost nothing — the label rides along as the
 * tooltip and for screen readers.
 */
export default function ViewToggle({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-0.5 bg-surface2 border border-line rounded-lg p-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            title={`${o.label} view`}
            className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-md
                        transition-colors ${active ? 'bg-surface text-ink shadow-soft' : 'text-ink3 hover:text-ink'}`}
          >
            {o.icon}
            <span className="sr-only">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
