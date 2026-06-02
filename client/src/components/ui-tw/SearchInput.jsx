/**
 * Search box with a leading icon. Controlled via `value` / `onChange(text)`.
 */
export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 text-sm pointer-events-none">⌕</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-line2 rounded-lg pl-8 pr-3 py-2 text-sm text-ink
                   placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </div>
  )
}
