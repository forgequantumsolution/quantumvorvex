import { useEffect, useRef } from 'react'

/**
 * Segmented filter tabs. `tabs` = [{ id, label, count? }]; controlled by
 * `active` / `onChange(id)`.
 *
 * Phones: always one line that scrolls sideways (the active tab is scrolled
 * into view). From sm up, `wrap` (default) lets the strip grow a second row;
 * `wrap` off keeps it on one scrolling line at every width.
 */
export default function FilterTabs({ tabs, active, onChange, wrap = true, className = '' }) {
  const stripRef = useRef(null)

  // Keep the selected tab visible when the strip scrolls sideways. Scrolls the
  // strip only (scrollIntoView would also move the page).
  useEffect(() => {
    const strip = stripRef.current
    const el = strip?.querySelector('[aria-selected="true"]')
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return
    const left = el.offsetLeft  // strip is relative, so this is strip-local
    if (left < strip.scrollLeft || left + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left - (strip.clientWidth - el.offsetWidth) / 2
    }
  }, [active])

  return (
    <div
      ref={stripRef}
      role="tablist"
      className={`relative inline-flex max-w-full items-center gap-1 bg-surface2 border border-line rounded-lg p-1
                  overflow-x-auto scrollbar-none overscroll-x-contain flex-nowrap ${wrap ? 'sm:flex-wrap sm:overflow-visible' : ''} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              'whitespace-nowrap shrink-0 min-h-10 sm:min-h-0',
              isActive
                ? 'bg-surface text-ink shadow-soft'
                : 'text-ink2 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-gold text-black' : 'bg-canvas text-ink3'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
