import Card from './Card'
import FilterTabs from './FilterTabs'
import Pagination from './Pagination'

/**
 * The app's standard list block — the Bookings layout — used by every page that
 * lists records:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [All 23] [Upcoming 7] [Confirmed 5] …        {toolbar}   │  ← tabs strip (optional)
 *   ├──────────────────────────────────────────────────────────┤
 *   │ error banner (optional)                                  │
 *   │ {children} — normally a <DataTable>                      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Showing 1–8 of 23                         ‹ 1 2 3 ›      │  ← pagination (optional)
 *   └──────────────────────────────────────────────────────────┘
 *
 * Props:
 *   tabs       [{ id, label, count? }] — status / filter tabs (FilterTabs)
 *   activeTab  id of the selected tab;  onTab(id)
 *   toolbar    extra controls at the right of the tabs strip (or alone, if no tabs)
 *   error      message shown in a red banner above the table
 *   pagination { page, pageSize, total, onChange, disabled? } — omit for none
 *   title / subtitle / actions — optional Card header (for dashboard-style blocks)
 */
export default function TableCard({
  tabs, activeTab, onTab, toolbar, error, pagination, title, subtitle, actions, className = '', children,
}) {
  const hasStrip = (tabs && tabs.length > 0) || toolbar
  return (
    <Card title={title} subtitle={subtitle} actions={actions} className={className}>
      {hasStrip && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-line min-w-0">
          {tabs && tabs.length > 0 && (
            <div className="min-w-0 flex-1">
              <FilterTabs wrap={false} tabs={tabs} active={activeTab} onChange={onTab} />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto shrink-0">{toolbar}</div>}
        </div>
      )}
      {error && (
        <div className="px-4 sm:px-5 py-3 text-sm text-danger-text bg-danger-bg border-b border-line">{error}</div>
      )}
      {children}
      {pagination && (
        <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total}
          onChange={pagination.onChange} disabled={pagination.disabled} />
      )}
    </Card>
  )
}
