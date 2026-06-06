import { useEffect } from 'react'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '620px',
  size,
}) {
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
      className="fixed inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[4px] z-[1000] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-[10px] max-h-[90vh] overflow-y-auto shadow-[var(--shadow-md)] w-full"
        style={{
          maxWidth: resolvedMaxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 px-[22px] py-[17px] border-b border-line flex items-center justify-between bg-surface z-[1]">
          <span
            className="t-h3 text-ink"
            style={{
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            className="t-h3 w-[27px] h-[27px] rounded-full bg-surface2 border border-line cursor-pointer flex items-center justify-center text-ink2 transition-all duration-[140ms] shrink-0"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--red-bg)'
              e.currentTarget.style.color = 'var(--red-text)'
              e.currentTarget.style.borderColor = 'var(--red-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text2)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-[22px] py-[14px] border-t border-line flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
