import EmptyState from './EmptyState'

/**
 * Lightweight table. `columns` = [{ key, header, render?(row), className?, align? }].
 * `rows` = array of records; `rowKey(row)` returns a stable key.
 * Falls back to <EmptyState> when there are no rows.
 */
export default function DataTable({ columns, rows, rowKey = (r) => r.id, empty, onRowClick }) {
  if (!rows.length) {
    return empty || <EmptyState />
  }

  const alignClass = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-medium text-[11px] uppercase tracking-wider text-ink3 whitespace-nowrap ${alignClass(col.align)} ${col.className || ''}`}
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
              {columns.map((col) => (
                <td key={col.key} className={`px-5 py-3.5 text-ink whitespace-nowrap ${alignClass(col.align)} ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
