import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  LuPlus, LuRefreshCw, LuLayoutDashboard, LuUsers, LuTags, LuUserCheck, LuClock, LuIndianRupee, LuUserPlus,
  LuRepeat, LuWallet, LuBedDouble, LuPencil, LuArchive, LuArchiveRestore,
} from 'react-icons/lu'
import { PageWrapper, StatCard, TableCard, DataTable, Button, EmptyState, Card } from '../../ui-tw'
import ConfirmModal from '../../ui/ConfirmModal'
import GymDashboard from './GymDashboard'
import MemberModal from './MemberModal'
import MemberDetailModal, { StatusPill } from './MemberDetailModal'
import { SellPlanModal, PaymentModal, PlanModal } from './GymModals'
import { useToast } from '../../../hooks/useToast'
import { useCan } from '../../../hooks/useCan'
import { gymApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'
import { MEMBER_TABS, daysLeftLabel, durationLabel, shortDate, initials } from './gymUtils'

const PAGE_SIZE = 25
const VIEWS = ['dashboard', 'members', 'plans']
const VIEW_ICONS = { dashboard: <LuLayoutDashboard />, members: <LuUsers />, plans: <LuTags /> }

/**
 * Gym: members, membership plans, renewals and dues, with a dashboard.
 * Three views in the header toggle — Dashboard · Members · Plans. The KPI strip
 * stays on top; tapping a KPI opens the matching member list.
 */
export default function Gym() {
  const { t } = useTranslation('gym')
  const toast = useToast()
  const canManage = useCan('gym', 'MANAGE')

  const [view, setView] = useState('dashboard')
  const [dash, setDash] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ members: [], total: 0, counts: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(null)       // {} = new member
  const [viewingId, setViewingId] = useState(null)
  const [detailKey, setDetailKey] = useState(0)      // bump to reload the open member
  const [selling, setSelling] = useState(null)       // member to renew / sell a plan to
  const [paying, setPaying] = useState(null)         // { member, membership }
  const [planEditing, setPlanEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const reqId = useRef(0)

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const loadDash = useCallback(async () => {
    setDashLoading(true)
    try { const { data } = await gymApi.dashboard(); setDash(data) } catch { /* KPI cards show — */ } finally { setDashLoading(false) }
  }, [])
  const loadPlans = useCallback(async () => {
    try { const { data } = await gymApi.plans(); setPlans(data.plans) } catch { /* plans stay as they were */ } finally { setPlansLoaded(true) }
  }, [])
  const loadMembers = useCallback(async ({ quiet } = {}) => {
    const id = ++reqId.current
    if (!quiet) setLoading(true)
    try {
      const { data } = await gymApi.members({ tab, search, page, pageSize: PAGE_SIZE })
      if (id === reqId.current) { setList(data); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e.response?.data?.message || t('toast.failed'))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, search, page, t])

  useEffect(() => { loadDash(); loadPlans() }, [loadDash, loadPlans])
  useEffect(() => { if (view === 'members') loadMembers() }, [view, loadMembers])

  const refreshAll = () => { loadDash(); loadPlans(); if (view === 'members') loadMembers({ quiet: true }); setDetailKey((k) => k + 1) }
  const done = (msg) => { if (msg) toast(msg); refreshAll() }

  const openTab = (id) => { setView('members'); setTab(id); setPage(1) }
  const openPay = async (m) => {
    // From a list row we only have the member: find the plan that has dues.
    try {
      const { data } = await gymApi.member(m.id)
      const ms = data.member.memberships.find((x) => x.due > 0)
      if (ms) setPaying({ member: data.member, membership: ms })
    } catch { toast(t('toast.failed'), 'error') }
  }

  const k = dash?.kpis
  const kpis = [
    { id: 'active', icon: <LuUserCheck />, tone: 'green', label: t('kpi.active'), value: k?.active ?? '—',
      hint: k ? t('kpi.activeHint', { total: k.total }) : undefined, progress: k?.total ? (k.active / k.total) * 100 : undefined },
    { id: 'expiring', icon: <LuClock />, tone: 'amber', label: t('kpi.expiring'), value: k?.expiring ?? '—',
      hint: k ? t('kpi.expiringHint', { count: k.expiredRecently }) : undefined },
    { id: 'revenue', icon: <LuIndianRupee />, tone: 'gold', label: t('kpi.revenue'), value: k ? formatCurrency(k.revenueThisMonth) : '—',
      trend: k?.revenueTrend ?? undefined, hint: k ? t('kpi.revenueHint', { amount: formatCurrency(k.revenueLastMonth) }) : undefined },
    { id: 'dues', icon: <LuWallet />, tone: 'red', label: t('kpi.dues'), value: k ? formatCurrency(k.duesAmount) : '—',
      hint: k ? t('kpi.duesHint', { count: k.duesMembers }) : undefined },
    { id: 'new', icon: <LuUserPlus />, tone: 'blue', label: t('kpi.new'), value: k?.newThisMonth ?? '—', hint: t('kpi.newHint') },
    { id: 'renewal', icon: <LuRepeat />, tone: 'purple', label: t('kpi.renewal'), value: k?.renewalRate == null ? '—' : `${k.renewalRate}%`,
      hint: k ? (k.renewalBase ? t('kpi.renewalHint', { count: k.renewalBase }) : t('kpi.renewalNone')) : undefined },
  ]
  const KPI_TAB = { active: 'active', expiring: 'expiring', dues: 'dues', new: 'all', renewal: 'expired' }

  const noPlans = plansLoaded && !plans.some((p) => p.active)
  const c = list.counts

  const columns = [
    {
      key: 'member', header: t('table.member'), primary: true,
      render: (m) => (
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden className="hidden sm:flex w-9 h-9 shrink-0 rounded-full bg-gold-bg text-gold items-center justify-center text-xs font-bold">{initials(m.name)}</span>
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-ink truncate flex items-center gap-1.5">
              {m.name}
              {m.guestId && <LuBedDouble size={13} className="text-violet-text shrink-0" aria-label={t('sources.guest')} />}
            </div>
            <div className="text-xs text-ink3 truncate"><span className="text-gold font-mono">{m.memberNo}</span> · {m.phone}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'plan', header: t('table.plan'),
      render: (m) => m.current ? (
        <div className="leading-tight min-w-0">
          <div className="text-ink truncate">{m.current.planName}</div>
          <div className="text-xs text-ink3 whitespace-nowrap">{shortDate(m.current.endDate)} · {daysLeftLabel(t, m)}</div>
        </div>
      ) : <span className="text-ink3">{t('table.noPlan')}</span>,
    },
    { key: 'status', header: t('table.status'), render: (m) => <StatusPill status={m.status} /> },
    {
      key: 'due', header: t('table.due'), align: 'right',
      render: (m) => m.due > 0
        ? <span className="font-semibold text-danger-text tabular-nums">{formatCurrency(m.due)}</span>
        : <span className="text-ink3">—</span>,
    },
    { key: 'joined', header: t('table.joined'), hideBelow: 'lg', render: (m) => <span className="text-ink2 whitespace-nowrap">{shortDate(m.joinedAt)}</span> },
    {
      key: 'actions', header: t('table.actions'), actions: true, align: 'right', className: 'w-[1%]',
      render: (m) => canManage ? (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {m.due > 0 && (
            <Button size="sm" variant="ghost" icon={<LuIndianRupee />} onClick={() => openPay(m)} aria-label={t('pay.collectFrom', { name: m.name })}>
              <span className="hidden xl:inline">{t('pay.collect')}</span>
            </Button>
          )}
          <Button size="sm" icon={<LuRefreshCw />} onClick={() => setSelling(m)} disabled={noPlans}>
            {m.status === 'no_plan' ? t('actions.sellPlan') : t('actions.renew')}
          </Button>
        </div>
      ) : null,
    },
  ]

  const primary = view === 'plans'
    ? canManage && { id: 'add-plan', label: t('plans.add'), icon: <LuPlus />, variant: 'primary', onClick: () => setPlanEditing({}) }
    : canManage && { id: 'add', label: t('addMember'), icon: <LuPlus />, variant: 'primary', onClick: () => setEditing({}) }

  return (
    <PageWrapper
      title={t('title')}
      subtitle={k ? t('subtitle', { active: k.active, plans: k.activePlans }) : t('subtitleLoading')}
      search={view === 'members' ? { value: query, onChange: setQuery, placeholder: t('searchPlaceholder') } : null}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: dashLoading, onClick: refreshAll },
        ...VIEWS.map((id) => ({ id: `view-${id}`, label: t(`views.${id}`), icon: VIEW_ICONS[id], variant: 'icon', active: view === id, onClick: () => setView(id) })),
        primary,
      ]}
      stats={kpis.map((kp) => (
        <StatCard key={kp.id} {...kp} loading={!k && dashLoading}
          selected={view === 'members' && KPI_TAB[kp.id] === tab && kp.id !== 'new' && kp.id !== 'renewal'}
          onClick={KPI_TAB[kp.id] ? () => openTab(KPI_TAB[kp.id]) : () => setView('dashboard')} />
      ))}
    >
      {view === 'dashboard' && (
        <GymDashboard data={dash} loading={dashLoading} canManage={canManage} noPlans={noPlans}
          onOpen={(m) => setViewingId(m.id)} onRenew={setSelling} onPay={openPay}
          onAddPlan={() => setPlanEditing({})} onAddMember={() => setEditing({})} />
      )}

      {view === 'members' && (
        <TableCard
          tabs={MEMBER_TABS.map((id) => ({ id, label: c && id !== 'all' && c[id] ? `${t(`tabs.${id}`)} · ${c[id]}` : t(`tabs.${id}`) }))}
          activeTab={tab}
          onTab={(id) => { setTab(id); setPage(1) }}
          error={error}
          pagination={{ page, pageSize: PAGE_SIZE, total: list.total, onChange: setPage, disabled: loading }}
        >
          <DataTable
            columns={columns}
            rows={list.members}
            loading={loading}
            onRowClick={(m) => setViewingId(m.id)}
            rowClassName={(m) => (m.status === 'expiring' ? 'bg-warning-bg/30' : '')}
            empty={
              <EmptyState icon="🏋️" title={search ? t('empty.searchTitle') : t('empty.title')}
                message={search ? t('empty.search') : noPlans ? t('empty.noPlans') : t('empty.message')}
                action={!search && canManage ? (
                  noPlans
                    ? <Button icon={<LuPlus />} onClick={() => setPlanEditing({})}>{t('plans.add')}</Button>
                    : <Button icon={<LuPlus />} onClick={() => setEditing({})}>{t('addMember')}</Button>
                ) : null} />
            }
          />
        </TableCard>
      )}

      {view === 'plans' && (
        <PlansView plans={plans} loaded={plansLoaded} canManage={canManage} onEdit={setPlanEditing}
          onToggle={async (p) => {
            if (p.active && !window.confirm(t('plans.retireConfirm', { name: p.name }))) return
            try {
              if (p.active) {
                const { data } = await gymApi.removePlan(p.id)
                done(data.retired ? t('toast.planRetired', { name: p.name }) : t('toast.planDeleted', { name: p.name }))
              } else {
                await gymApi.updatePlan(p.id, { name: p.name, durationDays: p.durationDays, price: p.price, description: p.description, active: true })
                done(t('toast.planRestored', { name: p.name }))
              }
            } catch (e) { toast(e.response?.data?.message || t('toast.failed'), 'error') }
          }} />
      )}

      {editing && (
        <MemberModal key={editing.id || 'new'} member={editing.id ? editing : null} plans={plans}
          onClose={() => setEditing(null)}
          onSaved={(m, wasEdit) => {
            setEditing(null)
            done(wasEdit ? t('toast.updated') : t('toast.added', { name: m.name, no: m.memberNo }))
            if (!wasEdit) { setView('members'); setTab('all'); setPage(1) }
          }} />
      )}
      {viewingId && (
        <MemberDetailModal memberId={viewingId} reloadKey={detailKey} canManage={canManage}
          onClose={() => setViewingId(null)}
          onEdit={(m) => setEditing(m)}
          onRenew={(m) => setSelling(m)}
          onPay={(member, membership) => setPaying({ member, membership })}
          onDelete={(m) => setDeleting(m)}
          onChanged={done} />
      )}
      {selling && (
        <SellPlanModal member={selling} plans={plans} onClose={() => setSelling(null)}
          onSaved={(msg) => { setSelling(null); done(msg) }} />
      )}
      {paying && (
        <PaymentModal member={paying.member} membership={paying.membership} onClose={() => setPaying(null)}
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
        message={deleting && <Trans t={t} i18nKey="delete.message" values={{ name: deleting.name, no: deleting.memberNo }} components={{ b: <strong /> }} />}
        confirmLabel={t('actions.delete')}
        danger
        onConfirm={async () => {
          try {
            await gymApi.removeMember(deleting.id)
            setDeleting(null); setViewingId(null)
            done(t('toast.deleted'))
          } catch (e) { toast(e.response?.data?.message || t('toast.failed'), 'error') }
        }}
      />
    </PageWrapper>
  )
}

/** Plan cards: price, length, monthly equivalent, members on it. Retired plans dimmed. */
function PlansView({ plans, loaded, canManage, onEdit, onToggle }) {
  const { t } = useTranslation('gym')
  if (!loaded) return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-44 rounded-xl bg-surface2 animate-pulse" />)}</div>
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
            {rows.map((p) => {
              const perMonth = p.durationDays > 30 ? Math.round((p.price / p.durationDays) * 30) : null
              return (
                <div key={p.id} className={`relative bg-surface border border-line rounded-xl shadow-soft px-5 pt-5 pb-4 flex flex-col overflow-hidden ${p.active ? '' : 'opacity-70'}`}>
                  <span className="absolute inset-x-0 top-0 h-[3px] bg-gold" aria-hidden />
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink3">{durationLabel(t, p.durationDays)}</div>
                  <div className="mt-1 text-[17px] font-semibold text-ink break-words">{p.name}</div>
                  <div className="mt-2 text-[26px] font-bold text-ink tabular-nums leading-none">{formatCurrency(p.price)}</div>
                  <div className="mt-1 text-xs text-ink3 min-h-4">{perMonth ? t('plans.perMonth', { amount: formatCurrency(perMonth) }) : ' '}</div>
                  {p.description && <p className="m-0 mt-3 text-[13px] text-ink2 line-clamp-3">{p.description}</p>}
                  <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                    <span className="text-xs text-ink2"><b className="text-ink tabular-nums">{p.activeMembers}</b> {t('plans.onPlan')}</span>
                    {canManage && (
                      <span className="flex gap-1.5">
                        <Button size="sm" variant="ghost" icon={<LuPencil />} onClick={() => onEdit(p)} aria-label={t('plans.editTitle')} />
                        <Button size="sm" variant="ghost" icon={p.active ? <LuArchive /> : <LuArchiveRestore />} onClick={() => onToggle(p)}
                          aria-label={p.active ? t('plans.retire') : t('plans.restore')} title={p.active ? t('plans.retire') : t('plans.restore')} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
