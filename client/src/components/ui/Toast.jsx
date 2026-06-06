import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { removeToast as removeToastAction } from '../../store/slices/toastSlice'

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
  const toasts = useAppSelector((s) => s.toast.toasts)
  const dispatch = useAppDispatch()
  const removeToast = (id) => dispatch(removeToastAction(id))

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end">
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
              <span className="text-[14px] shrink-0">{icon}</span>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="bg-none border-none text-[rgba(255,255,255,0.6)] cursor-pointer text-[15px] pl-1.5 leading-none shrink-0 transition-colors duration-[120ms]"
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
