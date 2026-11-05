import { useMemo, useState } from 'react'

/**
 * Client-side paging for a settings list: `const pager = usePaged(rows)` then
 * render `pager.rows` and `<TablePager pager={pager} />`. Keeps the page in
 * range as rows are added or removed, and jumps to the last page when a row is
 * added so the new one is in view. `pager.offset` maps a visible row back to
 * its index in the full list.
 */
export function usePaged(rows, pageSize = 8) {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const [state, setState] = useState({ page: 1, total })
  // Adjust while rendering when the row count changes (React's documented
  // pattern for state derived from props): added → last page, removed → in range.
  let page = Math.min(state.page, pages)
  if (state.total !== total) {
    page = total > state.total ? pages : page
    setState({ page, total })
  }
  const offset = (page - 1) * pageSize
  const visible = useMemo(() => rows.slice(offset, offset + pageSize), [rows, offset, pageSize])
  const setPage = (p) => setState((s) => ({ ...s, page: p }))
  return { rows: visible, page, setPage, pageSize, total, offset }
}
