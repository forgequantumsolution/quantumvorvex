import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useUiActions } from '../../store/hooks'

// Label = nav:<id>, description = shell:search.meta.<id> (translated at render).
const PANELS = [
  { id: 'dashboard', icon: '▦' },
  { id: 'rooms', icon: '⊟' },
  { id: 'floorplan', icon: '◫' },
  { id: 'reports', icon: '◈' },
  { id: 'guests', icon: '◎' },
  { id: 'bookings', icon: '◷' },
  { id: 'documents', icon: '◫' },
  { id: 'food', icon: '⊕' },
  { id: 'billing', icon: '◑' },
  { id: 'settings', icon: '◌' },
]

const MOCK_GUESTS = [
  { id: '1', name: 'Rahul Sharma', room: '102', status: 'Active' },
  { id: '2', name: 'Priya Patel', room: '205', status: 'Active' },
  { id: '3', name: 'Ankit Singh', room: '312', status: 'Due' },
  { id: '4', name: 'Sneha Rao', room: '118', status: 'Due' },
]

export default function GlobalSearch() {
  const searchOpen = useAppSelector((s) => s.ui.searchOpen)
  const { setActivePanel, setSearchOpen } = useUiActions()
  const { t } = useTranslation('shell')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  // Search logic — derived at render so the labels follow the current language.
  // Panels match on their translated or English name.
  const panels = PANELS.map((p) => ({
    ...p,
    label: t(`nav:${p.id}`),
    meta: t(`search.meta.${p.id}`),
    en: t(`nav:${p.id}`, { lng: 'en' }),
  }))
  const results = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const panelResults = panels
      .filter(p => [p.label, p.meta, p.en].some((x) => x.toLowerCase().includes(q)))
      .map(p => ({ ...p, resultType: t('search.typePanel') }))
    const guestResults = MOCK_GUESTS
      .filter(g => g.name.toLowerCase().includes(q) || g.room.includes(q))
      .map(g => ({
        id: `guest-${g.id}`, label: g.name, icon: '◎', resultType: t('common:guest'), panelId: 'guests',
        meta: `${t('common:room')} ${g.room} · ${g.status === 'Due' ? t('search.due') : t('common:active')}`,
      }))
    return [...panelResults, ...guestResults].slice(0, 8)
  })()

  const handleSelect = useCallback((item) => {
    setActivePanel(item.panelId || item.id)
    setSearchOpen(false)
    setQuery('')
  }, [setActivePanel, setSearchOpen])

  // Arrow key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) handleSelect(results[selected])
    if (e.key === 'Escape') { setSearchOpen(false); setQuery('') }
  }

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSearchOpen(false)
        setQuery('')
      }
    }
    if (searchOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen, setSearchOpen])

  if (!searchOpen) return null

  return (
    // Phones: a full-screen search page. sm+: the floating command palette.
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[2px] z-[2000] flex items-start justify-center sm:px-4 sm:pt-20">
      <div
        ref={containerRef}
        role="dialog"
        aria-label={t('common:search')}
        className="w-full h-[100dvh] sm:h-auto sm:max-w-[540px] bg-surface sm:border sm:border-line sm:rounded-xl shadow-[var(--shadow-md)] overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0 animate-[qvPop_.14s_ease-out]"
      >
        {/* Input */}
        <div className={`flex items-center gap-2.5 px-4 py-2 sm:py-3 min-h-14 shrink-0 ${results.length ? 'border-b border-line' : 'border-b border-line sm:border-b-0'}`}>
          <span className="t-h3 text-ink3">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            autoFocus
            enterKeyHint="search"
            className="t-h3 flex-1 min-w-0 bg-transparent border-0 p-0 outline-none shadow-none focus:ring-0 text-ink placeholder:text-ink3"
          />
          <kbd
            className="hidden sm:inline px-1.5 py-0.5 rounded bg-surface2 border border-line2 text-[10px] text-ink3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >ESC</kbd>
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setQuery('') }}
            className="sm:hidden bg-transparent border-0 text-gold font-semibold text-[14px] min-h-11 pl-2 cursor-pointer"
          >
            {t('common:cancel')}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="flex-1 sm:flex-none sm:max-h-[320px] overflow-y-auto overscroll-contain">
            {results.map((item, i) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`flex items-center gap-3 px-4 py-3 sm:py-2.5 cursor-pointer transition-all duration-[100ms] ${i === selected ? 'bg-surface2' : 'bg-transparent'}`}
                onMouseEnter={() => setSelected(i)}
              >
                <span className="t-body w-5 text-center text-ink3">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="t-sm text-ink">{item.label}</div>
                  <div className="text-xs text-ink3 mt-px">{item.meta}</div>
                </div>
                <span className="t-label px-[7px] py-0.5 rounded-[10px] bg-[var(--gold-bg)] text-gold shrink-0">{item.resultType}</span>
              </div>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="t-sm px-4 py-5 text-center text-ink3">
            {t('search.noResults', { q: query })}
          </div>
        )}

        {!query && (
          <div className="px-4 py-3">
            <div className="t-label text-ink3 mb-2">{t('quickNavigation')}</div>
            <div className="flex flex-wrap gap-1.5">
              {panels.slice(0, 6).map(p => (
                <button key={p.id} onClick={() => handleSelect(p)} className="t-xs px-3 py-2 sm:px-2.5 sm:py-1 rounded-md border border-line bg-surface2 text-ink2 cursor-pointer transition-all duration-[120ms]"
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
