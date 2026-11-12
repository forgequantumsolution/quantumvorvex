import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSearch, LuMoon, LuSun, LuSettings, LuPower, LuCalendarDays } from 'react-icons/lu'
import { useAppSelector, useUiActions, useAuthActions } from '../../store/hooks'
import { selectActiveProperty } from '../../store/slices/authSlice'
import { canAccess } from '../../utils/permissions'
import PropertySwitcher from './PropertySwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { appLocale, LANGUAGES } from '../../i18n'

function todayLabel() {
  return new Date().toLocaleDateString(appLocale(), { weekday: 'long', month: 'short', day: 'numeric' })
}

function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// Square icon button; .tb-icon grows to 44px on touch screens (index.css).
const iconBtnBase =
  'tb-icon relative border rounded-lg w-10 h-10 md:w-9 md:h-9 flex items-center justify-center ' +
  'cursor-pointer shrink-0 transition-all duration-[140ms]'
const iconBtnClass = `${iconBtnBase} bg-transparent border-line2 text-ink2 hover:border-gold hover:text-gold`

// Close a popover on outside press / ESC.
function useDismiss(ref, open, setOpen) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, setOpen])
}

// Popover panel: a full-width sheet under the topbar on phones, a dropdown
// anchored to its button from sm up.
const popoverClass =
  'fixed left-2 right-2 top-[calc(env(safe-area-inset-top)+60px)] ' +
  'sm:absolute sm:left-auto sm:right-0 sm:top-[46px] ' +
  'bg-surface border border-line rounded-xl shadow-[var(--shadow-md)] z-[1600] overflow-hidden animate-[qvPop_.14s_ease-out]'

export default function Topbar() {
  const hotelName   = useAppSelector((s) => s.hotel.hotelName)
  const hasProperty = useAppSelector((s) => !!selectActiveProperty(s))
  const { setSearchOpen } = useUiActions()
  const { t } = useTranslation('shell')


  return (
    <header
      id="topbar"
      className="shrink-0 bg-surface border-b border-line pt-[env(safe-area-inset-top)]"
    >
      <div className="h-14 md:h-[60px] flex items-center gap-2 md:gap-2.5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] sm:px-4 md:px-[18px]">

        {/* Which property the app is working in (and switching it), plus today's
            date. Page titles and buttons live in the page header bar below
            (PageHeader.jsx), so the topbar only provides orientation. */}
        <div className="tb-left flex-1 min-w-0 flex items-center gap-3">
          <PropertySwitcher />
          {/* No property to show (single-property / demo): brand the phone header instead */}
          {!hasProperty && (
            <div className="md:hidden min-w-0 t-h3 truncate">
              {hotelName}
            </div>
          )}
          {hasProperty && <span className="hidden md:block w-px h-7 bg-line shrink-0" aria-hidden />}
          <div className="tb-date hidden md:flex items-center gap-2 h-8 px-3 rounded-full bg-surface2 text-[12px] text-ink2 font-medium whitespace-nowrap">
            <LuCalendarDays size={14} className="text-gold" aria-hidden />
            {todayLabel()}
          </div>
        </div>

        {/* Search — opens the global Ctrl+K search (full screen on phones). A
            wide search bar from lg, an icon button below. */}
        <button onClick={() => setSearchOpen(true)} title={t('searchShortcut')}
          className="hidden lg:flex items-center gap-2.5 h-9 w-56 xl:w-64 pl-3 pr-1.5 rounded-lg bg-surface2 border border-transparent
                     text-[13px] text-ink3 cursor-pointer transition-colors hover:border-line2 hover:text-ink2">
          <LuSearch size={15} aria-hidden />
          <span className="flex-1 min-w-0 truncate text-left">{t('common:searchApp')}</span>
          <kbd className="h-6 px-1.5 rounded-md border border-line2 bg-surface text-xs leading-[22px] font-mono text-ink3">Ctrl K</kbd>
        </button>
        <button onClick={() => setSearchOpen(true)} className={`${iconBtnClass} lg:hidden`} aria-label={t('common:search')} title={t('searchShortcut')}>
          <LuSearch size={17} />
        </button>

        <LanguageSwitcher />

        {/* Signed-in user — name, theme, settings and sign out. The desktop
            sidebar footer shows the same, so this only appears below xl. */}
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const darkMode    = useAppSelector((s) => s.ui.darkMode)
  const { setActivePanel, toggleDarkMode } = useUiActions()
  const { logout } = useAuthActions()
  const { t, i18n } = useTranslation('shell')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(ref, open, setOpen)

  const userName  = currentUser?.name || 'Admin'
  const roleLabel = currentUser?.roleName || t('user')
  const roleColor = currentUser?.isOwner ? '#c9a84c' : '#4c9ac9'
  const canSettings = canAccess(currentUser, 'settings')

  const itemBase = 'w-full flex items-center gap-3 px-4 min-h-11 bg-transparent border-0 cursor-pointer text-left text-[13.5px] hover:bg-surface2'
  const item = `${itemBase} text-ink2 hover:text-ink`

  return (
    <div ref={ref} className="xl:hidden sm:relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('accountMenu')}
        aria-expanded={open}
        className="tb-icon w-10 h-10 md:w-9 md:h-9 rounded-full border-0 cursor-pointer flex items-center justify-center text-[12px] font-bold text-[#000] shrink-0"
        style={{ background: roleColor }}
      >
        {getInitials(userName)}
      </button>

      {open && (
        <div className={`${popoverClass} sm:w-[260px]`}>
          <div className="px-4 py-3 border-b border-line">
            <div className="t-title truncate">{userName}</div>
            <span
              className="inline-block mt-1 text-xs font-bold tracking-[0.06em] uppercase px-[6px] py-px rounded-[3px]"
              style={{ color: roleColor, background: roleColor + '1a' }}
            >
              {roleLabel}
            </span>
          </div>
          {/* Language — also in the topbar switcher; repeated here so it is easy to find on phones */}
          <div className="px-4 pt-3 pb-1">
            <div className="text-xs font-semibold text-ink3 mb-1.5">{t('common:language')}</div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface2" role="radiogroup" aria-label={t('common:language')}>
              {LANGUAGES.map((l) => {
                const on = i18n.language === l.code
                return (
                  <button key={l.code} type="button" role="radio" aria-checked={on} lang={l.code}
                    onClick={() => i18n.changeLanguage(l.code)}
                    className={`min-h-9 px-1 rounded-md border-0 cursor-pointer text-[13px] truncate ${on ? 'bg-surface text-gold font-bold shadow-[var(--shadow)]' : 'bg-transparent text-ink2 font-medium'}`}>
                    {l.native}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="py-1">
            <button className={item} onClick={() => toggleDarkMode()}>
              {darkMode ? <LuSun size={17} /> : <LuMoon size={17} />}
              {darkMode ? t('common:lightMode') : t('common:darkMode')}
            </button>
            {canSettings && (
              <button className={item} onClick={() => { setOpen(false); setActivePanel('settings') }}>
                <LuSettings size={17} /> {t('common:settings')}
              </button>
            )}
            <button className={`${itemBase} text-danger-text`} onClick={() => { setOpen(false); logout() }}>
              <LuPower size={17} /> {t('common:signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
