import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuLanguages, LuCheck } from 'react-icons/lu'
import { LANGUAGES } from '../../i18n'

/**
 * Topbar language picker: English, हिन्दी, मराठी. The choice is applied at once
 * (every screen re-renders in it) and remembered per browser (see i18n/index.js).
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language')}: ${current.native}`}
        title={t('language')}
        className={`tb-icon h-10 md:h-9 min-w-10 md:min-w-9 px-2 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
          open ? 'bg-gold-bg border-gold text-gold' : 'bg-transparent border-line2 text-ink2 hover:border-gold hover:text-gold'}`}
      >
        <LuLanguages size={17} aria-hidden />
        <span className="hidden sm:inline text-xs font-semibold">{current.code.toUpperCase()}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={t('language')}
          className="absolute right-0 top-[calc(100%+8px)] w-[200px] m-0 p-1.5 list-none bg-surface border border-line rounded-xl shadow-[var(--shadow-md)] z-[1600] animate-[qvPop_.14s_ease-out]">
          {LANGUAGES.map((l) => {
            const selected = l.code === current.code
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  lang={l.code}
                  onClick={() => { i18n.changeLanguage(l.code); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-2.5 min-h-11 rounded-lg border-none cursor-pointer text-left ${selected ? 'bg-gold-bg' : 'bg-transparent hover:bg-surface2'}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[14px] text-ink ${selected ? 'font-bold' : 'font-medium'}`}>{l.native}</span>
                    {l.code !== 'en' && <span className="block text-xs text-ink3">{l.label}</span>}
                  </span>
                  {selected && <LuCheck size={16} className="text-gold shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
