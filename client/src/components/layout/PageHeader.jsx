import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSearch, LuX } from 'react-icons/lu'
import { useAppSelector } from '../../store/hooks'
import { getEntry } from '../../utils/headerRegistry'
import { PANEL_META, navLabel } from '../../utils/navigation'
import ActionMenu from '../ui-tw/ActionMenu'

/**
 * The page header bar at the top of every page. Pages fill it with
 * usePageHeader (store/hooks.js) through the pageHeader slice; a page that sets
 * nothing still gets its name, icon and section from the navigation.
 *
 *   [icon]  FRONT DESK                 [🔍 Search…  /] [⟳|▦|▤] [Export] [+ New]
 *           Bookings
 *           Reservations, check-ins…
 *
 * Icon-only actions share one segmented toolbar; labelled ones stand alone; the
 * primary action is the gold button at the far right. "/" focuses the search.
 * The bar sticks to the top of #content and gains a shadow once the page
 * scrolls under it.
 *
 * Phones: the title shares a row with Refresh, a "⋮" menu (every other action
 * except the primary) and the primary as a gold icon button; search gets its
 * own row.
 * Secondary buttons show their text from lg when there are one or two of them and no search box,
 * from 2xl when there are more; below that they are icon-only.
 */
const base =
  'relative shrink-0 inline-flex items-center justify-center gap-2 h-9 rounded-lg text-[13px] font-semibold ' +
  'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed pointer-coarse:min-h-11'
const STYLES = {
  primary: 'px-4 bg-gold text-[#1a1712] hover:bg-[var(--gold2)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_rgba(201,168,76,0.35)]',
  primaryIcon: 'w-11 h-11 bg-gold text-[#1a1712] hover:bg-[var(--gold2)] shadow-[0_4px_12px_rgba(201,168,76,0.35)]',
  // Square below 2xl (label hidden), padded once the label shows
  // Square while the label is hidden, padded once it shows: from lg when the
  // page has one or two labelled buttons, from 2xl when it has more.
  secondary: 'w-9 2xl:w-auto 2xl:px-3 pointer-coarse:w-11 bg-surface text-ink2 border border-line2 hover:border-gold hover:text-gold',
  secondaryRoomy: 'w-9 lg:w-auto lg:px-3 pointer-coarse:w-11 bg-surface text-ink2 border border-line2 hover:border-gold hover:text-gold',
}

function Badge({ n }) {
  if (!n) return null
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-[#1a1712] text-xs font-bold leading-[18px] text-center ring-2 ring-surface">
      {n}
    </span>
  )
}

// Handlers are looked up on click, so a page's latest closure runs even when
// its header data (and so this bar) hasn't changed since.
const run = (owner, id) => () => getEntry(owner, id).onClick?.()

function LabelledButton({ owner, a, compact, roomy }) {
  const { icon } = getEntry(owner, a.id)
  if (a.menu) {
    return (
      <ActionMenu
        label={a.label}
        disabled={a.disabled}
        items={a.menu.map((m) => {
          const k = `${a.id}/${m.id}`
          return { label: m.label, icon: getEntry(owner, k).icon, onClick: run(owner, k), danger: m.danger, disabled: m.disabled }
        })}
      />
    )
  }
  const primary = a.variant === 'primary'
  const iconOnlyPrimary = primary && compact && icon
  return (
    <button
      type="button"
      onClick={run(owner, a.id)}
      disabled={a.disabled}
      title={a.label}
      aria-label={a.label}
      className={`${base} ${iconOnlyPrimary ? STYLES.primaryIcon : primary ? STYLES.primary : roomy ? STYLES.secondaryRoomy : STYLES.secondary}`}
    >
      {icon && <span className="text-[16px] flex" aria-hidden>{icon}</span>}
      {iconOnlyPrimary
        ? <span className="sr-only">{a.label}</span>
        : <span className={primary ? '' : roomy ? 'hidden lg:inline' : 'hidden 2xl:inline'}>{a.label}</span>}
      <Badge n={a.badge} />
    </button>
  )
}

// Icon-only actions joined into one segmented control.
function IconToolbar({ owner, items }) {
  if (!items.length) return null
  return (
    <div className="shrink-0 inline-flex items-stretch h-9 pointer-coarse:h-11 rounded-lg border border-line2 bg-surface divide-x divide-line2 overflow-hidden">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={run(owner, a.id)}
          disabled={a.disabled}
          title={a.label}
          aria-label={a.label}
          aria-pressed={a.active || undefined}
          className={`relative w-9 pointer-coarse:w-11 flex items-center justify-center text-[16px] transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed ${
            a.active ? 'bg-gold-bg text-gold' : 'text-ink2 hover:bg-surface2 hover:text-gold'
          }`}
        >
          <span className="flex" aria-hidden>{getEntry(owner, a.id).icon}</span>
          {a.badge > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold ring-2 ring-surface" />}
        </button>
      ))}
    </div>
  )
}

function SearchBox({ owner, search, inputRef, showKey, className = '' }) {
  const { t } = useTranslation('shell')
  const onChange = (v) => getEntry(owner, '__search').onChange?.(v)
  return (
    <label className={`group relative flex items-center ${className}`}>
      <LuSearch size={15} aria-hidden className="absolute left-3 text-ink3 pointer-events-none group-focus-within:text-gold transition-colors" />
      <input
        ref={inputRef}
        type="search"
        value={search.value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); e.currentTarget.blur() } }}
        placeholder={search.placeholder}
        aria-label={search.placeholder}
        className="w-full h-9 pointer-coarse:h-11 pl-9 pr-9 rounded-lg border border-transparent bg-surface2 text-[16px] sm:text-[13px] text-ink
                   placeholder:text-ink3 transition-[border-color,box-shadow,background-color]
                   hover:border-line2 focus:outline-none focus:bg-surface focus:border-gold focus:ring-4 focus:ring-gold/15
                   [&::-webkit-search-cancel-button]:hidden"
      />
      {search.value ? (
        <button type="button" onClick={() => onChange('')} aria-label={t('clearSearch')}
          className="absolute right-1.5 w-7 h-7 flex items-center justify-center rounded-md text-ink3 hover:text-ink hover:bg-line">
          <LuX size={14} />
        </button>
      ) : showKey && (
        <kbd className="absolute right-2 h-5 min-w-5 px-1.5 rounded border border-line2 bg-surface text-xs leading-[18px] text-ink3 font-mono pointer-events-none group-focus-within:hidden">/</kbd>
      )}
    </label>
  )
}

export default function PageHeader() {
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const { owner, title, subtitle, search, actions } = useAppSelector((s) => s.pageHeader)
  const { t } = useTranslation('shell')
  const meta = PANEL_META[activePanel]
  const heading = title || (meta ? navLabel(t, activePanel) : '')
  const PanelIcon = meta?.Icon

  const barRef = useRef(null)
  const searchRef = useRef(null)
  const [stuck, setStuck] = useState(false)

  // Shadow once #content scrolls under the bar.
  useEffect(() => {
    const scroller = document.getElementById('content')
    if (!scroller) return
    const onScroll = () => setStuck(scroller.scrollTop > 4)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [activePanel])

  // "/" jumps to the page search (not while typing somewhere else).
  const hasSearch = !!search
  useEffect(() => {
    if (!hasSearch) return
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      const input = barRef.current?.querySelectorAll('input[type=search]')
      const visible = [...(input || [])].find((el) => el.offsetParent)
      if (visible) { e.preventDefault(); visible.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hasSearch])

  const primary = actions.filter((a) => a.variant === 'primary')
  const iconOnly = actions.filter((a) => a.variant === 'icon' && !a.menu)
  const labelled = actions.filter((a) => a.variant !== 'primary' && !(a.variant === 'icon' && !a.menu))

  // Phones: everything but the primary goes in one "⋮" menu (a dropdown action
  // contributes its items, prefixed by its label).
  // Refresh stays a visible button on phones too; everything else but the
  // primary goes in the ⋮ menu there.
  const phonePinned = iconOnly.filter((a) => a.id === 'refresh')
  const overflow = [...labelled, ...iconOnly.filter((a) => !phonePinned.includes(a))].flatMap((a) => {
    if (a.menu) {
      return a.menu.map((m) => {
        const k = `${a.id}/${m.id}`
        return { label: `${a.label}: ${m.label}`, icon: getEntry(owner, k).icon, onClick: run(owner, k), danger: m.danger, disabled: m.disabled }
      })
    }
    return [{
      label: `${a.label}${a.active ? ' ✓' : ''}${a.badge ? ` (${a.badge})` : ''}`,
      icon: getEntry(owner, a.id).icon, onClick: run(owner, a.id), disabled: a.disabled,
    }]
  })

  if (!heading && !actions.length && !search) return null

  return (
    <div ref={barRef} className={`page-header no-print ${stuck ? 'is-stuck' : ''}`}>
      <div className="flex items-center gap-3 md:gap-4 min-h-9">
        {/* Page identity */}
        {/* One line: icon, title, then the subtitle in grey after a dot. The
            sidebar already shows the section, so the header doesn't repeat it. */}
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          {PanelIcon && (
            <span className="hidden lg:flex w-9 h-9 shrink-0 items-center justify-center rounded-lg bg-gold-bg text-gold" aria-hidden>
              <PanelIcon size={18} />
            </span>
          )}
          <div className="min-w-0 flex items-baseline gap-2">
            <h1 className="font-display font-bold text-[20px] md:text-[21px] leading-tight tracking-[-0.02em] text-ink line-clamp-2 break-words shrink-0 max-w-full">{heading}</h1>
            {subtitle && (
              <p className="hidden lg:block min-w-0 text-[13px] text-ink3 truncate m-0" title={subtitle}>
                <span className="text-line2 mr-2" aria-hidden>·</span>{subtitle}
              </p>
            )}
          </div>
        </div>

        {/* md and up: search, icon toolbar, labelled buttons, primary */}
        {search && <SearchBox owner={owner} search={search} inputRef={searchRef} showKey className="hidden md:flex w-40 lg:w-56 xl:w-72 shrink" />}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <IconToolbar owner={owner} items={iconOnly} />
          {labelled.map((a) => <LabelledButton key={a.id} owner={owner} a={a} compact={false} roomy={labelled.length <= 2 && !search} />)}
          {primary.map((a) => <LabelledButton key={a.id} owner={owner} a={a} compact={false} />)}
        </div>

        {/* Phones: refresh, overflow menu, primary */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {phonePinned.map((a) => (
            <button key={a.id} type="button" onClick={run(owner, a.id)} disabled={a.disabled} title={a.label} aria-label={a.label}
              className="w-11 h-11 shrink-0 rounded-lg border border-line2 bg-surface text-ink2 flex items-center justify-center text-[17px]
                         transition-colors hover:border-gold hover:text-gold disabled:opacity-50">
              <span className={`flex ${a.disabled ? 'animate-spin' : ''}`} aria-hidden>{getEntry(owner, a.id).icon}</span>
            </button>
          ))}
          {overflow.length > 0 && <ActionMenu items={overflow} label={null} className="!w-11 !h-11" />}
          {primary.map((a) => <LabelledButton key={a.id} owner={owner} a={a} compact />)}
        </div>
      </div>

      {search && <SearchBox owner={owner} search={search} className="md:hidden mt-3" />}
    </div>
  )
}
