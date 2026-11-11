import { useTranslation } from 'react-i18next'
import {
  LuPencil, LuTrash2, LuCheck, LuPlus, LuZap, LuUsers, LuWrench, LuSparkles, LuCoffee, LuPercent,
  LuLandmark, LuFuel, LuUndo2, LuEllipsis, LuArrowDownLeft, LuEye,
} from 'react-icons/lu'
import { TableCard, DataTable, Button, EmptyState } from '../../ui-tw'
import { formatCurrency, formatDate } from '../../../utils/format'
import { dayKey, today } from './expenseUtils'

// One icon per cost group, so a row reads at a glance.
const GROUP_ICON = {
  utilities: LuZap, staff: LuUsers, repairs: LuWrench, housekeeping: LuSparkles, guest_supplies: LuCoffee,
  commission: LuPercent, taxes_fees: LuLandmark, transport: LuFuel, refunds: LuUndo2, admin_other: LuEllipsis,
}

const LEDGER_FILTERS = ['all', 'out', 'in', 'unpaid', 'reception']

const money = (v, sign) => `${sign}${formatCurrency(v)}`

const ACTION_TONE = {
  view:   'text-info-text hover:bg-info-bg',
  edit:   'text-gold hover:bg-gold-bg',
  delete: 'text-danger-text hover:bg-danger-bg',
}

// View / Edit / Delete as one icon-only segmented group.
function RowActions({ e, busy, h }) {
  const { t } = useTranslation('expenses')
  const items = [
    { id: 'view', label: t('actions.view'), icon: <LuEye size={15} />, onClick: () => h.onOpen(e) },
    h.canManageRow(e) && { id: 'edit', label: t('actions.edit'), icon: <LuPencil size={15} />, onClick: () => h.onEdit(e) },
    h.canDeleteRow(e) && { id: 'delete', label: t('actions.delete'), icon: <LuTrash2 size={15} />, onClick: () => h.onDelete(e) },
  ].filter(Boolean)
  return (
    // Clicks here must not also open the row's details.
    <div role="group" aria-label={t('table.actions')}
      className="inline-flex items-stretch rounded-lg border border-line bg-surface shadow-soft overflow-hidden divide-x divide-line"
      onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
      {items.map((i) => (
        <button key={i.id} type="button" disabled={busy} onClick={i.onClick} title={i.label} aria-label={i.label}
          className={`w-[34px] h-[34px] inline-flex items-center justify-center bg-transparent border-0 cursor-pointer transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${ACTION_TONE[i.id]}`}>
          {i.icon}
        </button>
      ))}
    </div>
  )
}

function Particular({ e, showProperty }) {
  const { t } = useTranslation('expenses')
  const income = e.type === 'income'
  const unpaid = e.status === 'unpaid'
  const Icon = income ? LuArrowDownLeft : GROUP_ICON[e.category?.group] || LuEllipsis
  const note = [e.description, e.reference && `#${e.reference}`].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span aria-hidden className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[15px] ${
        income ? 'bg-success-bg text-success-text' : unpaid ? 'bg-warning-bg text-warning-text' : 'bg-surface2 text-ink2'}`}>
        <Icon />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-[14px] text-ink truncate max-w-[260px]">{e.payee}</span>
          {showProperty && e.property && (
            <span title={e.property.name} className="shrink-0 max-w-[140px] truncate rounded bg-gold-bg text-gold px-1.5 py-px text-[11px] font-semibold">
              {e.property.code || e.property.name}
            </span>
          )}
        </div>
        <div className="text-xs text-ink3 truncate max-w-[300px] mt-0.5">
          {note || t(income ? 'detail.moneyIn' : 'detail.moneyOut')}
        </div>
      </div>
    </div>
  )
}

function Status({ e, busy, h }) {
  const { t } = useTranslation('expenses')
  if (e.status !== 'unpaid') {
    return <span className="inline-flex rounded-full bg-success-bg text-success-text px-2.5 py-0.5 text-[11.5px] font-semibold">{t('status.paid')}</span>
  }
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex rounded-full bg-warning-bg text-warning-text px-2.5 py-0.5 text-[11.5px] font-semibold">{t('status.unpaid')}</span>
      {h.canManageRow(e) && (
        <button type="button" disabled={busy} onClick={(ev) => { ev.stopPropagation(); h.onPay(e) }}
          className="inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-xs font-semibold text-gold hover:underline disabled:opacity-50">
          <LuCheck size={12} aria-hidden /> {t('actions.markPaid')}
        </button>
      )}
    </div>
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

/**
 * Cash-book table: Date · Particular · Category · Paid from · Mode · Status ·
 * Amount · Actions, in the shared TableCard (status tabs on top, pagination below)
 * — the same layout as Bookings. Phones get stacked cards (DataTable).
 * `showProperty` (All-properties scope) tags every row with its property;
 * `canManageRow(e)` / `canDeleteRow(e)` decide the row's actions.
 */
export default function ExpenseLedger({
  expenses, total, totals, loading, error, page, pageSize, onPage, filter, onFilter,
  busyId, canManage, canManageRow, canDeleteRow, onOpen, showProperty, searching, onAdd, onPay, onEdit, onDelete,
}) {
  const { t } = useTranslation('expenses')
  const h = { canManageRow, canDeleteRow, onOpen, onPay, onEdit, onDelete }
  const todayKey = today()

  const columns = [
    {
      key: 'particular', header: t('table.particular'), primary: true,
      render: (e) => <Particular e={e} showProperty={showProperty} />,
    },
    {
      key: 'amount', header: t('table.amount'), primary: true, align: 'right',
      render: (e) => {
        const income = e.type === 'income'
        return (
          <span className={`font-bold text-[15px] tabular-nums ${income ? 'text-success-text' : e.status === 'unpaid' ? 'text-warning-text' : 'text-ink'}`}>
            {money(e.amount, income ? '+' : '−')}
          </span>
        )
      },
    },
    {
      key: 'date', header: t('table.date'),
      render: (e) => (
        <div className="leading-tight">
          <div className="text-ink font-medium">{formatDate(e.date)}</div>
          <div className="text-xs text-ink3">
            {dayKey(e.date) === todayKey
              ? <span className="text-gold font-semibold">{t('table.today')}</span>
              : formatDate(e.date, { weekday: 'long', day: undefined, month: undefined, year: undefined })}
          </div>
        </div>
      ),
    },
    {
      key: 'category', header: t('table.category'),
      render: (e) => (
        <div className="leading-tight">
          <div className="text-ink">{e.category?.name || '—'}</div>
          {e.category?.group && <div className="text-xs text-ink3">{t(`groups.${e.category.group}`, { defaultValue: e.category.group })}</div>}
        </div>
      ),
    },
    {
      key: 'paidFrom', header: t('table.paidFrom'), hideBelow: 'xl',
      render: (e) => (
        <div className="leading-tight">
          <div className="text-ink">{t(`paidFrom.${e.paidFrom}`, { defaultValue: e.paidFrom })}</div>
          {e.paidByName && <div className="text-xs text-ink3">{e.paidByName}</div>}
        </div>
      ),
    },
    {
      key: 'mode', header: t('table.mode'), hideBelow: 'lg',
      render: (e) => (
        <span className="inline-flex rounded-md border border-line bg-surface2 px-2 py-0.5 text-xs font-medium text-ink2">
          {t(`modes.${e.paymentMode}`, { defaultValue: e.paymentMode })}
        </span>
      ),
    },
    {
      key: 'status', header: t('table.status'),
      render: (e) => <Status e={e} busy={busyId === e.id} h={h} />,
    },
    {
      key: 'actions', header: t('table.actions'), actions: true, align: 'center', className: 'w-[1%]',
      render: (e) => <RowActions e={e} busy={busyId === e.id} h={h} />,
    },
  ]
  // Table order: Date first, Amount just before Actions; phone cards use the primary pair.
  const order = ['date', 'particular', 'category', 'paidFrom', 'mode', 'status', 'amount', 'actions']
  const ordered = order.map((k) => columns.find((c) => c.key === k))

  return (
    <TableCard
      tabs={LEDGER_FILTERS.map((id) => ({ id, label: t(`filters.${id}`) }))}
      activeTab={filter}
      onTab={onFilter}
      error={error}
      pagination={{ page, pageSize, total, onChange: onPage, disabled: loading }}
    >
      {!loading && expenses.length > 0 && <Totals totals={totals} />}
      <DataTable
        columns={ordered}
        rows={expenses}
        loading={loading}
        onRowClick={onOpen}
        empty={
          <EmptyState icon="₹" title={t('empty.title')} message={searching ? t('empty.search') : t('empty.message')}
            action={canManage && !searching ? <Button icon={<LuPlus />} onClick={onAdd}>{t('addExpense')}</Button> : null} />
        }
      />
    </TableCard>
  )
}
