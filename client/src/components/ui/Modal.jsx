import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Dialog used across the modules. Phones (< sm): a bottom sheet — full width,
 * rounded top, up to 92% of the screen tall. From sm up: a centered dialog
 * capped at `maxWidth` (or 800px with size="lg"). Either way the header and
 * footer stay put and only the body scrolls. Closes on ESC or backdrop click.
 *
 * Footer buttons share the row equally on phones and sit right-aligned from sm.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '620px',
  size,
}) {
  const { t } = useTranslation()
  const resolvedMaxWidth = size === 'lg' ? '800px' : maxWidth

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="qv-modal-overlay fixed inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[4px] z-[1000] flex items-end sm:items-center justify-center sm:p-5 animate-[qvFade_.16s_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="qv-modal bg-surface border border-line rounded-t-2xl sm:rounded-[10px] w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-[var(--shadow-md)]
                   animate-[qvSheetIn_.22s_cubic-bezier(.2,.8,.2,1)] sm:animate-[qvDialogIn_.16s_ease-out]"
        style={{
          maxWidth: resolvedMaxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle — phones only, signals the sheet */}
        <div className="qv-sheet-handle sm:hidden flex justify-center pt-2 -mb-1 shrink-0" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-line2" />
        </div>

        {/* Header */}
        <div className="qv-modal-head shrink-0 px-4 sm:px-[22px] py-3 sm:py-[17px] border-b border-line flex items-center justify-between gap-3 bg-surface">
          <span
            className="t-h3 text-ink min-w-0"
            style={{
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            className="text-[18px] leading-none w-9 h-9 sm:w-[27px] sm:h-[27px] rounded-full bg-surface2 border border-line cursor-pointer flex items-center justify-center text-ink2 transition-all duration-[140ms] shrink-0 hover:bg-danger-bg hover:text-danger-text hover:border-danger-bg"
            aria-label={t('close')}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className={`qv-modal-body flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-[22px] pt-4 ${footer ? 'pb-4' : 'pb-[max(16px,env(safe-area-inset-bottom))]'} sm:py-5`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="qv-modal-foot shrink-0 px-4 sm:px-[22px] pt-3 sm:py-[14px] pb-[max(12px,env(safe-area-inset-bottom))] border-t border-line flex flex-wrap justify-end gap-2 bg-surface2
                          [&>*]:flex-1 sm:[&>*]:flex-none [&>.btn]:justify-center">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
