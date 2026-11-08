import { formatCurrency } from '../../../utils/format'

// Cost groups (USALI-style), in display order. Labels: expenses:groups.<key>.
export const GROUPS = [
  'utilities', 'staff', 'repairs', 'housekeeping', 'guest_supplies',
  'commission', 'taxes_fees', 'transport', 'refunds', 'admin_other',
]

export const PAID_FROM = ['reception', 'owner', 'bank']
export const MODES = ['cash', 'upi', 'bank', 'card', 'cheque']
export const PERIODS = ['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear']

// Local-date YYYY-MM-DD (toISOString would shift to UTC and lose a day in IST).
export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const today = () => ymd(new Date())

// { from, to } (inclusive YYYY-MM-DD) for a period id.
export function periodRange(period, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'lastMonth':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }
    case 'thisQuarter': {
      const q = Math.floor(m / 3) * 3
      return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 0)) }
    }
    case 'thisYear':
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) }
    default:
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) }
  }
}

// "−₹2,400" / "+₹650" — the sign comes from the entry type.
export const signedMoney = (e) => `${e.type === 'income' ? '+' : '−'}${formatCurrency(e.amount)}`

export const dayKey = (date) => (date ? ymd(new Date(date)) : '')

// Download the rows as a spreadsheet-friendly CSV (UTF-8 BOM so Excel keeps ₹ and Devanagari).
export function downloadCsv(filename, header, rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
