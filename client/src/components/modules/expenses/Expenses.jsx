import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  LuPlus, LuRefreshCw, LuDownload, LuCalendarRange, LuCheck, LuArrowUpRight, LuArrowDownLeft, LuScale, LuReceipt, LuWallet,
  LuBookOpen, LuChartPie, LuTags,
} from 'react-icons/lu'
import { PageWrapper, StatCard } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import ExpenseLedger from './ExpenseLedger'
import ExpenseAnalysis from './ExpenseAnalysis'
import ExpenseCategories from './ExpenseCategories'
import ExpenseModal from './ExpenseModal'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'
import { usePrimaryAction } from '../../../store/hooks'
import { expensesApi } from '../../../api/client'
import { formatCurrency, formatDate } from '../../../utils/format'
import { PERIODS, periodRange, signedMoney, downloadCsv, today } from './expenseUtils'

const PAGE_SIZE = 25
const TABS = ['ledger', 'analysis', 'categories']
// The tabs sit in the header as a view toggle (like Rooms' floor / board switch).
const TAB_ICONS = { ledger: <LuBookOpen />, analysis: <LuChartPie />, categories: <LuTags /> }

// Ledger filters — one at a time; the KPI strip and the ledger's own tabs both set it.
const FILTERS = {
  all:       {},
  out:       { type: 'expense' },
  in:        { type: 'income' },
  unpaid:    { status: 'unpaid' },
  reception: { paidFrom: 'reception' },
}

export default function Expenses() {
  const { t } = useTranslation('expenses')
  const toast = useToast()
  const canManage = useCan('expenses', 'MANAGE')

  const [tab, setTab] = useState('ledger')
  const [catEditing, setCatEditing] = useState(null) // category form: null | {} (new) | { group } | category
  const [period, setPeriod] = useState('thisMonth')
  const range = useMemo(() => periodRange(period), [period])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [list, setList] = useState({ expenses: [], total: 0, totals: { out: 0, in: 0, net: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [categories, setCategories] = useState([])

  const [editing, setEditing] = useState(null)       // null | {} (new) | expense
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Debounced search; a new query starts back on page 1.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const listParams = useCallback((extra = {}) => ({
    from: range.from, to: range.to, ...FILTERS[filter], search: search || undefined, ...extra,
  }), [range, filter, search])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await expensesApi.list(listParams({ page, limit: PAGE_SIZE }))
      setList({ expenses: data.expenses || [], total: data.total ?? 0, totals: data.totals || { out: 0, in: 0, net: 0 } })
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [listParams, page, t])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const { data } = await expensesApi.summary({ from: range.from, to: range.to })
      setSummary(data)
    } catch {
      /* the list's error banner already covers an outage */
    } finally {
      setSummaryLoading(false)
    }
  }, [range])

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await expensesApi.categories()
      setCategories(data.categories || [])
    } catch { /* the add form shows an empty category list */ }
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadCategories() }, [loadCategories])

  // Paid / deleted the last row of the last page → step back to page 1.
  useEffect(() => {
    if (!loading && !error && !list.expenses.length && page > 1) setPage(1)
  }, [loading, error, list.expenses.length, page])

  const reload = useCallback(() => { loadList(); loadSummary() }, [loadList, loadSummary])

  const openNew = () => canManage && setEditing({})
  usePrimaryAction('expenses', openNew)

  const applyFilter = (next) => { setFilter(next); setPage(1); setTab('ledger') }
  const changePeriod = (next) => { setPeriod(next); setPage(1) }

  // ── Row actions ──
  const markPaid = async (e) => {
    setBusyId(e.id)
    try {
      await expensesApi.pay(e.id, { date: today() })
      toast(t('toast.paid', { payee: e.payee }))
      reload()
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    const e = deleteTarget
    if (!e) return
    setBusyId(e.id)
    try {
      await expensesApi.remove(e.id)
      toast(t('toast.deleted', { payee: e.payee }), 'error')
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast(err.response?.data?.message || t('toast.failed'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Every row of the current filter (not just this page) as CSV.
  const exportCsv = async () => {
    setExporting(true)
    try {
      const { data } = await expensesApi.list(listParams({ page: 1, limit: 5000 }))
      const rows = (data.expenses || []).map((e) => [
        e.date?.slice(0, 10), e.payee, e.category?.name || '', t(`groups.${e.category?.group}`, { defaultValue: e.category?.group || '' }),
        e.description || '', t(`paidFrom.${e.paidFrom}`), e.paidByName || '', t(`modes.${e.paymentMode}`),
        e.reference || '', t(`status.${e.status}`),
        e.type === 'expense' ? e.amount : '', e.type === 'income' ? e.amount : '',
      ])
      downloadCsv(`expenses-${range.from}-to-${range.to}.csv`, [
        t('csv.date'), t('csv.payee'), t('csv.category'), t('csv.group'), t('csv.note'), t('csv.paidFrom'),
        t('csv.paidBy'), t('csv.mode'), t('csv.reference'), t('csv.status'), t('csv.out'), t('csv.in'),
      ], rows)
    } catch {
      toast(t('toast.exportFailed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const totals = summary?.totals
  const cash = summary?.cash
  const money = (v) => formatCurrency(v ?? 0)
  const periodLabel = `${formatDate(`${range.from}T00:00`, { year: range.from.slice(0, 4) === range.to.slice(0, 4) ? undefined : 'numeric' })} – ${formatDate(`${range.to}T00:00`)}`

  const kpis = [
    { id: 'out', icon: <LuArrowUpRight />, tone: 'red', label: t('kpi.expenses'), value: money(totals?.expenses),
      trend: totals?.expenseTrend ?? undefined, trendGoodWhenDown: true },
    { id: 'in', icon: <LuArrowDownLeft />, tone: 'green', label: t('kpi.revenue'), value: money(totals?.revenue),
      hint: t('kpi.otherIncomeHint', { amount: money(totals?.otherIncome) }) },
    { id: 'all', icon: <LuScale />, tone: 'gold', label: t('kpi.net'), value: money(totals?.net),
      hint: t('kpi.marginHint', { pct: Math.round((totals?.margin ?? 0) * 10) / 10 }) },
    { id: 'unpaid', icon: <LuReceipt />, tone: 'amber', label: t('kpi.unpaid'), value: money(totals?.unpaid),
      hint: t('kpi.unpaidHint', { count: totals?.unpaidCount ?? 0 }) },
    { id: 'reception', icon: <LuWallet />, tone: 'blue', label: t('kpi.cash'), value: money(cash?.inHand),
      hint: t('kpi.cashHint', { amount: money(cash?.spent) }) },
  ]

  return (
    <PageWrapper
      title={t('title')}
      subtitle={`${t(`periods.${period}`)} · ${periodLabel}`}
      search={tab === 'ledger' ? { value: query, onChange: setQuery, placeholder: t('searchPlaceholder') } : null}
      headerActions={[
        tab !== 'categories' && {
          id: 'period', label: t(`periods.${period}`), icon: <LuCalendarRange />,
          menu: PERIODS.map((p) => ({ id: p, label: t(`periods.${p}`), icon: period === p ? <LuCheck /> : undefined, onClick: () => changePeriod(p) })),
        },
        tab === 'ledger' && { id: 'export', label: t('exportCsv'), icon: <LuDownload />, disabled: exporting || loading, onClick: exportCsv },
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: () => { reload(); loadCategories() } },
        ...TABS.map((id) => ({ id: `tab-${id}`, label: t(`tabs.${id}`), icon: TAB_ICONS[id], variant: 'icon', active: tab === id, onClick: () => setTab(id) })),
        canManage && (tab === 'categories'
          ? { id: 'add-category', label: t('categories.add'), icon: <LuPlus />, variant: 'primary', onClick: () => setCatEditing({}) }
          : { id: 'add', label: t('addExpense'), icon: <LuPlus />, variant: 'primary', onClick: openNew }),
      ]}
      stats={kpis.map((k) => (
        <StatCard key={k.id} {...k} loading={summaryLoading && !summary}
          selected={tab === 'ledger' && filter === k.id} onClick={() => applyFilter(k.id)} />
      ))}
    >
      {tab === 'ledger' && (
        <ExpenseLedger
          expenses={list.expenses}
          total={list.total}
          totals={list.totals}
          loading={loading}
          error={error}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          filter={filter}
          onFilter={applyFilter}
          busyId={busyId}
          canManage={canManage}
          searching={!!search}
          onAdd={openNew}
          onPay={markPaid}
          onEdit={setEditing}
          onDelete={setDeleteTarget}
        />
      )}
      {tab === 'analysis' && <ExpenseAnalysis summary={summary} loading={summaryLoading} />}
      {tab === 'categories' && (
        <ExpenseCategories categories={categories} canManage={canManage} onChanged={loadCategories}
          editing={catEditing} onEdit={setCatEditing} />
      )}

      {editing && (
        <ExpenseModal
          expense={editing.id ? editing : null}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(_, keepOpen) => { reload(); if (!keepOpen) setEditing(null) }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('delete.title')}
        message={deleteTarget ? (
          <Trans t={t} i18nKey="delete.message" values={{ payee: deleteTarget.payee, amount: signedMoney(deleteTarget) }}
                 components={{ b: <b /> }} />
        ) : null}
        confirmLabel={t('common:delete')}
        cancelLabel={t('common:cancel')}
        danger
        busy={busyId === deleteTarget?.id}
      />
    </PageWrapper>
  )
}
