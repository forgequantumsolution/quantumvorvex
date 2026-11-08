import { useTranslation } from 'react-i18next'
/**
 * Search box with a leading icon. Controlled via `value` / `onChange(text)`.
 * Full width on phones (16px text, 44px tall); pass a width class for sm+.
 */
export default function SearchInput({ value, onChange, placeholder, className = '' }) {
  const { t } = useTranslation()
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 text-sm pointer-events-none">⌕</span>
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('searchPlaceholder')}
        aria-label={placeholder ?? t('search')}
        className="w-full bg-surface border border-line2 rounded-lg pl-8 pr-3 py-2.5 sm:py-2 min-h-11 sm:min-h-0 text-base sm:text-sm text-ink
                   placeholder:text-ink3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </div>
  )
}
