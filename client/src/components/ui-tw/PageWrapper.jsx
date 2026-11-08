import { usePageHeader } from '../../store/hooks'
import StatStrip from './StatStrip.jsx'

/**
 * Shared page shell for every front-desk module.
 *
 *   <PageWrapper
 *     title="Bookings" subtitle="…"
 *     search={{ value, onChange, placeholder }}         // optional header search box
 *     headerActions={[{ id, label, icon, variant, onClick }, …]}
 *     stats={<StatCard … />…}        // optional KPI strip (desktop only)
 *     toolbar={<FilterTabs … />}     // optional filter row under the header
 *   >
 *     …page content…
 *   </PageWrapper>
 *
 * The title, search and buttons go to the page header bar at the top of the
 * screen (layout/PageHeader.jsx, through usePageHeader — see store/hooks.js for
 * the action fields). This component lays out the rest: an optional KPI strip,
 * the toolbar and the content column.
 *
 * Stats are one compact strip (each StatCard a segment of the bar) from xl;
 * phones and tablets skip them so the list starts at the top — the page's own
 * filters cover the same ground there.
 */

export default function PageWrapper({
  title,
  subtitle,
  search,
  headerActions,
  stats,
  toolbar,
  className = '',
  children,
}) {
  usePageHeader({ title, subtitle, search, actions: headerActions })

  return (
    <div className={`w-full min-w-0 font-sans ${className}`}>
      {/* KPI strip (xl and up) */}
      {stats && <StatStrip className="mb-4">{stats}</StatStrip>}

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
