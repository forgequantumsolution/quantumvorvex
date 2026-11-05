import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Tailwind dialog with a dimmed backdrop. Closes on ESC or backdrop click.
 * `size`: sm | md | lg | xl. Provide `footer` for a sticky action row.
 *
 * Phones (< sm): a bottom sheet — full width, rounded top, up to 92% of the
 * screen tall, footer buttons sharing the row. From sm up: a centered dialog.
 * The header and footer never scroll; only the body does.
 */
const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }

export default function Modal({ isOpen, onClose, title, subtitle, size = 'md', footer, children }) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="qv-modal-overlay fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-[qvFade_.16s_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`qv-modal w-full ${SIZES[size] || SIZES.md} max-h-[92dvh] sm:max-h-[90vh] flex flex-col bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-lift overflow-hidden
                    animate-[qvSheetIn_.22s_cubic-bezier(.2,.8,.2,1)] sm:animate-[qvDialogIn_.16s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle — phones only, signals the sheet */}
        <div className="qv-sheet-handle sm:hidden flex justify-center pt-2 -mb-1 shrink-0" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-line2" />
        </div>

        <div className="qv-modal-head shrink-0 flex items-start justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-ink text-[17px] sm:text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-ink3 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-ink3 hover:text-ink text-xl leading-none w-10 h-10 sm:w-8 sm:h-8 -mr-1.5 sm:mr-0 rounded-lg hover:bg-canvas flex items-center justify-center shrink-0"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <div className={`qv-modal-body flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pt-4 ${footer ? 'pb-4' : 'pb-[max(16px,env(safe-area-inset-bottom))]'} sm:py-5`}>
          {children}
        </div>

        {footer && (
          <div className="qv-modal-foot shrink-0 flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:py-4 border-t border-line bg-surface2
                          [&>*]:flex-1 sm:[&>*]:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
