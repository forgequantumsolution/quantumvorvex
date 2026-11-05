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
 *     `actions: true`, or (shorthand) one with no header
 *   - `hideOnMobile: true` drops a column from the card
 *   - `mobileOnly: true` shows a column on the card only (e.g. a compact
 *     summary of several table columns)
 * In table mode, `className` styles the column's cells and `hideBelow:
 * 'lg' | 'xl' | '2xl'` hides the column on narrower screens.
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
}) {
  const isWide = useMinWidth(tableFrom)

  if (!rows.length) {
    return empty || <EmptyState />
  }

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
            className={`px-4 py-3.5 ${onRowClick ? 'cursor-pointer active:bg-surface2' : ''} ${cardClassName}`}
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
      </ul>
    )
  }

  const tableColumns = columns.filter((c) => !c.mobileOnly)
  const colClass = (col) => `${alignClass(col.align)} ${TABLE_CELL_FROM[col.hideBelow] || ''} ${col.className || ''}`

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {tableColumns.map((col) => (
              <th
                key={col.key}
                className={`px-3 first:pl-4 last:pr-4 2xl:px-5 py-3 font-medium text-xs uppercase tracking-wider text-ink3 whitespace-nowrap ${colClass(col)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line last:border-0 transition-colors hover:bg-surface2 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {tableColumns.map((col) => (
                <td key={col.key} className={`px-3 first:pl-4 last:pr-4 2xl:px-5 py-3.5 text-ink whitespace-nowrap ${colClass(col)}`}>
                  {cell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
