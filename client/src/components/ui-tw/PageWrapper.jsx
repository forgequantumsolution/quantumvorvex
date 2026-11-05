import { usePageHeader } from '../../store/hooks'

/**
 * Shared page shell for every front-desk module.
 *
 *   <PageWrapper
 *     title="Bookings" subtitle="…"
 *     search={{ value, onChange, placeholder }}         // optional header search box
 *     headerActions={[{ id, label, icon, variant, onClick }, …]}
 *     stats={<StatCard … />…}        // optional row of KPI tiles
 *     toolbar={<FilterTabs … />}     // optional filter row under the header
 *   >
 *     …page content…
 *   </PageWrapper>
 *
 * The title, search and buttons go to the page header bar at the top of the
 * screen (layout/PageHeader.jsx, through usePageHeader — see store/hooks.js for
 * the action fields). This component lays out the rest: an optional responsive
 * stats grid, the toolbar and the content column.
 *
 * Stats are 2-up on phones/tablets, 4-up from lg (`statsCols` = 3 | 4 | 5 | 6
 * sets the lg+/xl+ count for pages with more tiles).
 */
const STATS_COLS = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-3 xl:grid-cols-5',
  6: 'lg:grid-cols-3 xl:grid-cols-6',
}

export default function PageWrapper({
  title,
  subtitle,
  search,
  headerActions,
  stats,
  statsCols = 4,
  toolbar,
  className = '',
  children,
}) {
  usePageHeader({ title, subtitle, search, actions: headerActions })

  return (
    <div className={`w-full min-w-0 font-sans ${className}`}>
      {/* Stats row */}
      {stats && (
        <div className={`grid grid-cols-2 ${STATS_COLS[statsCols] || STATS_COLS[4]} gap-3 sm:gap-3.5 mb-4 sm:mb-5`}>{stats}</div>
      )}

      {/* Filter row */}
      {toolbar && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-4">{toolbar}</div>
      )}

      {/* Content. The trailing space keeps the last row (pagination, row actions)
          clear of the floating assistant button pinned to the bottom-right. */}
      <div className="pb-16">{children}</div>
    </div>
  )
}
