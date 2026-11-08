/**
 * Surface card with an optional header (title + right-aligned actions slot).
 *
 * `clip` is on by default so full-bleed children (tables, images) are cut to the
 * rounded corners. Turn it off when the body contains a `position: sticky`
 * element — an `overflow: hidden` ancestor silently disables sticky.
 */
export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = '', clip = true }) {
  return (
    <div className={`min-w-0 bg-surface border border-line rounded-xl shadow-soft ${clip ? 'overflow-hidden' : ''} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-line">
          <div className="min-w-0">
            {title && <h3 className="font-display font-semibold text-ink text-[15px] leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-ink3 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
