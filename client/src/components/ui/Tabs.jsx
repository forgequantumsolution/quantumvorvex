import { Children, useEffect, useRef } from 'react'

// Props: tabs (array of {id, label}), active, onChange, children
// Children can be plain elements; match by index or by prop `id`
// The tab row is one line that scrolls sideways when it doesn't fit (phones);
// the active tab is kept in view.
export default function Tabs({ tabs = [], active, onChange, children }) {
  const rowRef = useRef(null)

  // Normalize children into an array
  const childArray = Children.toArray(children)

  // Find the panel matching the active tab id
  // Supports children with a `data-tab-id` prop or falls back to index order
  const activePanel = childArray.find(
    (child) => child?.props?.['data-tab-id'] === active
  ) ?? childArray[tabs.findIndex((t) => t.id === active)]

  // Scroll the row (only the row — not the page) so the active tab is visible.
  useEffect(() => {
    const row = rowRef.current
    const el = row?.querySelector('[aria-selected="true"]')
    if (!row || !el || row.scrollWidth <= row.clientWidth) return
    const left = el.offsetLeft
    if (left < row.scrollLeft || left + el.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = left - (row.clientWidth - el.offsetWidth) / 2
    }
  }, [active])

  return (
    <div className="min-w-0">
      {/* Tab button row */}
      <div ref={rowRef} role="tablist" className="relative flex overflow-x-auto overscroll-x-contain border-b border-line scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            className={`tab-btn shrink-0${active === tab.id ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {activePanel && (
        <div className="pt-4">{activePanel}</div>
      )}
    </div>
  )
}
