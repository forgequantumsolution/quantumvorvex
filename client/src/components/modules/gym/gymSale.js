/** Plan-sale helpers shared by the member form and the renew dialog. */
import { formatCurrency } from '../../../utils/format'

export const EMPTY_SALE = { planId: '', startDate: '', discount: '', amountPaid: '', payMode: 'cash' }

/** Payable / paid / due for a sale form, from the chosen plan. */
export function saleTotals(plans, sale) {
  const plan = plans.find((p) => p.id === sale.planId)
  const price = plan?.price || 0
  const discount = Math.min(Number(sale.discount) || 0, price)
  const payable = Math.max(0, price - discount)
  const paid = sale.amountPaid === '' ? payable : Number(sale.amountPaid) || 0
  return { plan, price, discount, payable, paid, due: Math.max(0, payable - paid) }
}

/** Errors for a sale form (plan required, paid ≤ payable). */
export function saleErrors(t, plans, sale) {
  const e = {}
  const { plan, payable, paid } = saleTotals(plans, sale)
  if (!plan) e.planId = t('errors.plan')
  if (paid > payable) e.amountPaid = t('errors.overpaid', { amount: formatCurrency(payable) })
  return e
}

/** Body for POST memberships. An empty "amount paid" means paid in full. */
export function salePayload(plans, sale) {
  const { discount, paid } = saleTotals(plans, sale)
  return {
    planId: sale.planId,
    startDate: sale.startDate || null,
    discount,
    amountPaid: paid,
    payMode: sale.payMode,
  }
}
