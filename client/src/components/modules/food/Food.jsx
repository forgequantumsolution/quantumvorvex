import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { LuIndianRupee, LuUsers, LuUtensils, LuRefreshCw, LuPlus } from 'react-icons/lu'
import { PageWrapper, Card, DataTable, EmptyState, StatCard } from '../../ui-tw'
import { useToast } from '../../../hooks/useToast'
import { foodApi } from '../../../api/client'
import { formatCurrency } from '../../../utils/format'

// Flatten an API food plan to the UI shape.
const normalizePlan = (p) => ({
  id: p.id,
  name: p.name,
  desc: p.description || '',
  oneTime: p.oneTimeRate || 0,
  weekly: p.weeklyRate || 0,
  monthly: p.monthlyRate || 0,
  active: p.active !== false,
})

// Build an "order" row from an active guest on a food plan, pricing it from
// the matching plan's monthly rate.
const normalizeOrder = (g, planByName) => {
  const plan = planByName[g.foodPlan]
  return {
    id: g.id,
    room: g.room?.number || '—',
    guest: g.name,
    plan: g.foodPlan,
    billing: g.stayType === 'monthly' ? 'monthly' : 'daily',
    amount: plan ? (g.stayType === 'monthly' ? plan.monthly : plan.oneTime) : 0,
    status: 'Active',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BILLING_BADGE = {
  monthly: 'purple',
  weekly:  'amber',
  daily:   'blue',
  none:    'grey',
}

// Billing display labels: locales/*/food.json → billing.<type>

const EMPTY_PLAN_FORM = { name: '', desc: '', oneTime: '', weekly: '', monthly: '' }

// ─── Tab 1: Meal Catalog ──────────────────────────────────────────────────────
// The "Add meal plan" button lives in the page header (Food), which owns the
// modal's open state.
function MealCatalog({ plans, onCreate, onToggle, onDelete, showAddModal, setShowAddModal }) {
  const { t } = useTranslation('food')
  const [form, setForm]                 = useState(EMPTY_PLAN_FORM)
  const [billingSelect, setBillingSelect] = useState({})

  const handleAdd = async () => {
    if (!form.name.trim()) return
    const ok = await onCreate({
      name: form.name.trim(),
      description: form.desc.trim(),
      oneTimeRate: parseFloat(form.oneTime) || 0,
      weeklyRate: parseFloat(form.weekly) || 0,
      monthlyRate: parseFloat(form.monthly) || 0,
    })
    if (ok) {
      setForm(EMPTY_PLAN_FORM)
      setShowAddModal(false)
    }
  }

  const handleToggleActive = (plan) => onToggle(plan.id, !plan.active)
  const handleDelete = (id, name) => onDelete(id, name)

  const setBilling = (planId, type) => {
    setBillingSelect(prev => ({ ...prev, [planId]: type }))
  }

  return (
    <div>
      <p className="t-sm m-0 mb-4 text-ink3">{t('planCount', { count: plans.length })}</p>

      {plans.length === 0 && (
        <div className="bg-surface border border-line rounded-xl">
          <EmptyState
            icon="🍽"
            title={t('empty.noPlans')}
            message={t('empty.noPlansHint')}
          />
        </div>
      )}

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
        {plans.map(plan => {
          const sel = billingSelect[plan.id] || 'monthly'
          return (
            <div
              key={plan.id}
              className={`card relative flex flex-col min-w-0 ${plan.active ? '' : 'opacity-60'}`}
            >
              <div className="card-body pt-[14px] flex flex-col flex-1">
                {/* Plan name + active toggle */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="t-title m-0 min-w-0 break-words">
                    {plan.name}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 -my-1 -mr-1 p-1 rounded-md inline-flex items-center pointer-coarse:min-h-11"
                    onClick={() => handleToggleActive(plan)}
                    title={plan.active ? t('clickDeactivate') : t('clickActivate')}
                    aria-pressed={plan.active}
                  >
                    <Badge type={plan.active ? 'green' : 'grey'}>
                      {plan.active ? t('common:active') : t('common:inactive')}
                    </Badge>
                  </button>
                </div>

                {/* Description */}
                <p className="t-xs m-0 mb-3 text-ink3 leading-[1.5] min-h-[34px]">
                  {plan.desc}
                </p>

                {/* Pricing rows */}
                <div className="flex flex-col gap-[5px] mb-3">
                  {[
                    ['one-time', plan.oneTime],
                    ['weekly',   plan.weekly],
                    ['monthly',  plan.monthly],
                  ].map(([type, val]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="t-xs text-ink3">{t(`billing.${type}`)}</span>
                      <span className={`text-[12px] font-medium font-mono ${val > 0 ? 'text-ink' : 'text-ink3'}`}>
                        {val > 0 ? formatCurrency(val) : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Billing type toggle */}
                <div className="flex gap-[5px] mb-[13px] flex-wrap">
                  {['one-time', 'weekly', 'monthly'].map(type => (
                    <button
                      key={type}
                      className={`food-opt${sel === type ? ' sel' : ''}`}
                      onClick={() => setBilling(plan.id, type)}
                    >
                      {t(`billing.${type}`)}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 mt-auto">
                  <button
                    className="btn btn-danger btn-xs flex-1 justify-center"
                    onClick={() => handleDelete(plan.id, plan.name)}
                  >
                    {t('common:delete')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Meal Plan Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setForm(EMPTY_PLAN_FORM) }}
        title={t('form.title')}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowAddModal(false); setForm(EMPTY_PLAN_FORM) }}>
              {t('common:cancel')}
            </button>
            <button className="btn btn-primary" onClick={handleAdd}>
              {t('form.add')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="form-label block mb-[5px]">{t('form.name')}</label>
            <input
              className="form-input w-full"
              placeholder={t('form.namePlaceholder')}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label block mb-[5px]">{t('form.description')}</label>
            <textarea
              className="form-textarea w-full min-h-[72px] resize-y"
              placeholder={t('form.descriptionPlaceholder')}
              value={form.desc}
              onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['one-time', 'oneTime'],
              ['weekly',   'weekly'],
              ['monthly',  'monthly'],
            ].map(([type, key]) => (
              <div key={key}>
                <label className="form-label block mb-[5px]">{t(`billing.${type}`)} ₹</label>
                <input
                  className="form-input w-full"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Tab 2: Active Orders ─────────────────────────────────────────────────────
function ActiveOrders({ orders }) {
  const { t } = useTranslation('food')
  const addToast = useToast()

  return (
    <Card title={t('tabs.orders')} subtitle={t('guestsOnPlan', { count: orders.length })}>
      <DataTable
        rows={orders}
        rowKey={(o) => o.id}
        empty={<EmptyState icon="🍽" title={t('empty.noOrders')} />}
        columns={[
          {
            key: 'room', header: t('common:room'), mobileLabel: t('common:room'),
            render: (o) => <span className="text-[13px] font-semibold text-gold font-mono">{o.room}</span>,
          },
          { key: 'guest', header: t('common:guest'), primary: true, render: (o) => <span className="font-medium">{o.guest}</span> },
          { key: 'plan', header: t('orders.plan'), render: (o) => <span className="t-title">{o.plan}</span> },
          {
            key: 'billing', header: t('orders.billing'),
            render: (o) => (
              <Badge type={BILLING_BADGE[o.billing] || 'grey'}>
                {t(`billing.${o.billing}`, o.billing)}
              </Badge>
            ),
          },
          {
            key: 'amount', header: t('common:amount'),
            render: (o) => <span className="text-[13px] font-mono">{o.amount > 0 ? formatCurrency(o.amount) : '—'}</span>,
          },
          { key: 'status', header: t('common:status'), primary: true, render: (o) => <Badge type="green">{o.status === 'Active' ? t('common:active') : o.status}</Badge> },
          {
            key: 'action', header: t('orders.action'), actions: true,
            render: (o) => (
              <button
                className="btn btn-outline btn-xs"
                onClick={() => addToast(t('toast.reminderSent', { guest: o.guest }), 'success')}
              >
                {t('orders.remind')}
              </button>
            ),
          },
        ]}
      />
    </Card>
  )
}

// ─── Tab 3: Revenue ───────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="t-xs bg-surface border border-line rounded-md px-3 py-2 text-ink shadow-[var(--shadow)]">
      <p className="m-0 font-semibold">{payload[0]?.payload?.fullName}</p>
      <p className="m-0 mt-[3px] font-mono">
        {formatCurrency(payload[0]?.value)}
      </p>
    </div>
  )
}

// Summary figures shown in the page's KPI strip.
function foodTotals(orders) {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const activeCount  = orders.filter(o => o.status === 'Active' && o.billing !== 'none').length
  const avgPerGuest  = activeCount > 0 ? Math.round(totalRevenue / activeCount) : 0
  return { totalRevenue, activeCount, avgPerGuest }
}

function Revenue({ orders, plans }) {
  const { t } = useTranslation('food')
  // Derive revenue per plan from orders
  const revenueByPlan = plans
    .filter(p => p.name !== 'No Meals')
    .map(plan => {
      const planOrders = orders.filter(o => o.plan === plan.name)
      const total = planOrders.reduce((sum, o) => sum + (o.amount || 0), 0)
      // Abbreviate long names
      const shortName = plan.name.length > 12
        ? plan.name.split(' ').map(w => w[0]).join('')
        : plan.name.split(' ')[0]
      return { name: shortName, fullName: plan.name, revenue: total }
    })
    .filter(d => d.revenue > 0)

  return (
    <div>
      {/* Bar chart */}
      <Card title={t('revenue.byPlan')}>
        {revenueByPlan.length === 0 ? (
          <div className="h-[180px] sm:h-[220px] flex items-center justify-center px-4">
            <p className="t-sm m-0 text-ink3">{t('revenue.noData')}</p>
          </div>
        ) : (
          <div className="px-1 sm:px-3 pt-4 pb-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByPlan} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={44}
                  tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--gold-bg)' }} />
                <Bar dataKey="revenue" fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TABS = ['catalog', 'orders', 'revenue']

export default function Food() {
  const { t } = useTranslation('food')
  const addToast = useToast()
  const [activeTab, setActiveTab] = useState('catalog')
  const [showAddModal, setShowAddModal] = useState(false)
  const [plans, setPlans]         = useState([])
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const [plansRes, ordersRes] = await Promise.all([foodApi.getPlans(), foodApi.getOrders()])
      const normPlans = (plansRes.data.foodPlans || []).map(normalizePlan)
      const planByName = Object.fromEntries(normPlans.map(p => [p.name, p]))
      setPlans(normPlans)
      setOrders((ordersRes.data.guests || []).map(g => normalizeOrder(g, planByName)))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (planData) => {
    try {
      await foodApi.createPlan(planData)
      addToast(t('toast.added', { name: planData.name }), 'success')
      load()
      return true
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.addFailed'), 'error')
      return false
    }
  }

  const handleToggle = async (id, active) => {
    setPlans(ps => ps.map(p => p.id === id ? { ...p, active } : p))
    try {
      await foodApi.updatePlan(id, { active })
    } catch {
      setPlans(ps => ps.map(p => p.id === id ? { ...p, active: !active } : p))
      addToast(t('toast.updateFailed'), 'error')
    }
  }

  const handleDelete = async (id, name) => {
    try {
      await foodApi.deletePlan(id)
      addToast(t('toast.removed', { name }), 'info')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || t('toast.deleteFailed'), 'error')
    }
  }

  const { totalRevenue, activeCount, avgPerGuest } = foodTotals(orders)

  return (
    <PageWrapper
      title={t('title')}
      subtitle={t('subtitle')}
      search={null}
      stats={(
        <>
          {/* Each card opens the tab that breaks its figure down. */}
          {[
            { id: 'total', tab: 'revenue', icon: <LuIndianRupee />, tone: 'gold', label: t('revenue.total'), value: formatCurrency(totalRevenue), hint: t('revenue.thisMonth') },
            { id: 'subscribers', tab: 'orders', icon: <LuUsers />, tone: 'blue', label: t('revenue.subscribers'), value: activeCount, hint: t('revenue.subscribersHint') },
            // Same tab as Food revenue, so only that card shows as selected.
            { id: 'avg', tab: 'revenue', icon: <LuUtensils />, tone: 'purple', label: t('revenue.avg'), value: formatCurrency(avgPerGuest), hint: t('revenue.avgHint'), primary: false },
          ].map(({ id, tab, primary = true, ...k }) => (
            <StatCard key={id} {...k} selected={primary && activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </>
      )}
      headerActions={[
        { id: 'refresh', label: t('common:refresh'), icon: <LuRefreshCw />, variant: 'icon', disabled: loading, onClick: load },
        // The form lives on the catalog tab, so open it there from any tab.
        { id: 'add', label: t('addPlan'), icon: <LuPlus />, variant: 'primary', onClick: () => { setActiveTab('catalog'); setShowAddModal(true) } },
      ]}
    >
      {error && (
        <div className="t-sm mb-4 px-3.5 py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {t('loadFailed')}
        </div>
      )}

      <Tabs tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="catalog">
          <MealCatalog plans={plans} onCreate={handleCreate} onToggle={handleToggle} onDelete={handleDelete}
            showAddModal={showAddModal} setShowAddModal={setShowAddModal} />
        </div>
        <div data-tab-id="orders">
          <ActiveOrders orders={orders} />
        </div>
        <div data-tab-id="revenue">
          <Revenue orders={orders} plans={plans} />
        </div>
      </Tabs>
    </PageWrapper>
  )
}
