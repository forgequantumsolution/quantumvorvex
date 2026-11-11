import { useTranslation } from 'react-i18next'
import EmptyState from './EmptyState'
import { useMinWidth } from '../../hooks/useMediaQuery'

// Table-mode column hiding: literal class names so Tailwind generates them.
const TABLE_CELL_FROM = {
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
}

/**
 * Lightweight table. `columns` = [{ key, header, render?(row), className?, align? }].
 * `rows` = array of records; `rowKey(row)` returns a stable key.
 * Falls back to <EmptyState> when there are no rows.
 *
 * Below `tableFrom` (default md) rows render as stacked cards (`mobile="cards"`):
 *   - columns marked `primary: true` form the card's title line (else the first column)
 *   - the rest show as "label · value" pairs (label = `mobileLabel` ?? `header`)
 *   - `mobileFull: true` lets a pair span the card's full width (bars, long text)
 *   - row actions go in the card's footer, right-aligned: a column marked
 *     `actions: true`, or (shorthand) one with no header. In table mode an
 *     action column without a header is titled "Actions" (common:actions),
 *     so every table shows the same Actions column.
 *   - `hideOnMobile: true` drops a column from the card
 *   - `mobileOnly: true` shows a column on the card only (e.g. a compact
 *     summary of several table columns)
 * In table mode, `className` styles the column's cells and `hideBelow:
 * 'lg' | 'xl' | '2xl'` hides the column on narrower screens.
 *
 * `rowClassName(row)` adds classes to one row (table <tr> and phone card), e.g.
 * dimming archived records. `footer(rows)` on a column fills that column's cell
 * in a bold totals row (<tfoot>; on phones a summary card) — set it on any column
 * to get the row. Clickable rows (`onRowClick`) are keyboard-focusable and open
 * on Enter / Space.
 *
 * `loading` shows skeleton rows (`skeletonRows`, default 5) in place of the data.
 * `minWidth` (e.g. '920px') keeps a wide table from squashing; it scrolls instead.
 *
 * Look: the Bookings table — tinted header row, uppercase tracked titles, roomy
 * rows with a soft hover. Wrap it in <TableCard> for tabs on top and pagination.
 *
 * `tableFrom="lg"` (or xl / 2xl) keeps cards on tablets for wide tables.
 * `mobile="scroll"` keeps the table on phones too, scrolling sideways inside
 * its own box — for dense numeric grids where comparing rows matters.
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (r) => r.id,
  empty,
  onRowClick,
  mobile = 'cards',
  tableFrom = 'md',
  cardClassName = '',
  loading = false,
  skeletonRows = 5,
  minWidth,
  rowClassName,
}) {
  const { t } = useTranslation()
  const isWide = useMinWidth(tableFrom)

  if (loading) {
    if (!isWide && mobile === 'cards') {
      return (
        <ul className="list-none m-0 p-0 divide-y divide-line">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <li key={i} className="px-4 py-4 space-y-2.5">
              <div className="h-3.5 w-2/3 rounded bg-surface2 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-surface2 animate-pulse" />
            </li>
          ))}
        </ul>
      )
    }
  } else if (!rows.length) {
    return empty || <EmptyState />
  }

  const rowExtra = (row) => (rowClassName ? rowClassName(row) || '' : '')
  const hasFooter = columns.some((c) => c.footer)
  // Enter / Space opens a clickable row — unless focus is on a control inside it.
  const rowKeyDown = (row) => (onRowClick ? (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row) }
  } : undefined)
  const clickable = onRowClick ? { tabIndex: 0 } : {}

  const alignClass = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])

  if (!isWide && mobile === 'cards') {
    const visible = columns.filter((c) => !c.hideOnMobile)
    const primary = visible.some((c) => c.primary) ? visible.filter((c) => c.primary) : visible.slice(0, 1)
    const actions = visible.filter((c) => !primary.includes(c) && (c.actions || (!c.header && !c.mobileLabel)))
    const fields  = visible.filter((c) => !primary.includes(c) && !actions.includes(c))

    return (
      <ul className="list-none m-0 p-0 divide-y divide-line">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={rowKeyDown(row)}
            {...clickable}
            className={`px-4 py-3.5 ${onRowClick ? 'cursor-pointer active:bg-surface2 focus-visible:outline-none focus-visible:bg-surface2' : ''} ${cardClassName} ${rowExtra(row)}`}
          >
            <div className="flex items-start justify-between gap-3 min-w-0">
              {primary.map((col, i) => (
                <div key={col.key} className={`min-w-0 ${i === 0 ? 'flex-1 font-medium text-ink text-[14px]' : 'shrink-0 text-ink'}`}>
                  {cell(col, row)}
                </div>
              ))}
            </div>

            {fields.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5">
                {fields.map((col) => (
                  <div key={col.key} className={`min-w-0 ${col.mobileFull ? 'col-span-2' : ''}`}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-ink3">{col.mobileLabel ?? col.header}</dt>
                    <dd className="m-0 mt-0.5 text-[13px] text-ink break-words">{cell(col, row)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {actions.length > 0 && (
              // Actions don't open the row
              <div className="flex flex-wrap items-center justify-end gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {actions.map((col) => <div key={col.key}>{cell(col, row)}</div>)}
              </div>
            )}
          </li>
        ))}
        {hasFooter && (
          <li className="px-4 py-3.5 bg-surface2/60">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 m-0">
              {visible.filter((c) => c.footer).map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wider text-ink3">{col.mobileLabel ?? col.header}</dt>
                  <dd className="m-0 mt-0.5 text-[13px] font-semibold text-ink break-words">{col.footer(rows)}</dd>
                </div>
              ))}
            </dl>
          </li>
        )}
      </ul>
    )
  }

  // Action columns (flagged, or headerless by the shorthand) always carry the
  // "Actions" title in table mode.
  const tableColumns = columns.filter((c) => !c.mobileOnly).map((c) => (
    !c.header && (c.actions || !c.mobileLabel) ? { ...c, header: t('common:actions') } : c
  ))
  const colClass = (col) => `${alignClass(col.align)} ${TABLE_CELL_FROM[col.hideBelow] || ''} ${col.className || ''}`

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="border-b border-line bg-surface2/60">
            {tableColumns.map((col) => (
              <th
                key={col.key}
                className={`px-4 first:pl-5 last:pr-5 py-2.5 font-medium text-xs uppercase tracking-wider text-ink3 whitespace-nowrap ${colClass(col)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: skeletonRows }, (_, i) => (
            <tr key={`sk-${i}`} className="border-b border-line last:border-0">
              {tableColumns.map((col, j) => (
                <td key={col.key} className={`px-4 first:pl-5 last:pr-5 py-4 ${colClass(col)}`}>
                  <div className="h-3.5 rounded bg-surface2 animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={rowKeyDown(row)}
              {...clickable}
              className={`border-b border-line last:border-0 transition-colors hover:bg-surface2/70 ${
                onRowClick ? 'cursor-pointer focus-visible:outline-none focus-visible:bg-surface2/70' : ''
              } ${rowExtra(row)}`}
            >
              {tableColumns.map((col) => (
                <td key={col.key} className={`px-4 first:pl-5 last:pr-5 py-3.5 text-ink whitespace-nowrap ${colClass(col)}`}>
                  {cell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasFooter && !loading && rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-line bg-surface2/60">
              {tableColumns.map((col) => (
                <td key={col.key} className={`px-4 first:pl-5 last:pr-5 py-3 font-semibold text-ink whitespace-nowrap ${colClass(col)}`}>
                  {col.footer ? col.footer(rows) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
