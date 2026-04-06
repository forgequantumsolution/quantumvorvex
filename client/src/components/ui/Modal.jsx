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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          maxWidth: resolvedMaxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            padding: '17px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: '27px',
              height: '27px',
              borderRadius: '50%',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              color: 'var(--text2)',
              transition: 'all 0.14s',
              flexShrink: 0,
            }}
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
        <div style={{ padding: '20px 22px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
