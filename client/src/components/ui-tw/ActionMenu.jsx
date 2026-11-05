import { useEffect, useRef, useState } from 'react'
import { LuEllipsisVertical } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

/**
 * Overflow menu for secondary actions — a row's "⋮" or a page header's "More".
 * `items` = [{ label, icon?, onClick, danger?, disabled? } | null | false]; falsy
 * entries are skipped so callers can inline conditions.
 *
 * The list is `position: fixed` and anchored to the trigger so it escapes any
 * overflow-x scroller (tables) that would clip it; it can't follow the trigger,
 * so a scroll or resize closes it. Items are 44px tall on touch screens.
 *
 * Used by the Bookings, Billing, Guests and Housekeeping pages.
 */
export default function ActionMenu({ items, label, disabled = false, className = '', align = 'right' }) {
  const { t } = useTranslation()
  const visible = items.filter(Boolean)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!visible.length) return null

  const toggle = (e) => {
    e.stopPropagation()
    const r = btnRef.current.getBoundingClientRect()
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const h = visible.length * (coarse ? 44 : 36) + 10
    const room = window.innerHeight - r.bottom
    setPos({
      top: room < h + 12 ? Math.max(8, r.top - h - 6) : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 228)),
      right: Math.max(8, window.innerWidth - r.right),
    })
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label={label || t('moreActions')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    ${label ? 'h-9 px-3 pointer-coarse:min-h-11' : 'w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11'}
                    ${open ? 'border-gold text-gold bg-gold-bg' : 'border-line2 text-ink2 bg-surface hover:text-gold hover:border-gold'} ${className}`}
      >
        {label ? <>{label}<span aria-hidden="true" className="text-[10px]">▾</span></> : <LuEllipsisVertical size={15} />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={align === 'left' ? { top: pos.top, left: pos.left } : { top: pos.top, right: pos.right }}
          className="fixed z-[1600] min-w-[200px] max-w-[calc(100vw-16px)] py-1 rounded-xl border border-line bg-surface shadow-lift
                     animate-[actionMenuIn_.12s_ease-out]"
        >
          {visible.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 pointer-coarse:min-h-11 text-[13px] text-left transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed ${
                it.danger ? 'text-danger-text hover:bg-danger-bg' : 'text-ink2 hover:bg-surface2 hover:text-ink'
              }`}
            >
              {it.icon && <span className="w-4 text-ink3 shrink-0 flex justify-center">{it.icon}</span>}
              {it.label}
            </button>
          ))}
          <style>{`@keyframes actionMenuIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }`}</style>
        </div>
      )}
    </>
  )
}
