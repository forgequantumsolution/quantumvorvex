import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LuChevronsUpDown, LuCheck, LuLayers, LuSettings, LuSearch, LuArchive, LuBuilding2 } from 'react-icons/lu'
import { useAppSelector, useAuthActions, useUiActions } from '../../store/hooks'
import { selectProperties, selectActiveProperty } from '../../store/slices/authSlice'
import { canSeePortfolio } from '../../utils/permissions'

// Round badge with a property's initials ("Sea View Suites" → "SV"), so rows
// line up and properties are easy to tell apart without their codes.
const initials = (name = '') =>
  name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

function NameBadge({ name, active }) {
  return (
    <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold tracking-wide ${
      active ? 'bg-gold text-[#1a1712]' : 'bg-surface2 text-ink2'}`} aria-hidden>
      {initials(name)}
    </span>
  )
}

// The trigger's icon: the current property, or every property combined.
function TriggerIcon({ all }) {
  return (
    <span className="w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center bg-gold-bg text-gold" aria-hidden>
      {all ? <LuLayers size={17} /> : <LuBuilding2 size={17} />}
    </span>
  )
}

function AllBadge({ active }) {
  return (
    <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
      active ? 'bg-gold text-[#1a1712]' : 'bg-surface2 text-ink2'}`} aria-hidden>
      <LuLayers size={15} />
    </span>
  )
}

function Row({ selected, onClick, badge, title, sub, muted }) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-2.5 py-2 min-h-12 rounded-lg border-none cursor-pointer text-left transition-colors ${
          selected ? 'bg-gold-bg' : 'bg-transparent hover:bg-surface2'} ${muted ? 'opacity-70' : ''}`}
      >
        {badge}
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] text-ink truncate ${selected ? 'font-bold' : 'font-medium'}`}>{title}</span>
          <span className="block text-xs text-ink3 truncate">{sub}</span>
        </span>
        {selected && <LuCheck size={16} className="text-gold shrink-0" />}
      </button>
    </li>
  )
}

/**
 * Topbar control showing which property the app is working in, and switching it.
 * "All properties" opens the Portfolio dashboard with every property combined
 * (on the Expenses page it instead shows every property's cash book there);
 * picking one property while on either narrows it to that property.
 * Switching changes the X-Property-Id sent with every request; the active panel
 * remounts (keyed on the property in App.jsx) so it reloads that property's data.
 * With a single property and no owner rights it is a plain label.
 *
 * The list is a dropdown from sm up and a full-width panel over a dimmed page
 * on phones. A filter box appears once there are more than five properties;
 * archived ones are listed last.
 */
export default function PropertySwitcher() {
  const properties  = useAppSelector(selectProperties)
  const active      = useAppSelector(selectActiveProperty)
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const dashboardScope = useAppSelector((s) => s.ui.dashboardScope)
  const expenseScope = useAppSelector((s) => s.ui.expenseScope)
  const { setActiveProperty } = useAuthActions()
  const { setActivePanel, navigateTo, setDashboardScope, setExpenseScope } = useUiActions()
  const { t } = useTranslation('shell')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!active) return null

  const isOwner = !!currentUser?.isOwner
  const canSwitch = properties.length > 1 || isOwner
  const offerAll = canSeePortfolio(currentUser) && properties.length > 1
  // The Expenses page has its own "All properties" view and stays put when it's chosen.
  const onExpenses = activePanel === 'expenses'
  const allSelected = offerAll && (onExpenses ? expenseScope === 'all' : activePanel === 'portfolio' && dashboardScope === 'all')
  const activeCount = properties.filter((p) => p.status === 'active').length

  const name = allSelected ? t('common:allProperties') : active.name
  const sub = allSelected
    ? t('property.activeProperties', { count: activeCount })
    : active.status === 'archived'
      ? `${t('common:archived')} · ${t('property.readOnly')}`
      : [active.roleName, properties.length > 1 && t('property.propertyCount', { count: properties.length })].filter(Boolean).join(' · ')

  const identity = (
    <>
      <TriggerIcon all={allSelected} />
      <span className="min-w-0 text-left">
        <span className="block text-[13px] md:text-[14px] font-bold text-ink truncate max-w-[130px] min-[400px]:max-w-[170px] sm:max-w-[220px] leading-tight">{name}</span>
        <span className="block text-xs text-ink3 truncate max-w-[130px] min-[400px]:max-w-[170px] sm:max-w-[220px] leading-tight mt-0.5">{sub}</span>
      </span>
    </>
  )

  if (!canSwitch) {
    return <div className="flex items-center gap-2.5 min-w-0 max-w-full" title={t('property.current')}>{identity}</div>
  }

  const close = () => { setOpen(false); setFilter('') }

  const choose = (id) => {
    close()
    if (id !== active.id) setActiveProperty(id)
    // On the dashboard (or Expenses), a single property narrows it rather than leaving it.
    if (activePanel === 'portfolio') setDashboardScope('property')
    if (onExpenses) setExpenseScope('property')
  }

  const chooseAll = () => {
    close()
    if (onExpenses && offerAll) { setExpenseScope('all'); return }
    setDashboardScope('all')
    setActivePanel('portfolio')
  }

  const q = filter.trim().toLowerCase()
  const matches = (p) => !q || p.name.toLowerCase().includes(q)
  const live = properties.filter((p) => p.status !== 'archived' && matches(p))
  const archived = properties.filter((p) => p.status === 'archived' && matches(p))
  const propertyRow = (p) => {
    const selected = !allSelected && p.id === active.id
    return (
      <Row key={p.id} selected={selected} onClick={() => choose(p.id)} muted={p.status === 'archived'}
        badge={<NameBadge name={p.name} active={selected} />}
        title={p.name} sub={`${p.roleName}${p.status === 'archived' ? ` · ${t('property.readOnly')}` : ''}`} />
    )
  }

  return (
    <div ref={ref} className="sm:relative min-w-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('common:switchProperty')}
        className={`group flex items-center gap-2.5 min-w-0 max-w-full rounded-xl border-0 pl-1 pr-2 py-1 cursor-pointer transition-colors duration-150 ${
          open ? 'bg-surface2' : 'bg-transparent hover:bg-surface2'}`}
      >
        {identity}
        <LuChevronsUpDown size={15} className={`shrink-0 transition-colors ${open ? 'text-gold' : 'text-ink3 group-hover:text-ink2'}`} />
      </button>

      {open && (
        <>
          {/* Phones: dim the page behind the panel */}
          <div className="sm:hidden fixed inset-0 top-[calc(env(safe-area-inset-top)+var(--topbar-h))] bg-black/30 z-[1590]" onClick={close} aria-hidden />
          <div
            className="fixed left-2 right-2 top-[calc(env(safe-area-inset-top)+var(--topbar-h)+6px)]
                       sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+8px)] sm:w-[340px]
                       bg-surface border border-line rounded-2xl shadow-[var(--shadow-md)] z-[1600] overflow-hidden animate-[qvPop_.14s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <span className="text-[13px] font-bold text-ink">{t('common:switchProperty')}</span>
              <span className="text-xs text-ink3">{t('property.activeCount', { count: activeCount })}{properties.length > activeCount ? ` · ${t('property.archivedCount', { count: properties.length - activeCount })}` : ''}</span>
            </div>

            {properties.length > 5 && (
              <div className="px-3 pb-2">
                <label className="relative flex items-center">
                  <LuSearch size={14} className="absolute left-2.5 text-ink3 pointer-events-none" aria-hidden />
                  <input
                    autoFocus
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('property.find')}
                    aria-label={t('property.find')}
                    className="w-full h-9 pl-8 pr-3 rounded-lg bg-surface2 border border-transparent text-[16px] sm:text-[13px] text-ink placeholder:text-ink3
                               focus:outline-none focus:bg-surface focus:border-gold"
                  />
                </label>
              </div>
            )}

            <ul role="listbox" aria-label={t('common:properties')} className="max-h-[min(360px,55dvh)] overflow-y-auto overscroll-contain list-none m-0 px-1.5 pb-1.5">
              {offerAll && !q && (
                <>
                  <Row selected={allSelected} onClick={chooseAll} badge={<AllBadge active={allSelected} />}
                    title={t('common:allProperties')} sub={`${t('property.combined')} · ${t('property.activeCount', { count: activeCount })}`} />
                  <li className="my-1.5 mx-2 border-t border-line" aria-hidden />
                </>
              )}
              {live.map(propertyRow)}
              {archived.length > 0 && (
                <li className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink3" aria-hidden>
                  <LuArchive size={12} /> {t('common:archived')}
                </li>
              )}
              {archived.map(propertyRow)}
              {!live.length && !archived.length && (
                <li className="px-3 py-6 text-center text-[13px] text-ink3">{t('property.noMatch', { q: filter })}</li>
              )}
            </ul>

            {(isOwner || (!offerAll && canSeePortfolio(currentUser))) && (
              <div className="border-t border-line p-1.5 bg-surface2/60">
                {!offerAll && canSeePortfolio(currentUser) && (
                  <button type="button" onClick={chooseAll}
                    className="w-full flex items-center gap-2.5 px-2.5 min-h-10 rounded-lg bg-transparent border-none cursor-pointer text-[13px] text-ink2 hover:bg-surface hover:text-ink">
                    <LuLayers size={15} className="text-ink3" /> {t('property.portfolioOverview')}
                  </button>
                )}
                {isOwner && (
                  <button type="button" onClick={() => { close(); navigateTo({ panel: 'settings', params: { tab: 'properties' } }) }}
                    className="w-full flex items-center gap-2.5 px-2.5 min-h-10 rounded-lg bg-transparent border-none cursor-pointer text-[13px] text-ink2 hover:bg-surface hover:text-ink">
                    <LuSettings size={15} className="text-ink3" /> {t('common:manageProperties')}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
