import { useToastStore } from '../../store/useStore'

const BORDER_COLORS = {
  success: 'var(--green)',
  danger: 'var(--red)',
  info: 'var(--blue)',
  warning: 'var(--amber)',
  default: 'var(--gold)',
}

const ICONS = {
  success: '✓',
  danger: '✗',
  info: 'ℹ',
  warning: '⚠',
}

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (!toasts.length) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end',
      }}
    >
      {toasts.map((toast) => {
        const borderColor = BORDER_COLORS[toast.type] || BORDER_COLORS.default
        const icon = ICONS[toast.type]

        return (
          <div
            key={toast.id}
            className={`toast-item${toast.type ? ` ${toast.type}` : ''}`}
            style={{ borderLeftColor: borderColor }}
          >
            {icon && (
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
            )}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: '15px',
                padding: '0 0 0 6px',
                lineHeight: 1,
                flexShrink: 0,
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')
              }
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
