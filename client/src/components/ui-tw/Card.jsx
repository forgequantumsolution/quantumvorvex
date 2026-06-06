/**
 * Surface card with an optional header (title + right-aligned actions slot).
 */
export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`bg-surface border border-line rounded-xl shadow-soft overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <div>
            {title && <h3 className="font-display font-semibold text-ink text-[15px] leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-ink3 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
