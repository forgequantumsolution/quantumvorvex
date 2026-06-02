import { useEffect } from 'react'

/**
 * Tailwind dialog with a dimmed backdrop. Closes on ESC or backdrop click.
 * `size`: sm | md | lg. Provide `footer` for a sticky action row.
 */
const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

export default function Modal({ isOpen, onClose, title, subtitle, size = 'md', footer, children }) {
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${SIZES[size] || SIZES.md} max-h-[90vh] flex flex-col bg-surface border border-line rounded-2xl shadow-lift overflow-hidden animate-[modalIn_.16s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-line">
          <div>
            <h2 className="font-syne font-bold text-ink text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-ink3 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-ink3 hover:text-ink text-xl leading-none w-8 h-8 rounded-lg hover:bg-canvas flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-surface2">
            {footer}
          </div>
        )}
      </div>

      <style>{`@keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none } }`}</style>
    </div>
  )
}
