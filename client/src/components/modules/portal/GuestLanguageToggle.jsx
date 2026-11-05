import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../../i18n'

/**
 * Compact English / हिन्दी / मराठी switch for the public guest pages (QR issue
 * report, self check-in portal). Those pages don't show the app topbar, so they
 * carry their own picker. The choice is remembered like the topbar one.
 */
export default function GuestLanguageToggle({ className = '' }) {
  const { t, i18n } = useTranslation('common')
  const current = LANGUAGES.find((l) => l.code === i18n.language)?.code || 'en'

  return (
    <div role="group" aria-label={t('language')}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface border border-line ${className}`}>
      {LANGUAGES.map((l) => {
        const selected = l.code === current
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={selected}
            onClick={() => i18n.changeLanguage(l.code)}
            className={`min-h-9 px-3 rounded-full border-none text-[13px] cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              selected ? 'bg-gold text-black font-semibold' : 'bg-transparent text-ink2 font-medium hover:text-ink'}`}
          >
            {l.native}
          </button>
        )
      })}
    </div>
  )
}
