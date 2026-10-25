import { useState, useEffect, useRef } from 'react'
import { LuChevronDown, LuCheck, LuLayers, LuSettings } from 'react-icons/lu'
import { useAppSelector, useAuthActions, useUiActions } from '../../store/hooks'
import { selectProperties, selectActiveProperty } from '../../store/slices/authSlice'
import { canSeePortfolio } from '../../utils/permissions'

// Short property code chip, e.g. "MUM".
function CodeChip({ code, active }) {
  return (
    <span
      className={`text-[10px] font-bold tracking-[0.06em] px-1.5 py-[3px] rounded-[4px] shrink-0 leading-none ${active ? 'bg-gold text-[#000]' : 'bg-surface2 text-ink2 border border-line'}`}
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {code}
    </span>
  )
}

/**
 * Topbar control showing which property the app is working in, and switching it.
 * "All properties" opens the Portfolio dashboard with every property combined;
 * picking one property while on the dashboard narrows it to that property.
 * Switching changes the X-Property-Id sent with every request; the active panel
 * remounts (keyed on the property in App.jsx) so it reloads that property's data.
 * With a single property and no owner rights it is a plain label.
 */
export default function PropertySwitcher() {
  const properties  = useAppSelector(selectProperties)
  const active      = useAppSelector(selectActiveProperty)
  const currentUser = useAppSelector((s) => s.auth.currentUser)
  const activePanel = useAppSelector((s) => s.ui.activePanel)
  const dashboardScope = useAppSelector((s) => s.ui.dashboardScope)
  const { setActiveProperty } = useAuthActions()
  const { setActivePanel, navigateTo, setDashboardScope } = useUiActions()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!active) return null

  const isOwner = !!currentUser?.isOwner
  const canSwitch = properties.length > 1 || isOwner
  const offerAll = canSeePortfolio(currentUser) && properties.length > 1
  const allSelected = offerAll && activePanel === 'portfolio' && dashboardScope === 'all'
  const activeCount = properties.filter((p) => p.status === 'active').length

  const label = allSelected ? (
    <>
      <span className="w-[26px] h-[18px] rounded-[4px] bg-gold text-[#000] flex items-center justify-center shrink-0">
        <LuLayers size={12} aria-hidden />
      </span>
      <span className="min-w-0 text-left overflow-hidden">
        <span className="block text-[13px] font-semibold text-ink truncate max-w-[220px] leading-[1.2]">All properties</span>
        <span className="block text-[10.5px] text-ink3 leading-[1.2] mt-px">{activeCount} active</span>
      </span>
    </>
  ) : (
    <>
      <CodeChip code={active.code} active />
      <span className="min-w-0 text-left overflow-hidden">
        <span className="block text-[13px] font-semibold text-ink truncate max-w-[220px] leading-[1.2]">{active.name}</span>
        <span className="block text-[10.5px] text-ink3 leading-[1.2] mt-px">
          {active.status === 'archived' ? 'Archived · read-only' : active.roleName}
        </span>
      </span>
    </>
  )

  if (!canSwitch) {
    return <div className="flex items-center gap-2 min-w-0 max-w-full" title="Current property">{label}</div>
  }

  const choose = (id) => {
    setOpen(false)
    if (id !== active.id) setActiveProperty(id)
    // On the dashboard, a single property narrows it rather than leaving it.
    if (activePanel === 'portfolio') setDashboardScope('property')
  }

  const chooseAll = () => {
    setOpen(false)
    setDashboardScope('all')
    setActivePanel('portfolio')
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch property"
        className={`flex items-center gap-2 min-w-0 max-w-full bg-transparent border rounded-lg pl-2 pr-1.5 py-1 cursor-pointer transition-all duration-[140ms] ${open ? 'border-gold bg-[var(--gold-bg)]' : 'border-line2 hover:border-gold'}`}
      >
        {label}
        <LuChevronDown size={15} className={`text-ink3 shrink-0 transition-transform duration-[140ms] ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-[46px] left-0 w-[300px] max-w-[calc(100vw-24px)] bg-surface border border-line rounded-[10px] shadow-[var(--shadow-md)] z-[500] overflow-hidden">
          <div className="px-3.5 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.08em] uppercase text-ink3">
            Properties
          </div>
          <ul role="listbox" className="max-h-[320px] overflow-y-auto list-none m-0 p-0 pb-1.5">
            {offerAll && (
              <li className="border-b border-line mb-1 pb-1">
                <button
                  role="option"
                  aria-selected={allSelected}
                  onClick={chooseAll}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 border-none cursor-pointer text-left ${allSelected ? 'bg-surface2' : 'bg-transparent hover:bg-surface2'}`}
                >
                  <span className={`w-[30px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0 ${allSelected ? 'bg-gold text-[#000]' : 'bg-surface2 text-ink2 border border-line'}`}>
                    <LuLayers size={12} aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[12.5px] text-ink truncate ${allSelected ? 'font-bold' : 'font-medium'}`}>All properties</span>
                    <span className="block text-[10.5px] text-ink3">Combined dashboard · {activeCount} active</span>
                  </span>
                  {allSelected && <LuCheck size={15} className="text-gold shrink-0" />}
                </button>
              </li>
            )}
            {properties.map((p) => {
              const selected = !allSelected && p.id === active.id
              return (
                <li key={p.id}>
                  <button
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(p.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 border-none cursor-pointer text-left ${selected ? 'bg-surface2' : 'bg-transparent hover:bg-surface2'}`}
                  >
                    <CodeChip code={p.code} active={selected} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[12.5px] text-ink truncate ${selected ? 'font-bold' : 'font-medium'}`}>{p.name}</span>
                      <span className="block text-[10.5px] text-ink3">
                        {p.roleName}{p.status === 'archived' ? ' · Archived' : ''}
                      </span>
                    </span>
                    {selected && <LuCheck size={15} className="text-gold shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-line py-1.5">
            {!offerAll && canSeePortfolio(currentUser) && (
              <button
                onClick={chooseAll}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 bg-transparent border-none cursor-pointer text-[12.5px] text-ink2 hover:bg-surface2"
              >
                <LuLayers size={15} className="text-ink3" /> Portfolio overview
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => { setOpen(false); navigateTo({ panel: 'settings', params: { tab: 'properties' } }) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 bg-transparent border-none cursor-pointer text-[12.5px] text-ink2 hover:bg-surface2"
              >
                <LuSettings size={15} className="text-ink3" /> Manage properties
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
