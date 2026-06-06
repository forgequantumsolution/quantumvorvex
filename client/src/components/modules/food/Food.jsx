import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
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

const BILLING_LABEL = {
  monthly: 'Monthly',
  weekly:  'Weekly',
  daily:   'Daily',
  none:    'None',
}

const EMPTY_PLAN_FORM = { name: '', desc: '', oneTime: '', weekly: '', monthly: '' }

// ─── Tab 1: Meal Catalog ──────────────────────────────────────────────────────
function MealCatalog({ plans, onCreate, onToggle, onDelete }) {
  const [showAddModal, setShowAddModal] = useState(false)
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
      {/* Header row */}
      <div className="flex justify-end mb-4">
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          + Add Meal Plan
        </button>
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[13px]">
        {plans.map(plan => {
          const sel = billingSelect[plan.id] || 'monthly'
          return (
            <div
              key={plan.id}
              className="card relative"
              style={{ opacity: plan.active ? 1 : 0.6 }}
            >
              {/* Active toggle top-right */}
              <div
                className="absolute top-[11px] right-[11px] cursor-pointer"
                onClick={() => handleToggleActive(plan)}
                title={plan.active ? 'Click to deactivate' : 'Click to activate'}
              >
                <Badge type={plan.active ? 'green' : 'grey'}>
                  {plan.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="card-body pt-[14px]">
                {/* Plan name */}
                <p className="t-title m-0 mb-1 pr-[60px]">
                  {plan.name}
                </p>

                {/* Description */}
                <p className="t-xs m-0 mb-3 text-ink3 leading-[1.5] min-h-[34px]">
                  {plan.desc}
                </p>

                {/* Pricing rows */}
                <div className="flex flex-col gap-[5px] mb-3">
                  {[
                    ['One-time', plan.oneTime],
                    ['Weekly',   plan.weekly],
                    ['Monthly',  plan.monthly],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="t-xs text-ink3">{label}</span>
                      <span
                        className="text-[12px] font-medium"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: val > 0 ? 'var(--text)' : 'var(--text3)',
                        }}
                      >
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
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <button
                    className="btn btn-danger btn-xs flex-1"
                    onClick={() => handleDelete(plan.id, plan.name)}
                  >
                    Delete
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
        title="Add Meal Plan"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowAddModal(false); setForm(EMPTY_PLAN_FORM) }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAdd}>
              Add Plan
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="form-label block mb-[5px]">Plan Name</label>
            <input
              className="form-input w-full"
              placeholder="e.g. Breakfast Only"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label block mb-[5px]">Description</label>
            <textarea
              className="form-textarea w-full min-h-[72px] resize-y"
              placeholder="Brief description of meals included"
              value={form.desc}
              onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['One-time ₹', 'oneTime'],
              ['Weekly ₹',   'weekly'],
              ['Monthly ₹',  'monthly'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="form-label block mb-[5px]">{label}</label>
                <input
                  className="form-input"
                  type="number"
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
  const addToast = useToast()

  return (
    <div className="overflow-x-auto">
      {orders.length === 0 ? (
        <div className="empty-state">
          <p className="m-0 font-semibold text-ink2">No active orders</p>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Room', 'Guest', 'Meal Plan', 'Billing', 'Amount', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left px-3 py-[9px] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td className="px-3 py-2.5">
                  <span className="text-[13px] font-semibold text-gold" style={{ fontFamily: 'var(--font-mono)' }}>
                    {order.room}
                  </span>
                </td>
                <td className="t-sm px-3 py-2.5 font-medium">
                  {order.guest}
                </td>
                <td className="t-title px-3 py-2.5">
                  {order.plan}
                </td>
                <td className="px-3 py-2.5">
                  <Badge type={BILLING_BADGE[order.billing] || 'grey'}>
                    {BILLING_LABEL[order.billing] || order.billing}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {order.amount > 0 ? formatCurrency(order.amount) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge type="green">{order.status}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => addToast(`Reminder sent to ${order.guest}`, 'success')}
                  >
                    Remind
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Tab 3: Revenue ───────────────────────────────────────────────────────────
function Revenue({ orders, plans }) {
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

  const totalRevenue   = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const activeCount    = orders.filter(o => o.status === 'Active' && o.billing !== 'none').length
  const avgPerGuest    = activeCount > 0 ? Math.round(totalRevenue / activeCount) : 0

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="t-xs bg-surface border border-line rounded-md px-3 py-2 text-ink shadow-[var(--shadow)]">
        <p className="m-0 font-semibold">{payload[0]?.payload?.fullName}</p>
        <p className="m-0 mt-[3px]" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(payload[0]?.value)}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Stat summary row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-6">
        <div className="stat-card stat-bar-gold">
          <p className="t-label m-0 mb-1">
            Total Food Revenue
          </p>
          <p className="t-h1 m-0 text-gold">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="m-0 mt-[3px] text-[11px] text-ink3">This month</p>
        </div>

        <div className="stat-card stat-bar-blue">
          <p className="t-label m-0 mb-1">
            Active Subscribers
          </p>
          <p className="t-h1 m-0 text-info">
            {activeCount}
          </p>
          <p className="m-0 mt-[3px] text-[11px] text-ink3">Guests on meal plan</p>
        </div>

        <div className="stat-card stat-bar-purple">
          <p className="t-label m-0 mb-1">
            Avg per Guest
          </p>
          <p className="t-h1 m-0 text-violet">
            {formatCurrency(avgPerGuest)}
          </p>
          <p className="m-0 mt-[3px] text-[11px] text-ink3">Per active subscriber</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card px-5 py-[18px]">
        <p className="t-title m-0 mb-4">
          Revenue by Meal Plan
        </p>

        {revenueByPlan.length === 0 ? (
          <div className="empty-state h-[220px] flex items-center justify-center">
            <p className="t-sm m-0 text-ink3">No revenue data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByPlan} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--gold-bg)' }} />
              <Bar dataKey="revenue" fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'catalog', label: 'Meal Catalog' },
  { id: 'orders',  label: 'Active Orders' },
  { id: 'revenue', label: 'Revenue' },
]

export default function Food() {
  const addToast = useToast()
  const [activeTab, setActiveTab] = useState('catalog')
  const [plans, setPlans]         = useState([])
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [plansRes, ordersRes] = await Promise.all([foodApi.getPlans(), foodApi.getOrders()])
      const normPlans = (plansRes.data.foodPlans || []).map(normalizePlan)
      const planByName = Object.fromEntries(normPlans.map(p => [p.name, p]))
      setPlans(normPlans)
      setOrders((ordersRes.data.guests || []).map(g => normalizeOrder(g, planByName)))
    } catch {
      setError('Could not load food data. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (planData) => {
    try {
      await foodApi.createPlan(planData)
      addToast(`Meal plan "${planData.name}" added`, 'success')
      load()
      return true
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not add meal plan', 'error')
      return false
    }
  }

  const handleToggle = async (id, active) => {
    setPlans(ps => ps.map(p => p.id === id ? { ...p, active } : p))
    try {
      await foodApi.updatePlan(id, { active })
    } catch {
      setPlans(ps => ps.map(p => p.id === id ? { ...p, active: !active } : p))
      addToast('Could not update plan', 'error')
    }
  }

  const handleDelete = async (id, name) => {
    try {
      await foodApi.deletePlan(id)
      addToast(`"${name}" removed`, 'info')
      load()
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not delete plan', 'error')
    }
  }

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="mb-[22px] flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold m-0 text-ink tracking-[-0.03em]">
            Food Options
          </h1>
          <p className="t-sm mt-[3px] text-ink3">
            Meal plans, active orders, and food revenue
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      {error && (
        <div className="t-sm mb-4 px-[14px] py-2.5 rounded-lg bg-danger-bg text-danger-text">
          {error}
        </div>
      )}

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="catalog">
          <MealCatalog plans={plans} onCreate={handleCreate} onToggle={handleToggle} onDelete={handleDelete} />
        </div>
        <div data-tab-id="orders">
          <ActiveOrders orders={orders} />
        </div>
        <div data-tab-id="revenue">
          <Revenue orders={orders} plans={plans} />
        </div>
      </Tabs>
    </div>
  )
}
