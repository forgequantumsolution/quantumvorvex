import { useTranslation } from 'react-i18next'
/**
 * Centered empty placeholder for tables/lists with nothing to show.
 * Tighter on phones; `action` (a button) goes full width there.
 */
export default function EmptyState({ icon = '◌', title, message, action }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 sm:py-14 px-4 sm:px-6">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-canvas border border-line flex items-center justify-center text-xl sm:text-2xl text-ink3 mb-3 sm:mb-4">
        {icon}
      </div>
      <h4 className="font-display font-semibold text-ink text-base">{title ?? t('nothingHere')}</h4>
      {message && <p className="text-sm text-ink3 mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4 w-full max-w-xs sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  )
}
