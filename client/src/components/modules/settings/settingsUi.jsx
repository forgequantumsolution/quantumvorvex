import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { Button, Pagination } from '../../ui-tw'

/**
 * Building blocks every Settings section uses, so all of them share one look:
 *
 *   <Section title="Room types" subtitle="…" bodyClassName="p-0">
 *     …fields or an editable table…
 *     <TablePager pager={pager} />          // pager = usePaged(rows), see usePaged.js
 *   </Section>
 *
 * Buttons: a tab's Save and its section actions (add row, reset, upload…) live
 * in the page header bar (useSettingsHeader in Settings.jsx), not in the cards.
 * Inside cards only row-level controls remain: RowDelete (trash icon) per row,
 * ActionButton for a row's own action, and AddButton in an empty state.
 * Section still accepts `actions` / `footer` for non-button content.
 */

// A settings card: header (title, subtitle, right-aligned actions), body, and an
// optional footer.
export function Section({ title, subtitle, actions, footer, children, bodyClassName = 'p-4 sm:p-5', className = '' }) {
  return (
    <section className={`min-w-0 bg-surface border border-line rounded-xl shadow-soft ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line">
          <div className="min-w-0">
            {title && <h3 className="font-display font-semibold text-ink text-[15px] leading-tight m-0">{title}</h3>}
            {subtitle && <p className="text-xs text-ink3 mt-1 mb-0 leading-snug">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && <footer className="px-4 sm:px-5 py-3 border-t border-line bg-surface2/50 rounded-b-xl">{footer}</footer>}
    </section>
  )
}

// Outlined small "add" button with a plus icon (empty states).
export function AddButton({ children, ...props }) {
  return <Button variant="ghost" size="sm" icon={<LuPlus />} {...props}>{children}</Button>
}

// A row's own action (e.g. Edit template): outlined, small, with an icon.
export function ActionButton({ icon, children, variant = 'ghost', ...props }) {
  return <Button variant={variant} size="sm" icon={icon} {...props}>{children}</Button>
}

// Delete a table row: a trash icon, red on hover, 44px tap area on touch.
export function RowDelete({ onClick, label: labelProp, disabled }) {
  const { t } = useTranslation()
  const label = labelProp || t('common:remove')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-lg
                 bg-transparent border-none cursor-pointer text-ink3 hover:text-danger-text hover:bg-danger-bg transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink3"
    >
      <LuTrash2 size={15} aria-hidden />
    </button>
  )
}

export function TablePager({ pager }) {
  return (
    <Pagination
      page={pager.page}
      pageSize={pager.pageSize}
      total={pager.total}
      onChange={pager.setPage}
    />
  )
}
