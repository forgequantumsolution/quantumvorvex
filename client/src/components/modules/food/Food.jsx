import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Modal from '../../ui/Modal'
import Badge from '../../ui/Badge'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../../hooks/useToast'
import { formatCurrency } from '../../../utils/format'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PLANS = [
  { id: '1', name: 'Breakfast Only', desc: 'Morning meal — Idli, Dosa, Poha or Bread + Tea', oneTime: 120, weekly: 700, monthly: 2500, active: true },
  { id: '2', name: 'All Meals', desc: 'Breakfast + Lunch + Dinner — Full board', oneTime: 350, weekly: 2100, monthly: 8000, active: true },
  { id: '3', name: 'Dinner Only', desc: 'Evening meal — Rice, Dal, Sabji, Roti', oneTime: 180, weekly: 1050, monthly: 3500, active: true },
  { id: '4', name: 'Lunch Only', desc: 'Afternoon meal — Thali with 3 items', oneTime: 150, weekly: 900, monthly: 3000, active: true },
  { id: '5', name: 'No Meals', desc: 'Self-catering option', oneTime: 0, weekly: 0, monthly: 0, active: true },
]

const MOCK_ORDERS = [
  { id: '1', room: '102', guest: 'Rahul Sharma', plan: 'Breakfast Only', billing: 'monthly', amount: 2500, status: 'Active' },
  { id: '2', room: '205', guest: 'Priya Patel', plan: 'All Meals', billing: 'daily', amount: 350, status: 'Active' },
  { id: '3', room: '312', guest: 'Ankit Singh', plan: 'No Meals', billing: 'none', amount: 0, status: 'Active' },
  { id: '4', room: '204', guest: 'Neha Gupta', plan: 'Dinner Only', billing: 'weekly', amount: 1050, status: 'Active' },
]

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
function MealCatalog({ plans, onPlansChange }) {
  const addToast = useToast()
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm]                 = useState(EMPTY_PLAN_FORM)
  const [billingSelect, setBillingSelect] = useState(() =>
    Object.fromEntries(plans.map(p => [p.id, 'monthly']))
  )

  const handleAdd = () => {
    if (!form.name.trim()) return
    const newPlan = {
      id:      Date.now().toString(),
      name:    form.name.trim(),
      desc:    form.desc.trim(),
      oneTime: parseFloat(form.oneTime) || 0,
      weekly:  parseFloat(form.weekly)  || 0,
      monthly: parseFloat(form.monthly) || 0,
      active:  true,
    }
    onPlansChange(prev => [...prev, newPlan])
    setBillingSelect(prev => ({ ...prev, [newPlan.id]: 'monthly' }))
    setForm(EMPTY_PLAN_FORM)
    setShowAddModal(false)
    addToast(`Meal plan "${newPlan.name}" added`, 'success')
  }

  const handleToggleActive = (id) => {
    onPlansChange(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))
  }

  const handleDelete = (id, name) => {
    onPlansChange(prev => prev.filter(p => p.id !== id))
    addToast(`"${name}" removed`, 'info')
  }

  const setBilling = (planId, type) => {
    setBillingSelect(prev => ({ ...prev, [planId]: type }))
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          + Add Meal Plan
        </button>
      </div>

      {/* Plan cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 13 }}>
        {plans.map(plan => {
          const sel = billingSelect[plan.id] || 'monthly'
          return (
            <div
              key={plan.id}
              className="card"
              style={{
                opacity: plan.active ? 1 : 0.6,
                position: 'relative',
              }}
            >
              {/* Active toggle top-right */}
              <div
                style={{ position: 'absolute', top: 11, right: 11, cursor: 'pointer' }}
                onClick={() => handleToggleActive(plan.id)}
                title={plan.active ? 'Click to deactivate' : 'Click to activate'}
              >
                <Badge type={plan.active ? 'green' : 'grey'}>
                  {plan.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="card-body" style={{ paddingTop: 14 }}>
                {/* Plan name */}
                <p style={{
                  margin: '0 0 4px',
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text)',
                  paddingRight: 60,
                }}>
                  {plan.name}
                </p>

                {/* Description */}
                <p style={{
                  margin: '0 0 12px',
                  fontSize: 12,
                  color: 'var(--text3)',
                  lineHeight: 1.5,
                  minHeight: 34,
                }}>
                  {plan.desc}
                </p>

                {/* Pricing rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {[
                    ['One-time', plan.oneTime],
                    ['Weekly',   plan.weekly],
                    ['Monthly',  plan.monthly],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: val > 0 ? 'var(--text)' : 'var(--text3)',
                        fontWeight: 500,
                      }}>
                        {val > 0 ? formatCurrency(val) : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Billing type toggle */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 13, flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-outline btn-xs"
                    style={{ flex: 1 }}
                    onClick={() => addToast(`Edit "${plan.name}" (coming soon)`, 'info')}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-xs"
                    style={{ flex: 1 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Plan Name</label>
            <input
              className="form-input"
              style={{ width: '100%' }}
              placeholder="e.g. Breakfast Only"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>Description</label>
            <textarea
              className="form-textarea"
              style={{ width: '100%', minHeight: 72, resize: 'vertical' }}
              placeholder="Brief description of meals included"
              value={form.desc}
              onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              ['One-time ₹', 'oneTime'],
              ['Weekly ₹',   'weekly'],
              ['Monthly ₹',  'monthly'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="form-label" style={{ display: 'block', marginBottom: 5 }}>{label}</label>
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
    <div style={{ overflowX: 'auto' }}>
      {orders.length === 0 ? (
        <div className="empty-state">
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>No active orders</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Room', 'Guest', 'Meal Plan', 'Billing', 'Amount', 'Status', 'Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '9px 12px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
                    {order.room}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  {order.guest}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {order.plan}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge type={BILLING_BADGE[order.billing] || 'grey'}>
                    {BILLING_LABEL[order.billing] || order.billing}
                  </Badge>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                    {order.amount > 0 ? formatCurrency(order.amount) : '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge type="green">{order.status}</Badge>
                </td>
                <td style={{ padding: '10px 12px' }}>
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
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--text)',
        boxShadow: 'var(--shadow)',
      }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{payload[0]?.payload?.fullName}</p>
        <p style={{ margin: '3px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
          {formatCurrency(payload[0]?.value)}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Stat summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card stat-bar-gold">
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Food Revenue
          </p>
          <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>
            {formatCurrency(totalRevenue)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>This month</p>
        </div>

        <div className="stat-card stat-bar-blue">
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Subscribers
          </p>
          <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>
            {activeCount}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>Guests on meal plan</p>
        </div>

        <div className="stat-card stat-bar-purple">
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Avg per Guest
          </p>
          <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--purple)' }}>
            {formatCurrency(avgPerGuest)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>Per active subscriber</p>
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="card"
        style={{ padding: '18px 20px' }}
      >
        <p style={{
          margin: '0 0 16px',
          fontFamily: "'Syne', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          Revenue by Meal Plan
        </p>

        {revenueByPlan.length === 0 ? (
          <div className="empty-state" style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text3)', fontSize: 13 }}>No revenue data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByPlan} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'Inter, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}
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
  const [activeTab, setActiveTab] = useState('catalog')
  const [plans, setPlans]         = useState(MOCK_PLANS)
  const orders                    = MOCK_ORDERS

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 26,
          fontWeight: 800,
          margin: 0,
          color: 'var(--text)',
          letterSpacing: '-0.03em',
        }}>
          Food Options
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Meal plans, active orders, and food revenue
        </p>
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
        <div data-tab-id="catalog">
          <MealCatalog plans={plans} onPlansChange={setPlans} />
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
