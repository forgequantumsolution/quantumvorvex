import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppSelector, useUiActions } from '../../store/hooks'

const PANELS = [
  { id: 'dashboard', label: 'Dashboard', meta: 'Overview & stats', icon: '▦' },
  { id: 'rooms', label: 'Rooms', meta: 'Room inventory management', icon: '⊟' },
  { id: 'floorplan', label: 'Floor Plan', meta: 'Visual layout by floor', icon: '◫' },
  { id: 'reports', label: 'Reports', meta: 'Revenue & occupancy analytics', icon: '◈' },
  { id: 'checkin', label: 'Check-In', meta: 'New guest check-in wizard', icon: '↗' },
  { id: 'guests', label: 'All Guests', meta: 'Guest registry', icon: '◎' },
  { id: 'bookings', label: 'Bookings', meta: 'Advance reservations', icon: '◷' },
  { id: 'documents', label: 'Documents', meta: 'KYC verification', icon: '◫' },
  { id: 'food', label: 'Food Options', meta: 'Meal plans & orders', icon: '⊕' },
  { id: 'billing', label: 'Billing', meta: 'Invoices & payments', icon: '◑' },
  { id: 'settings', label: 'Settings', meta: 'Hotel configuration', icon: '◌' },
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
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

  // Search logic
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const q = query.toLowerCase()
    const panelResults = PANELS
      .filter(p => p.label.toLowerCase().includes(q) || p.meta.toLowerCase().includes(q))
      .map(p => ({ ...p, resultType: 'Panel' }))
    const guestResults = MOCK_GUESTS
      .filter(g => g.name.toLowerCase().includes(q) || g.room.includes(q))
      .map(g => ({ id: `guest-${g.id}`, label: g.name, meta: `Room ${g.room} · ${g.status}`, icon: '◎', resultType: 'Guest', panelId: 'guests' }))
    setResults([...panelResults, ...guestResults].slice(0, 8))
    setSelected(0)
  }, [query])

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
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[2px] z-[2000] flex items-start justify-center pt-20">
      <div ref={containerRef} className="w-full max-w-[540px] bg-surface border border-line rounded-xl shadow-[var(--shadow-md)] overflow-hidden">
        {/* Input */}
        <div className={`flex items-center gap-2.5 px-4 py-3 ${results.length ? 'border-b border-line' : ''}`}>
          <span className="t-h3 text-ink3">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search panels, guests, rooms..."
            autoFocus
            className="t-h3 flex-1 bg-none border-none outline-none text-ink"
          />
          <kbd
            className="px-1.5 py-0.5 rounded bg-surface2 border border-line2 text-[10px] text-ink3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto">
            {results.map((item, i) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-[100ms] ${i === selected ? 'bg-surface2' : 'bg-transparent'}`}
                onMouseEnter={() => setSelected(i)}
              >
                <span className="t-body w-5 text-center text-ink3">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="t-sm text-ink">{item.label}</div>
                  <div className="text-[11.5px] text-ink3 mt-px">{item.meta}</div>
                </div>
                <span className="t-label px-[7px] py-0.5 rounded-[10px] bg-[var(--gold-bg)] text-gold shrink-0">{item.resultType}</span>
              </div>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="t-sm px-4 py-5 text-center text-ink3">
            No results for "{query}"
          </div>
        )}

        {!query && (
          <div className="px-4 py-3">
            <div className="t-label text-ink3 mb-2">Quick Navigation</div>
            <div className="flex flex-wrap gap-1.5">
              {PANELS.slice(0, 6).map(p => (
                <button key={p.id} onClick={() => handleSelect(p)} className="t-xs px-2.5 py-1 rounded-md border border-line bg-surface2 text-ink2 cursor-pointer transition-all duration-[120ms]"
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
