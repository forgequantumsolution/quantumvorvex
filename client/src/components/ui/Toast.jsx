import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const toasts = useAppSelector((s) => s.toast.toasts)
  const dispatch = useAppDispatch()
  const removeToast = (id) => dispatch(removeToastAction(id))

  if (!toasts.length) return null

  return (
    // Phones: stacked across the bottom, above the bottom bar. sm+: top-right.
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[9999] flex flex-col gap-2
                 inset-x-3 bottom-[calc(var(--bottom-nav-h)+12px)] items-stretch
                 sm:inset-x-auto sm:bottom-auto sm:top-5 sm:right-5 sm:items-end"
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
              <span className="text-[14px] shrink-0">{icon}</span>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="bg-none border-none text-[rgba(255,255,255,0.6)] cursor-pointer text-[17px] w-8 h-8 -my-1.5 -mr-2 flex items-center justify-center leading-none shrink-0 transition-colors duration-[120ms]"
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')
              }
              aria-label={t('dismiss')}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
