/**
 * Shared page shell for every front-desk module.
 *
 *   <PageWrapper
 *     title="Bookings" subtitle="…" icon="◷"
 *     actions={<Button>New</Button>}
 *     stats={<StatCard … />…}        // optional row of KPI tiles
 *   >
 *     …page content…
 *   </PageWrapper>
 *
 * Provides a consistent header (icon + title + subtitle + actions), an optional
 * responsive stats grid, and a max-width content column.
 */
export default function PageWrapper({ title, subtitle, icon, actions, stats, children }) {
  const hasHeader = title || icon || actions
  return (
    <div className="w-full font-sans">
      {/* Header — only rendered when there's something to show */}
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3.5">
            {icon && (
              <div className="w-11 h-11 rounded-xl bg-gold-bg border border-gold-border text-gold flex items-center justify-center text-xl shrink-0">
                {icon}
              </div>
            )}
            {(title || subtitle) && (
              <div>
                {title && <h1 className="font-display font-bold text-[26px] leading-none tracking-tight text-ink">{title}</h1>}
                {subtitle && <p className="text-sm text-ink2 mt-1.5">{subtitle}</p>}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">{stats}</div>
      )}

      {/* Content */}
      {children}
    </div>
  )
}
