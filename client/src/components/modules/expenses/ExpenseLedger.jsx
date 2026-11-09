import { useTranslation } from 'react-i18next'
import {
  LuPencil, LuTrash2, LuCheck, LuPlus, LuZap, LuUsers, LuWrench, LuSparkles, LuCoffee, LuPercent,
  LuLandmark, LuFuel, LuUndo2, LuEllipsis, LuArrowDownLeft,
} from 'react-icons/lu'
import { Card, FilterTabs, Pagination, Button, EmptyState, ActionMenu, Field } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dayKey, today } from './expenseUtils'

const LEDGER_FILTERS = ['all', 'out', 'in', 'unpaid', 'reception']

// Consecutive rows of the page that share a day → [{ day, rows, out, in }].
function groupByDay(expenses) {
  const groups = []
  for (const e of expenses) {
    const day = dayKey(e.date)
    let g = groups[groups.length - 1]
    if (!g || g.day !== day) { g = { day, rows: [], out: 0, in: 0 }; groups.push(g) }
    g.rows.push(e)
    if (e.type === 'income') g.in += e.amount
    else g.out += e.amount
  }
  return groups
}

const dayLabel = (day) => formatDate(`${day}T00:00`, { weekday: 'short' })

// One icon per cost group, so a row reads at a glance.
const GROUP_ICON = {
  utilities: LuZap, staff: LuUsers, repairs: LuWrench, housekeeping: LuSparkles, guest_supplies: LuCoffee,
  commission: LuPercent, taxes_fees: LuLandmark, transport: LuFuel, refunds: LuUndo2, admin_other: LuEllipsis,
}

const money = (v, sign) => `${sign}${formatCurrency(v)}`

function RowActions({ e, busy, h }) {
  const { t } = useTranslation('expenses')
  if (!h.canManageRow(e)) return null
  return (
    <ActionMenu disabled={busy} items={[
      e.status === 'unpaid' && { label: t('actions.markPaid'), icon: <LuCheck size={14} />, onClick: () => h.onPay(e) },
      { label: t('actions.edit'), icon: <LuPencil size={14} />, onClick: () => h.onEdit(e) },
      { label: t('actions.delete'), icon: <LuTrash2 size={14} />, onClick: () => h.onDelete(e), danger: true },
    ].filter(Boolean)} />
  )
}

/*
 * One entry:   [icon]  Payee  (Unpaid)                      −₹2,400   ⋮
 *                      [Property] Category · Reception · Cash Mark paid
 *                      note · #ref
 */
function Row({ e, busy, h }) {
  const { t } = useTranslation('expenses')
  const income = e.type === 'income'
  const unpaid = e.status === 'unpaid'
  const Icon = income ? LuArrowDownLeft : GROUP_ICON[e.category?.group] || LuEllipsis
  const meta = [
    e.category?.name,
    `${t(`paidFrom.${e.paidFrom}`, { defaultValue: e.paidFrom })}${e.paidByName ? ` (${e.paidByName})` : ''}`,
    t(`modes.${e.paymentMode}`, { defaultValue: e.paymentMode }),
  ].filter(Boolean).join(' · ')
  const note = [e.description, e.reference && `#${e.reference}`].filter(Boolean).join(' · ')

  return (
    <li className="flex items-center gap-3 px-3 sm:px-5 py-3 transition-colors hover:bg-surface2/60">
      <span aria-hidden className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-[16px] ${
        income ? 'bg-success-bg text-success-text' : unpaid ? 'bg-warning-bg text-warning-text' : 'bg-surface2 text-ink2'}`}>
        <Icon />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[14.5px] text-ink truncate">{e.payee}</span>
          {unpaid && <span className="shrink-0 rounded-full bg-warning-bg text-warning-text px-2 py-px text-[11px] font-semibold">{t('status.unpaid')}</span>}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 text-xs text-ink3 mt-0.5">
          {h.showProperty && e.property && (
            <span title={e.property.name} className="shrink-0 max-w-[45%] truncate rounded bg-gold-bg text-gold px-1.5 py-px font-semibold">
              {/* Phones: the short code; the full name from sm up. */}
              <span className="sm:hidden">{e.property.code || e.property.name}</span>
              <span className="hidden sm:inline">{e.property.name}</span>
            </span>
          )}
          <span className="truncate">{meta}</span>
        </div>
        {note && <div className="text-xs text-ink3 truncate mt-0.5 italic">{note}</div>}
      </div>

      <div className="shrink-0 text-right">
        <div className={`font-bold text-[15px] sm:text-[16px] tabular-nums ${income ? 'text-success-text' : unpaid ? 'text-warning-text' : 'text-ink'}`}>
          {money(e.amount, income ? '+' : '−')}
        </div>
        {unpaid && h.canManageRow(e) && (
          <button type="button" disabled={busy} onClick={() => h.onPay(e)}
            className="mt-0.5 inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-xs font-semibold text-gold hover:underline disabled:opacity-50">
            <LuCheck size={12} aria-hidden /> {t('actions.markPaid')}
          </button>
        )}
      </div>
      <div className="shrink-0"><RowActions e={e} busy={busy} h={h} /></div>
    </li>
  )
}

// Out / In / Balance for every row of this view (all pages, not just this one).
// Phones and tablets only: from xl the KPI strip above shows these figures.
function Totals({ totals }) {
  const { t } = useTranslation('expenses')
  const items = [
    { key: 'table.totalOut', value: money(totals.out || 0, '−'), cls: 'text-danger-text' },
    { key: 'table.totalIn', value: money(totals.in || 0, '+'), cls: 'text-success-text' },
    { key: 'table.balance', value: formatCurrency(totals.net || 0), cls: (totals.net || 0) < 0 ? 'text-danger-text' : 'text-success-text' },
  ]
  return (
    <div className="xl:hidden grid grid-cols-3 divide-x divide-line border-b border-line">
      {items.map((i) => (
        <div key={i.key} className="px-3 sm:px-5 py-2.5 min-w-0">
          <div className="text-[11px] sm:text-xs text-ink3 truncate">{t(i.key)}</div>
          <div className={`text-[14px] sm:text-[17px] font-bold tabular-nums truncate ${i.cls}`}>{i.value}</div>
        </div>
      ))}
    </div>
  )
}

function DayList({ groups, loading, busyId, h }) {
  const { t } = useTranslation('expenses')
  if (loading) {
    return (
      <ul className="divide-y divide-line">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-3 sm:px-5 py-3.5">
            <span className="w-10 h-10 rounded-full bg-surface2 animate-pulse" />
            <div className="flex-1 space-y-2"><div className="h-3.5 w-1/3 rounded bg-surface2 animate-pulse" /><div className="h-3 w-1/2 rounded bg-surface2 animate-pulse" /></div>
            <div className="h-4 w-16 rounded bg-surface2 animate-pulse" />
          </li>
        ))}
      </ul>
    )
  }
  const todayKey = today()
  return groups.map((g) => (
    <section key={g.day}>
      <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-2 bg-surface2/70 border-b border-line text-xs">
        <span className="font-semibold text-ink2">
          {dayLabel(g.day)}{g.day === todayKey && <span className="ml-2 text-gold">{t('table.today')}</span>}
        </span>
        <span className="flex items-center gap-3 font-semibold tabular-nums">
          {g.out > 0 && <span className="text-danger-text">{money(g.out, '−')}</span>}
          {g.in > 0 && <span className="text-success-text">{money(g.in, '+')}</span>}
        </span>
      </div>
      <ul className="divide-y divide-line border-b border-line">
        {g.rows.map((e) => <Row key={e.id} e={e} busy={busyId === e.id} h={h} />)}
      </ul>
    </section>
  ))
}

/**
 * Cash-book list, the same at every width: the view's totals on top, then one
 * section per day (day subtotal in its header) with one line per entry.
 * `properties` (All-properties scope only) adds a property filter and a property
 * tag on every row; `canManageRow(e)` decides the row's write actions.
 */
export default function ExpenseLedger({
  expenses, total, totals, loading, error, page, pageSize, onPage, filter, onFilter,
  busyId, canManage, canManageRow, properties, property, onProperty, searching, onAdd, onPay, onEdit, onDelete,
}) {
  const { t } = useTranslation('expenses')
  const h = { canManageRow, showProperty: !!properties, onPay, onEdit, onDelete }
  const groups = groupByDay(expenses)
  const empty = !loading && !expenses.length

  return (
    <Card>
      <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-line min-w-0 ${properties ? '' : 'xl:hidden'}`}>
        <div className="min-w-0 flex-1 xl:hidden">
          <FilterTabs wrap={false} tabs={LEDGER_FILTERS.map((id) => ({ id, label: t(`filters.${id}`) }))}
                      active={filter} onChange={onFilter} />
        </div>
        {properties && (
          <Field className="sm:w-64 sm:ml-auto shrink-0" aria-label={t('filters.property')} value={property}
            onChange={(e) => onProperty(e.target.value)}
            options={[{ value: '', label: t('common:allProperties') }, ...properties.map((p) => ({ value: p.id, label: p.name }))]} />
        )}
      </div>
      {error && <div className="px-4 sm:px-5 py-3 text-sm text-danger-text bg-danger-bg border-b border-line">{error}</div>}

      {empty ? (
        <EmptyState icon="₹" title={t('empty.title')} message={searching ? t('empty.search') : t('empty.message')}
          action={canManage && !searching ? <Button icon={<LuPlus />} onClick={onAdd}>{t('addExpense')}</Button> : null} />
      ) : (
        <>
          {!loading && <Totals totals={totals} />}
          <DayList groups={groups} loading={loading} busyId={busyId} h={h} />
        </>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} disabled={loading} onChange={onPage} />
    </Card>
  )
}
