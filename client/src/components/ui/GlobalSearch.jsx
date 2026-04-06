import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/useStore'

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
  const { setActivePanel, searchOpen, setSearchOpen } = useStore()
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(2px)', zIndex: 2000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80
    }}>
      <div ref={containerRef} style={{
        width: '100%', maxWidth: 540, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: 'var(--shadow-md)', overflow: 'hidden'
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: results.length ? '1px solid var(--border)' : 'none' }}>
          <span style={{ color: 'var(--text3)', fontSize: 16 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search panels, guests, rooms..."
            autoFocus
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)', fontFamily: 'Inter, sans-serif'
            }}
          />
          <kbd style={{
            padding: '2px 6px', borderRadius: 4, background: 'var(--surface2)',
            border: '1px solid var(--border2)', fontSize: 10,
            color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace'
          }}>ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {results.map((item, i) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  background: i === selected ? 'var(--surface2)' : 'transparent',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <span style={{ fontSize: 14, width: 20, textAlign: 'center', color: 'var(--text3)' }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{item.meta}</div>
                </div>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--gold-bg)', color: 'var(--gold)',
                  fontWeight: 600, flexShrink: 0
                }}>{item.resultType}</span>
              </div>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No results for "{query}"
          </div>
        )}

        {!query && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Quick Navigation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PANELS.slice(0, 6).map(p => (
                <button key={p.id} onClick={() => handleSelect(p)} style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.12s'
                }}
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
