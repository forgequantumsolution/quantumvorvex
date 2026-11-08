import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuCheck, LuChevronDown, LuSearch } from 'react-icons/lu'

/**
 * Category dropdown for the expense form: a compact, searchable list grouped by
 * cost group, instead of the browser's full-screen <select>.
 *
 * The list floats (position: fixed) under the button, or above it when there
 * is no room below, so the modal body doesn't have to scroll to show it.
 * Arrow keys move, Enter picks, Escape closes.
 */
export default function CategoryPicker({ groups, value, onChange, error, label, required }) {
  const { t } = useTranslation('expenses')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const searchRef = useRef(null)

  const selected = groups.flatMap((g) => g.items).find((c) => c.id === value)

  // Groups filtered by the search box (matches category or group name).
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .map((g) => {
        const groupLabel = t(`groups.${g.group}`)
        const groupHit = groupLabel.toLowerCase().includes(q)
        return { ...g, label: groupLabel, items: q && !groupHit ? g.items.filter((c) => c.name.toLowerCase().includes(q)) : g.items }
      })
      .filter((g) => g.items.length)
  }, [groups, query, t])
  const flat = shown.flatMap((g) => g.items)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const height = Math.min(340, window.innerHeight - 24)
    const below = window.innerHeight - r.bottom - 8
    const up = below < Math.min(height, 260) && r.top > below
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8)),
      width: Math.max(r.width, 280),
      maxHeight: Math.max(180, Math.min(height, up ? r.top - 12 : below)),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }

  // Follow the button while the modal scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!open) return
    const onMove = (e) => { if (!panelRef.current?.contains(e.target)) place() }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onMove, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', onMove, true) }
  }, [open])

  // Close on a click outside; focus the search box on open.
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the highlighted row in view.
  useEffect(() => {
    panelRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setQuery('')
    place()
    setActive(Math.max(0, groups.flatMap((g) => g.items).findIndex((c) => c.id === value)))
    setOpen(true)
  }
  const pick = (c) => { onChange(c.id); setOpen(false); btnRef.current?.focus() }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btnRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) pick(flat[active]) }
  }

  return (
    <div className="min-w-0">
      <span className="block text-xs font-medium text-ink2 mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={!!error}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openList() } }}
        className={`w-full flex items-center gap-2 bg-surface border rounded-lg px-3 py-2.5 sm:py-2 min-h-11 sm:min-h-[38px] text-left text-base sm:text-sm cursor-pointer
          focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 ${error ? 'border-danger' : open ? 'border-gold ring-2 ring-gold/20' : 'border-line2'}`}
      >
        <span className="flex-1 min-w-0 truncate">
          {selected
            ? <><span className="text-ink">{selected.name}</span><span className="text-ink3 text-xs"> · {t(`groups.${selected.group}`)}</span></>
            : <span className="text-ink3">{t('form.chooseCategory')}</span>}
        </span>
        <LuChevronDown size={16} aria-hidden className={`shrink-0 text-ink3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {error && <span className="block text-[12px] text-danger mt-1">{error}</span>}

      {open && pos && (
        <div
          ref={panelRef}
          onKeyDown={onKey}
          style={{ position: 'fixed', zIndex: 1000, left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          className="flex flex-col bg-surface border border-line rounded-xl shadow-[var(--shadow-md)] overflow-hidden"
        >
          <div className="p-2 border-b border-line">
            <div className="flex items-center gap-2 bg-surface2 rounded-lg px-2.5">
              <LuSearch size={14} className="text-ink3 shrink-0" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                placeholder={t('form.searchCategory')}
                aria-label={t('form.searchCategory')}
                className="flex-1 min-w-0 bg-transparent border-0 py-2 text-base sm:text-sm text-ink placeholder:text-ink3 focus:outline-none"
              />
            </div>
          </div>
          <div role="listbox" aria-label={label} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
            {shown.length === 0 && <p className="px-3 py-4 text-sm text-ink3 text-center">{t('form.noCategory')}</p>}
            {shown.map((g) => (
              <div key={g.group}>
                <div className="sticky top-0 bg-surface px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink3">{g.label}</div>
                {g.items.map((c) => {
                  const i = flat.indexOf(c)
                  const isSel = c.id === value
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      data-active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(c)}
                      className={`w-full flex items-center gap-2 px-3 py-2 min-h-10 sm:min-h-0 text-left text-sm cursor-pointer border-0 ${
                        i === active ? 'bg-surface2' : 'bg-transparent'} ${isSel ? 'text-gold font-semibold' : 'text-ink'}`}
                    >
                      <span className="flex-1 min-w-0 truncate">{c.name}</span>
                      {isSel && <LuCheck size={15} aria-hidden className="shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
