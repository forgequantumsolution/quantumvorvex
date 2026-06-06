import { Children } from 'react'

// Props: tabs (array of {id, label}), active, onChange, children
// Children can be plain elements; match by index or by prop `id`
export default function Tabs({ tabs = [], active, onChange, children }) {
  // Normalize children into an array
  const childArray = Children.toArray(children)

  // Find the panel matching the active tab id
  // Supports children with a `data-tab-id` prop or falls back to index order
  const activePanel = childArray.find(
    (child) => child?.props?.['data-tab-id'] === active
  ) ?? childArray[tabs.findIndex((t) => t.id === active)]

  return (
    <div>
      {/* Tab button row */}
      <div className="flex overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn${active === tab.id ? ' active' : ''}`}
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
