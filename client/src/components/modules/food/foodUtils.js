import { formatCurrency } from '../../../utils/format'
import { dateInput, shortDate } from '../gym/gymUtils'

export {
  PHONE_RE, EMAIL_RE, PAY_MODES, cleanPhone, todayInput, dateInput, shortDate, monthLabel, compactMoney, initials, fieldErrors,
} from '../gym/gymUtils'

export const CUSTOMER_TABS = ['all', 'active', 'expiring', 'expired', 'paused', 'dues', 'guests', 'outside']
export const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner']
export const MEAL_ICONS = { breakfast: '🌅', lunch: '🍛', snacks: '☕', dinner: '🌙' }
export const CYCLES = ['daily', 'weekly', 'monthly']
export const DIETS = ['veg', 'non_veg', 'eggetarian', 'jain', 'vegan']
// Weekdays Monday-first for the menu grid (JS getDay(): 0 = Sunday).
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]
const RATE_OF = { daily: 'oneTimeRate', weekly: 'weeklyRate', monthly: 'monthlyRate' }

// Customer status → pill colours (app tokens). Text label always shown with it.
export const STATUS_TONE = {
  active:    'bg-success-bg text-success-text',
  expiring:  'bg-warning-bg text-warning-text',
  upcoming:  'bg-info-bg text-info-text',
  paused:    'bg-info-bg text-info-text',
  expired:   'bg-danger-bg text-danger-text',
  no_plan:   'bg-surface2 text-ink2',
  cancelled: 'bg-surface2 text-ink3',
}

export const DIET_TONE = {
  veg: 'text-success-text', jain: 'text-success-text', vegan: 'text-success-text',
  eggetarian: 'text-warning-text', non_veg: 'text-danger-text',
}

export const planRate = (plan, cycle) => Number(plan?.[RATE_OF[cycle]]) || 0
/** Cycles a plan has a price for, in display order. */
export const planCycles = (plan) => CYCLES.filter((c) => planRate(plan, c) > 0)

/** Last day of `units` cycles starting `start` (yyyy-mm-dd), as on the server. */
export function subEnd(start, cycle, units) {
  if (!start || !units) return null
  const d = new Date(`${start}T00:00`)
  if (cycle === 'monthly') d.setMonth(d.getMonth() + Number(units))
  else d.setDate(d.getDate() + (cycle === 'weekly' ? 7 : 1) * Number(units))
  d.setDate(d.getDate() - 1)
  return d
}

/** "3 days" / "2 weeks" / "1 month". */
export const cycleLabel = (t, cycle, units) => t(`cycles.count.${cycle}`, { count: Number(units) || 1 })

/** "Ends in 2 days" / "Ends today" / "Ended 3 days ago" for a customer row. */
export function daysLeftLabel(t, c) {
  if (c.daysLeft == null) return ''
  if (c.status === 'paused') return t('left.paused')
  if (c.status === 'upcoming') return t('left.starts', { date: shortDate(c.current?.startDate) })
  if (c.daysLeft < 0) return t('left.endedAgo', { count: -c.daysLeft })
  if (c.daysLeft === 0) return t('left.today')
  return t('left.inDays', { count: c.daysLeft })
}

/** Day after the customer's current plan ends (or today if it already ended). */
export function renewalStart(customer, today) {
  const end = customer?.current?.endDate && !['expired', 'no_plan'].includes(customer.status)
    ? new Date(customer.current.endDate) : null
  if (!end) return today
  end.setDate(end.getDate() + 1)
  return dateInput(end)
}

// ── Subscription form ────────────────────────────────────────────────────────

export const EMPTY_SALE = { planId: '', cycle: 'monthly', units: '1', startDate: '', discount: '', amountPaid: '', payMode: 'cash' }

/** Price / payable / paid / due for a subscription form. */
export function saleTotals(plans, sale) {
  const plan = plans.find((p) => p.id === sale.planId)
  const units = Math.max(1, parseInt(sale.units, 10) || 1)
  const price = plan ? planRate(plan, sale.cycle) * units : 0
  const discount = Math.min(Number(sale.discount) || 0, price)
  const payable = Math.max(0, price - discount)
  const paid = sale.amountPaid === '' ? payable : Number(sale.amountPaid) || 0
  return { plan, units, price, discount, payable, paid, due: Math.max(0, payable - paid) }
}

export function saleErrors(t, plans, sale) {
  const e = {}
  const { plan, payable, paid } = saleTotals(plans, sale)
  if (!plan) e.planId = t('errors.plan')
  else if (!planRate(plan, sale.cycle)) e.cycle = t('errors.noRate')
  if (!(parseInt(sale.units, 10) >= 1)) e.units = t('errors.units')
  if (paid > payable) e.amountPaid = t('errors.overpaid', { amount: formatCurrency(payable) })
  return e
}

/** Body for POST subscriptions. An empty "amount paid" means paid in full. */
export function salePayload(plans, sale) {
  const { units, discount, paid } = saleTotals(plans, sale)
  return { planId: sale.planId, cycle: sale.cycle, units, startDate: sale.startDate || null, discount, amountPaid: paid, payMode: sale.payMode }
}

/** A sale on `plan`, defaulting to its first priced cycle (monthly preferred). */
export function saleFor(plan, base = EMPTY_SALE) {
  const cycles = planCycles(plan)
  return { ...base, planId: plan?.id || '', cycle: cycles.includes(base.cycle) ? base.cycle : cycles.includes('monthly') ? 'monthly' : cycles[0] || 'monthly' }
}
