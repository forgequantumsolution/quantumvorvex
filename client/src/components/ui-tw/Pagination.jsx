import { useTranslation, Trans } from 'react-i18next'

/**
 * Page bar for server-paginated lists: the visible range on the left, numbered
 * pages + prev/next on the right. Renders nothing when everything fits on one
 * page. `onChange(page)` is called with the 1-based page to load.
 *
 * Phones: "Showing x–y of z" with big prev/next buttons and a "3 / 12" counter
 * instead of the numbered pages; the numbers appear from sm up.
 */

// [1, '…', 4, 5, 6, '…', 12] — always the first, last and the pages either side
// of the current one, so the bar stays a fixed width however long the list is.
function pageItems(page, totalPages, span = 1) {
  const out = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= span) out.push(i)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
}

const arrow =
  'inline-flex items-center justify-center h-10 min-w-10 sm:h-8 sm:min-w-0 px-2.5 rounded-lg border border-line2 text-ink2 ' +
  'transition-colors hover:border-gold hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed ' +
  'disabled:hover:border-line2 disabled:hover:text-ink2'

export default function Pagination({ page, pageSize, total, onChange, disabled = false, className = '' }) {
  const { t } = useTranslation('shell')
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const go = (p) => !disabled && p !== page && onChange(Math.min(totalPages, Math.max(1, p)))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-5 py-3 border-t border-line ${className}`}>
      <span className="text-[12.5px] text-ink3">
        <Trans t={t} i18nKey="showingRange" values={{ range: `${first}–${last}`, total }}
          components={{ b: <span className="text-ink2 font-medium tabular-nums" /> }} />
      </span>

      <div className="flex items-center gap-1 ml-auto">
        <button type="button" className={arrow} disabled={disabled || page <= 1}
                onClick={() => go(page - 1)} aria-label={t('previousPage')}>
          ←
        </button>

        {/* Phones: compact counter in place of the page numbers */}
        <span className="sm:hidden px-2 text-[13px] text-ink2 tabular-nums" aria-live="polite">
          {page} / {totalPages}
        </span>

        {pageItems(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="hidden sm:inline-block w-6 text-center text-ink3 select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => go(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`hidden sm:inline-block w-8 h-8 rounded-lg text-[13px] font-medium tabular-nums transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed ${
                            p === page
                              ? 'bg-gold text-black'
                              : 'text-ink2 border border-line2 hover:border-gold hover:text-gold'
                          }`}
            >
              {p}
            </button>
          ),
        )}

        <button type="button" className={arrow} disabled={disabled || page >= totalPages}
                onClick={() => go(page + 1)} aria-label={t('nextPage')}>
          →
        </button>
      </div>
    </div>
  )
}
