import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  LuPlus, LuRefreshCw, LuLayoutDashboard, LuUsers, LuTags, LuUserCheck, LuClock, LuIndianRupee, LuWallet,
  LuBedDouble, LuPencil, LuArchive, LuArchiveRestore, LuClipboardList, LuCalendarDays, LuUtensils,
} from 'react-icons/lu'
import { PageWrapper, StatCard, TableCard, DataTable, Button, EmptyState, Card } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import FoodDashboard from './FoodDashboard'
import CustomerModal from './CustomerModal'
import CustomerDetailModal, { StatusPill, DietTag } from './CustomerDetailModal'
import { SubscribeModal, PaymentModal, PlanModal } from './FoodModals'
import MealSheet from './MealSheet'
import WeeklyMenu from './WeeklyMenu'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'
import { foodApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { CUSTOMER_TABS, MEAL_ICONS, CYCLES, daysLeftLabel, initials, planCycles, planRate, shortDate } from './foodUtils'

const PAGE_SIZE = 25
const VIEWS = ['dashboard', 'meals', 'customers', 'menu', 'plans']
const VIEW_ICONS = {
  dashboard: <LuLayoutDashboard />, meals: <LuClipboardList />, customers: <LuUsers />, menu: <LuCalendarDays />, plans: <LuTags />,
}

/**
 * Food: meal plans, customers (hotel / PG guests and outsiders) and their
 * subscriptions, dues, the kitchen's daily meal sheet and the weekly menu,
 * with a dashboard. Views toggle from the header; the KPI strip stays on top.
 */
export default function Food() {
  const { t } = useTranslation('food')
  const toast = useToast()
  const canManage = useCan('food', 'MANAGE')

  const [view, setView] = useState('dashboard')
  const [dash, setDash] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ customers: [], total: 0, counts: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(null)       // {} = new customer
  const [viewingId, setViewingId] = useState(null)
  const [detailKey, setDetailKey] = useState(0)
  const [selling, setSelling] = useState(null)       // customer to renew / subscribe
  const [paying, setPaying] = useState(null)         // { customer, subscription }
  const [planEditing, setPlanEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const reqId = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const loadDash = useCallback(async () => {
    setDashLoading(true)
    try { const { data } = await foodApi.dashboard(); setDash(data) } catch { /* KPI cards show — */ } finally { setDashLoading(false) }
  }, [])
  const loadPlans = useCallback(async () => {
    try { const { data } = await foodApi.getPlans(); setPlans(data.foodPlans) } catch { /* keep */ } finally { setPlansLoaded(true) }
  }, [])
  const loadCustomers = useCallback(async ({ quiet } = {}) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    try {
      const { data } = await foodApi.customers({ tab, search, page, pageSize: PAGE_SIZE })
      if (id === reqId.current) { setList(data); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e.response?.data?.message || t('toast.failed'))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, search, page, t])

  useEffect(() => { loadDash(); loadPlans() }, [loadDash, loadPlans])
  useEffect(() => { if (view === 'customers') loadCustomers() }, [view, loadCustomers])

  const refreshAll = () => { loadDash(); loadPlans(); if (view === 'customers') loadCustomers({ quiet: true }); setDetailKey((k) => k + 1) }
  const done = (msg) => { if (msg) toast(msg); refreshAll() }

  const openTab = (id) => { setView('customers'); setTab(id); setPage(1) }
  const openPay = async (c) => {
    try {
      const { data } = await foodApi.customer(c.id)
      const s = data.customer.subscriptions.find((x) => x.due > 0)
      if (s) setPaying({ customer: data.customer, subscription: s })
    } catch { toast(t('toast.failed'), 'error') }
  }

  const k = dash?.kpis
  const kpis = [
    { id: 'active', icon: <LuUserCheck />, tone: 'green', label: t('kpi.active'), value: k?.active ?? '—',
      hint: k ? t('kpi.activeHint', { total: k.total }) : undefined, progress: k?.total ? (k.active / k.total) * 100 : undefined },
    { id: 'meals', icon: <LuUtensils />, tone: 'blue', label: t('kpi.meals'), value: k ? `${k.servedToday} / ${k.mealsToday}` : '—', hint: t('kpi.mealsHint') },
    { id: 'expiring', icon: <LuClock />, tone: 'amber', label: t('kpi.expiring'), value: k?.expiring ?? '—', hint: k ? t('kpi.expiringHint', { count: k.paused }) : undefined },
    { id: 'revenue', icon: <LuIndianRupee />, tone: 'gold', label: t('kpi.revenue'), value: k ? formatCurrency(k.revenueThisMonth) : '—',
      trend: k?.revenueTrend ?? undefined, hint: k ? t('kpi.revenueHint', { amount: formatCurrency(k.revenueLastMonth) }) : undefined },
    { id: 'dues', icon: <LuWallet />, tone: 'red', label: t('kpi.dues'), value: k ? formatCurrency(k.duesAmount) : '—',
      hint: k ? t('kpi.duesHint', { count: k.duesCustomers }) : undefined },
  ]
  const KPI_TARGET = { active: ['customers', 'active'], meals: ['meals'], expiring: ['customers', 'expiring'], dues: ['customers', 'dues'], revenue: ['dashboard'] }
  const onKpi = (id) => { const [v, tb] = KPI_TARGET[id]; if (tb) openTab(tb); else setView(v) }

  const noPlans = plansLoaded && !plans.some((p) => p.active)
  const c = list.counts

  const columns = [
    {
      key: 'customer', header: t('table.customer'), primary: true,
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden className="hidden sm:flex w-9 h-9 shrink-0 rounded-full bg-gold-bg text-gold items-center justify-center text-xs font-bold">{initials(r.name)}</span>
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-ink truncate flex items-center gap-1.5">
              {r.name}
              {(r.guestId || r.bookingId) && <LuBedDouble size={13} className="text-violet-text shrink-0" aria-label={t('source.guest')} />}
            </div>
            <div className="text-xs text-ink3 truncate"><span className="text-gold font-mono">{r.customerNo}</span> · {r.phone}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'room', header: t('table.room'), hideBelow: 'md',
      render: (r) => r.roomNumber
        ? <span className="font-mono text-[13px] font-semibold text-gold">{r.roomNumber}{r.bedNo ? <span className="text-ink3 font-normal"> · {t('bed', { bed: r.bedNo })}</span> : ''}</span>
        : <span className="text-ink3">{t('source.outside')}</span>,
    },
    {
      key: 'plan', header: t('table.plan'),
      render: (r) => r.current ? (
        <div className="leading-tight min-w-0">
          <div className="text-ink truncate">{r.current.planName} <span aria-hidden className="text-xs">{r.current.meals.map((m) => MEAL_ICONS[m]).join('')}</span></div>
          <div className="text-xs text-ink3 whitespace-nowrap">{shortDate(r.current.endDate)} · {daysLeftLabel(t, r)}</div>
        </div>
      ) : <span className="text-ink3">{t('table.noPlan')}</span>,
    },
    { key: 'diet', header: t('table.diet'), hideBelow: 'lg', render: (r) => <DietTag diet={r.diet} /> },
    { key: 'status', header: t('table.status'), render: (r) => <StatusPill status={r.status} /> },
    {
      key: 'due', header: t('table.due'), align: 'right',
      render: (r) => r.due > 0
        ? <span className="font-semibold text-danger-text tabular-nums">{formatCurrency(r.due)}</span>
        : <span className="text-ink3">—</span>,
    },
    {
      key: 'actions', header: t('table.actions'), actions: true, align: 'right', className: 'w-[1%]',
      render: (r) => canManage ? (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.due > 0 && (
            <Button size="sm" variant="ghost" icon={<LuIndianRupee />} onClick={() => openPay(r)} aria-label={t('pay.collectFrom', { name: r.name })}>
              <span className="hidden xl:inline">{t('pay.collect')}</span>
            </Button>
          )}
          <Button size="sm" icon={<LuRefreshCw />} onClick={() => setSelling(r)} disabled={noPlans}>
            {r.status === 'no_plan' ? t('actions.subscribe') : t('actions.renew')}
          </Button>
        </div>
      ) : null,
    },
  ]

  const primary = view === 'plans'
    ? canManage && { id: 'add-plan', label: t('plans.add'), icon: <LuPlus />, variant: 'primary', onClick: () => setPlanEditing({}) }
    : canManage && { id: 'add', label: t('addCustomer'), icon: <LuPlus />, variant: 'primary', onClick: () => setEditing({}) }

  return (
    <PageWrapper
      title={t('title')}
      subtitle={k ? t('subtitle', { active: k.active, plans: k.activePlans }) : t('subtitleLoading')}
      search={view === 'customers' ? { value: query, onChange: setQuery, placeholder: t('searchPlaceholder') } : null}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: dashLoading, onClick: refreshAll },
        ...VIEWS.map((id) => ({ id: `view-${id}`, label: t(`views.${id}`), icon: VIEW_ICONS[id], variant: 'icon', active: view === id, onClick: () => setView(id) })),
        primary,
      ]}
      stats={kpis.map((kp) => (
        <StatCard key={kp.id} {...kp} loading={!k && dashLoading}
          selected={(kp.id === 'meals' && view === 'meals') || (view === 'customers' && KPI_TARGET[kp.id][1] === tab)}
          onClick={() => onKpi(kp.id)} />
      ))}
    >
      {view === 'dashboard' && (
        <FoodDashboard data={dash} loading={dashLoading} canManage={canManage} noPlans={noPlans}
          onOpen={(r) => setViewingId(r.id)} onRenew={setSelling} onPay={openPay}
          onAddPlan={() => setPlanEditing({})} onAddCustomer={() => setEditing({})} onOpenSheet={() => setView('meals')} />
      )}

      {view === 'meals' && <MealSheet canManage={canManage} onOpen={(p) => setViewingId(p.id)} onChanged={loadDash} />}

      {view === 'customers' && (
        <TableCard
          tabs={CUSTOMER_TABS.map((id) => ({ id, label: c && id !== 'all' && c[id] ? `${t(`tabs.${id}`)} · ${c[id]}` : t(`tabs.${id}`) }))}
          activeTab={tab}
          onTab={(id) => { setTab(id); setPage(1) }}
          error={error}
          pagination={{ page, pageSize: PAGE_SIZE, total: list.total, onChange: setPage, disabled: loading }}
        >
          <DataTable
            columns={columns}
            rows={list.customers}
            loading={loading}
            onRowClick={(r) => setViewingId(r.id)}
            rowClassName={(r) => (r.status === 'expiring' ? 'bg-warning-bg/30' : '')}
            empty={
              <EmptyState icon="🍽" title={search ? t('empty.searchTitle') : t('empty.title')}
                message={search ? t('empty.search') : noPlans ? t('empty.noPlans') : t('empty.message')}
                action={!search && canManage ? (
                  noPlans
                    ? <Button icon={<LuPlus />} onClick={() => setPlanEditing({})}>{t('plans.add')}</Button>
                    : <Button icon={<LuPlus />} onClick={() => setEditing({})}>{t('addCustomer')}</Button>
                ) : null} />
            }
          />
        </TableCard>
      )}

      {view === 'menu' && <WeeklyMenu canManage={canManage} />}

      {view === 'plans' && (
        <PlansView plans={plans} loaded={plansLoaded} canManage={canManage} onEdit={setPlanEditing}
          onToggle={async (p) => {
            if (p.active && !window.confirm(t('plans.retireConfirm', { name: p.name }))) return
            try {
              if (p.active) {
                const { data } = await foodApi.deletePlan(p.id)
                done(data.retired ? t('toast.planRetired', { name: p.name }) : t('toast.planDeleted', { name: p.name }))
              } else {
                await foodApi.updatePlan(p.id, { active: true })
                done(t('toast.planRestored', { name: p.name }))
              }
            } catch (e) { toast(e.response?.data?.message || t('toast.failed'), 'error') }
          }} />
      )}

      {editing && (
        <CustomerModal key={editing.id || 'new'} customer={editing.id ? editing : null} plans={plans}
          onClose={() => setEditing(null)}
          onSaved={(r, wasEdit) => {
            setEditing(null)
            done(wasEdit ? t('toast.updated') : t('toast.added', { name: r.name, no: r.customerNo }))
            if (!wasEdit) { setView('customers'); setTab('all'); setPage(1) }
          }} />
      )}
      {viewingId && (
        <CustomerDetailModal customerId={viewingId} reloadKey={detailKey} canManage={canManage}
          onClose={() => setViewingId(null)}
          onEdit={(r) => setEditing(r)}
          onRenew={(r) => setSelling(r)}
          onPay={(customer, subscription) => setPaying({ customer, subscription })}
          onDelete={(r) => setDeleting(r)}
          onChanged={done} />
      )}
      {selling && (
        <SubscribeModal customer={selling} plans={plans} onClose={() => setSelling(null)}
          onSaved={(msg) => { setSelling(null); done(msg) }} />
      )}
      {paying && (
        <PaymentModal customer={paying.customer} subscription={paying.subscription} onClose={() => setPaying(null)}
          onSaved={(msg) => { setPaying(null); done(msg) }} />
      )}
      {planEditing && (
        <PlanModal plan={planEditing.id ? planEditing : null} onClose={() => setPlanEditing(null)}
          onSaved={(msg) => { setPlanEditing(null); done(msg) }} />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('delete.title')}
        message={deleting && <Trans t={t} i18nKey="delete.message" values={{ name: deleting.name, no: deleting.customerNo }} components={{ b: <strong /> }} />}
        confirmLabel={t('actions.delete')}
        danger
        onConfirm={async () => {
          try {
            await foodApi.removeCustomer(deleting.id)
            setDeleting(null); setViewingId(null)
            done(t('toast.deleted'))
          } catch (e) { toast(e.response?.data?.message || t('toast.failed'), 'error') }
        }}
      />
    </PageWrapper>
  )
}

/** Plan cards: meals, rates, how many eat on it. Retired plans dimmed. */
function PlansView({ plans, loaded, canManage, onEdit, onToggle }) {
  const { t } = useTranslation('food')
  if (!loaded) return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-surface2 animate-pulse" />)}</div>
  if (!plans.length) {
    return (
      <Card>
        <EmptyState icon="🏷️" title={t('plans.emptyTitle')} message={t('plans.emptyMessage')}
          action={canManage ? <Button icon={<LuPlus />} onClick={() => onEdit({})}>{t('plans.add')}</Button> : null} />
      </Card>
    )
  }
  const groups = [['active', plans.filter((p) => p.active)], ['retired', plans.filter((p) => !p.active)]]
  return (
    <div className="space-y-6">
      {groups.map(([g, rows]) => rows.length > 0 && (
        <section key={g}>
          <h3 className="m-0 mb-3 text-[13px] font-semibold text-ink2">{t(`plans.${g}`)} <span className="text-ink3 font-normal">· {rows.length}</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {rows.map((p) => (
              <div key={p.id} className={`relative bg-surface border border-line rounded-xl shadow-soft px-5 pt-5 pb-4 flex flex-col overflow-hidden ${p.active ? '' : 'opacity-70'}`}>
                <span className="absolute inset-x-0 top-0 h-[3px] bg-gold" aria-hidden />
                <div className="text-xs font-semibold text-ink3">{p.meals.map((m) => `${MEAL_ICONS[m]} ${t(`meals.${m}`)}`).join('  ')}</div>
                <div className="mt-1 text-[17px] font-semibold text-ink break-words">{p.name}</div>
                <dl className="m-0 mt-3 space-y-1">
                  {CYCLES.map((cy) => (
                    <div key={cy} className="flex justify-between text-[13px]">
                      <dt className="text-ink3">{t(`cycles.${cy}`)}</dt>
                      <dd className={`m-0 tabular-nums font-medium ${planRate(p, cy) ? 'text-ink' : 'text-ink3'}`}>{planRate(p, cy) ? formatCurrency(planRate(p, cy)) : '—'}</dd>
                    </div>
                  ))}
                </dl>
                {p.description && <p className="m-0 mt-3 text-[13px] text-ink2 line-clamp-3">{p.description}</p>}
                {!planCycles(p).length && <p className="m-0 mt-2 text-xs text-warning-text">{t('plans.noRates')}</p>}
                <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-ink2"><b className="text-ink tabular-nums">{p.subscribers}</b> {t('plans.onPlan')}</span>
                  {canManage && (
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="ghost" icon={<LuPencil />} onClick={() => onEdit(p)} aria-label={t('plans.editTitle')} />
                      <Button size="sm" variant="ghost" icon={p.active ? <LuArchive /> : <LuArchiveRestore />} onClick={() => onToggle(p)}
                        aria-label={p.active ? t('plans.retire') : t('plans.restore')} title={p.active ? t('plans.retire') : t('plans.restore')} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

