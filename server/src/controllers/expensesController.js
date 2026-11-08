/**
 * Expenses — the property's cash book.
 *
 * Every row is money out (type "expense") or other money in (type "income",
 * e.g. scrap sale, owner cash added to the desk) that is not a guest payment.
 * Amounts are always positive; the sign comes from the type. Unpaid rows are
 * bills recorded before the money moved. Rows are soft-deleted (deletedAt).
 *
 * Periods are calendar days in server-local time: `from`/`to` are YYYY-MM-DD,
 * inclusive; the default is the current calendar month.
 */
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'

const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (n) => Math.round((n || 0) * 100) / 100
const pct1 = (n) => Math.round(n * 10) / 10

// Categories created for a property the first time its categories are listed.
const DEFAULT_CATEGORIES = [
  ['utilities', ['Electricity (MSEB)', 'Water tanker', 'Gas', 'Diesel', 'Internet / WiFi']],
  ['staff', ['Staff salary', 'Staff advance']],
  ['repairs', ['Repairs & maintenance', 'Electrician', 'Hardware', 'Appliance repair', 'Vehicle maintenance']],
  ['housekeeping', ['Laundry', 'Cleaning services', 'Cleaning material', 'Linen (towels & pillows)']],
  ['guest_supplies', ['Drinking water', 'Newspaper', 'First aid', 'Toiletries']],
  ['commission', ['OTA commission']],
  ['taxes_fees', ['GST', 'Police & local fees', 'Licences']],
  ['transport', ['Petrol']],
  ['refunds', ['Deposit refund', 'Meter refund']],
  ['admin_other', ['Garbage collection', 'Donation', 'Miscellaneous', 'Other income']],
].flatMap(([group, names]) => names.map((name) => ({ group, name })))
  .map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 }))

const categorySelect = { id: true, name: true, group: true, monthlyBudget: true, active: true, sortOrder: true }
const include = { category: { select: { id: true, name: true, group: true } } }

// ── Dates ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// 'YYYY-MM-DD' → that local day at 00:00; anything else Date can parse as-is.
const parseDay = (v) => {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// Stored date for a row: the local day at noon, so it never slips a day.
const toStoredDate = (v) => {
  const d = parseDay(v)
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : null
}

// { from, to (end of day), days } from the query; default = this calendar month.
const parseRange = (query) => {
  const now = new Date()
  let from = parseDay(query.from)
  let to = parseDay(query.to)
  if (!from) from = new Date(now.getFullYear(), now.getMonth(), 1)
  if (!to) to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
  from = startOfDay(from)
  to = startOfDay(to)
  if (to < from) [from, to] = [to, from]
  const days = Math.round((to - from) / DAY_MS) + 1
  const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
  return { from, to: toEnd, days }
}

const notFound = (res) => res.status(404).json({ message: 'Expense not found.', code: 'ERR_EXPENSE_NOT_FOUND' })
const fail = (res, label, e) => {
  logger.error(`${label} error`, { error: e.message })
  res.status(500).json({ message: 'Internal server error.' })
}

// ── Categories ───────────────────────────────────────────────────────────────

// GET /expenses/categories — seeds the default list for a property with none.
export const getCategories = async (req, res) => {
  try {
    if ((await prisma.expenseCategory.count()) === 0) {
      await prisma.expenseCategory.createMany({ data: DEFAULT_CATEGORIES, skipDuplicates: true })
    }
    const categories = await prisma.expenseCategory.findMany({
      select: categorySelect, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ categories })
  } catch (e) { fail(res, 'getCategories', e) }
}

// POST /expenses/categories
export const createCategory = async (req, res) => {
  try {
    const { name, group, monthlyBudget } = req.body
    const last = await prisma.expenseCategory.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
    const category = await prisma.expenseCategory.create({
      data: { name, group, monthlyBudget: monthlyBudget ?? null, sortOrder: (last?.sortOrder || 0) + 10 },
      select: categorySelect,
    })
    res.status(201).json({ category })
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ message: 'A category with this name already exists.', code: 'ERR_DUPLICATE' })
    fail(res, 'createCategory', e)
  }
}

// PUT /expenses/categories/:id
export const updateCategory = async (req, res) => {
  try {
    const existing = await prisma.expenseCategory.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!existing) return res.status(404).json({ message: 'Category not found.', code: 'ERR_CATEGORY_NOT_FOUND' })
    const data = {}
    for (const k of ['name', 'group', 'monthlyBudget', 'active']) if (req.body[k] !== undefined) data[k] = req.body[k]
    const category = await prisma.expenseCategory.update({ where: { id: req.params.id }, data, select: categorySelect })
    res.json({ category })
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ message: 'A category with this name already exists.', code: 'ERR_DUPLICATE' })
    fail(res, 'updateCategory', e)
  }
}

// ── Ledger ───────────────────────────────────────────────────────────────────

// GET /expenses?from&to&type&status&paidFrom&categoryId&group&search&page&limit
// totals cover the whole filtered set: paid rows only, unless a status filter is
// given (so the Unpaid view totals its bills).
export const getExpenses = async (req, res) => {
  try {
    const { type, status, paidFrom, categoryId, group, search } = req.query
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const { from, to } = parseRange(req.query)

    const where = { deletedAt: null, date: { gte: from, lte: to } }
    if (type && type !== 'all') where.type = type
    if (status && status !== 'all') where.status = status
    if (paidFrom && paidFrom !== 'all') where.paidFrom = paidFrom
    if (categoryId) where.categoryId = categoryId
    if (group) where.category = { group }
    if (search) {
      where.OR = ['payee', 'description', 'reference'].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }))
    }
    const totalsWhere = where.status ? where : { ...where, status: 'paid' }

    const [expenses, total, sums] = await Promise.all([
      prisma.expense.findMany({
        where, include, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.groupBy({ by: ['type'], where: totalsWhere, _sum: { amount: true } }),
    ])
    const sumOf = (t) => sums.find((s) => s.type === t)?._sum.amount || 0
    const out = round2(sumOf('expense'))
    const inn = round2(sumOf('income'))
    res.json({ expenses, total, page, limit, totals: { out, in: inn, net: round2(inn - out) } })
  } catch (e) { fail(res, 'getExpenses', e) }
}

// GET /expenses/payees — recent distinct payees, newest first, for autocomplete.
export const getPayees = async (req, res) => {
  try {
    const rows = await prisma.expense.findMany({
      where: { deletedAt: null },
      select: { payee: true, categoryId: true, amount: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    })
    const seen = new Set()
    const payees = []
    for (const r of rows) {
      const key = r.payee.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      payees.push({ payee: r.payee, categoryId: r.categoryId, lastAmount: r.amount })
      if (payees.length >= 200) break
    }
    res.json({ payees })
  } catch (e) { fail(res, 'getPayees', e) }
}

const findCategory = (id) => prisma.expenseCategory.findUnique({ where: { id }, select: { id: true } })

// POST /expenses
export const createExpense = async (req, res) => {
  try {
    const b = req.body
    if (!(await findCategory(b.categoryId))) {
      return res.status(400).json({ message: 'Choose a valid category.', code: 'ERR_CATEGORY_NOT_FOUND' })
    }
    const expense = await prisma.expense.create({
      data: {
        type: b.type || 'expense',
        date: toStoredDate(b.date),
        categoryId: b.categoryId,
        payee: b.payee,
        description: b.description || null,
        amount: round2(b.amount),
        status: b.status || 'paid',
        paymentMode: b.paymentMode || 'cash',
        paidFrom: b.paidFrom || 'reception',
        paidByName: b.paidByName || null,
        reference: b.reference || null,
        bookingId: b.bookingId || null,
        createdById: req.user?.userId || null,
      },
      include,
    })
    res.status(201).json({ expense })
  } catch (e) { fail(res, 'createExpense', e) }
}

const findLive = (id) => prisma.expense.findFirst({ where: { id, deletedAt: null }, select: { id: true } })

// PUT /expenses/:id
export const updateExpense = async (req, res) => {
  try {
    if (!(await findLive(req.params.id))) return notFound(res)
    const b = req.body
    if (b.categoryId && !(await findCategory(b.categoryId))) {
      return res.status(400).json({ message: 'Choose a valid category.', code: 'ERR_CATEGORY_NOT_FOUND' })
    }
    const data = {}
    for (const k of ['type', 'categoryId', 'payee', 'status', 'paymentMode', 'paidFrom']) if (b[k] !== undefined) data[k] = b[k]
    for (const k of ['description', 'paidByName', 'reference', 'bookingId']) if (b[k] !== undefined) data[k] = b[k] || null
    if (b.amount !== undefined) data.amount = round2(b.amount)
    if (b.date !== undefined) data.date = toStoredDate(b.date)
    const expense = await prisma.expense.update({ where: { id: req.params.id }, data, include })
    res.json({ expense })
  } catch (e) { fail(res, 'updateExpense', e) }
}

// POST /expenses/:id/pay — the bill is paid now (or on `date`).
export const payExpense = async (req, res) => {
  try {
    if (!(await findLive(req.params.id))) return notFound(res)
    const { date, paymentMode, paidFrom } = req.body
    const data = { status: 'paid', date: toStoredDate(date || dayKey(new Date())) }
    if (paymentMode) data.paymentMode = paymentMode
    if (paidFrom) data.paidFrom = paidFrom
    const expense = await prisma.expense.update({ where: { id: req.params.id }, data, include })
    res.json({ expense })
  } catch (e) { fail(res, 'payExpense', e) }
}

// DELETE /expenses/:id — soft delete.
export const deleteExpense = async (req, res) => {
  try {
    if (!(await findLive(req.params.id))) return notFound(res)
    await prisma.expense.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true })
  } catch (e) { fail(res, 'deleteExpense', e) }
}

// ── Summary ──────────────────────────────────────────────────────────────────

// Room-nights occupied in [from, to]: each checked-in / checked-out booking (or
// bed) counts once per night it held the room. In-house stays count through
// tonight; a same-day stay counts one night.
const occupiedRoomNights = async (from, to) => {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ['CheckedIn', 'CheckedOut'] }, deletedAt: null, fromDate: { lte: to } },
    select: { status: true, fromDate: true, toDate: true, checkedInAt: true, checkedOutAt: true },
  })
  const fromDay = startOfDay(from).getTime()
  const toDayEx = startOfDay(to).getTime() + DAY_MS
  const tomorrow = startOfDay(new Date()).getTime() + DAY_MS
  let nights = 0
  for (const b of bookings) {
    const start = startOfDay(b.checkedInAt || b.fromDate).getTime()
    let end = b.status === 'CheckedIn'
      ? Math.max(tomorrow, start + DAY_MS)
      : startOfDay(b.checkedOutAt || b.toDate || b.checkedInAt || b.fromDate).getTime()
    if (end <= start) end = start + DAY_MS
    const s = Math.max(start, fromDay)
    const e = Math.min(end, toDayEx)
    if (e > s) nights += Math.round((e - s) / DAY_MS)
  }
  return nights
}

// Calendar months covered by the period, fractionally (a full month = 1).
const monthsIn = (from, days) => {
  let m = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    m += 1 / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  }
  return m
}

// GET /expenses/summary?from&to
export const getSummary = async (req, res) => {
  try {
    const { from, to, days } = parseRange(req.query)
    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days)

    // Guest money, same source as the dashboards: payments on live invoices
    // (or none), refunds paid out netted off.
    const counted = { OR: [{ invoiceId: null }, { invoice: { deletedAt: null } }] }
    const inPeriod = { gte: from, lte: to }

    const [rows, prev, unpaid, payments, categories, roomNights] = await Promise.all([
      prisma.expense.findMany({
        where: { deletedAt: null, status: 'paid', date: inPeriod },
        select: { type: true, amount: true, paidFrom: true, paymentMode: true, date: true, payee: true, categoryId: true },
      }),
      prisma.expense.aggregate({ where: { deletedAt: null, status: 'paid', type: 'expense', date: { gte: prevFrom, lte: prevTo } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { deletedAt: null, status: 'unpaid', type: 'expense', date: { lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.payment.groupBy({ by: ['type', 'method'], where: { createdAt: inPeriod, ...counted }, _sum: { amount: true } }),
      prisma.expenseCategory.findMany({ select: { id: true, name: true, group: true, monthlyBudget: true } }),
      occupiedRoomNights(from, to),
    ])

    const sign = (p) => (p.type === 'refund' ? -1 : 1) * (p._sum.amount || 0)
    const revenue = round2(payments.reduce((n, p) => n + sign(p), 0))
    const cashCollected = round2(payments.filter((p) => p.method === 'cash').reduce((n, p) => n + sign(p), 0))

    const outRows = rows.filter((r) => r.type === 'expense')
    const inRows = rows.filter((r) => r.type === 'income')
    const sum = (list) => list.reduce((n, r) => n + r.amount, 0)
    const expenses = round2(sum(outRows))
    const otherIncome = round2(sum(inRows))
    const net = round2(revenue + otherIncome - expenses)
    const income = revenue + otherIncome
    const prevExpenses = round2(prev._sum.amount || 0)

    const atDesk = (r) => r.paidFrom === 'reception' && r.paymentMode === 'cash'
    const otherIn = round2(sum(inRows.filter(atDesk)))
    const spent = round2(sum(outRows.filter(atDesk)))

    // Breakdowns (money out only, except daily).
    const months = monthsIn(from, days)
    const catById = new Map(categories.map((c) => [c.id, c]))
    const tally = (keyOf) => {
      const m = new Map()
      for (const r of outRows) {
        const k = keyOf(r)
        const t = m.get(k) || { amount: 0, count: 0 }
        t.amount += r.amount; t.count += 1
        m.set(k, t)
      }
      return m
    }
    const byCat = tally((r) => r.categoryId)
    const budgetOf = (list) => {
      const set = list.filter((c) => c.monthlyBudget != null)
      return set.length ? round2(set.reduce((n, c) => n + c.monthlyBudget, 0) * months) : null
    }

    const byCategory = categories
      .filter((c) => byCat.has(c.id) || c.monthlyBudget != null)
      .map((c) => ({
        categoryId: c.id, name: c.name, group: c.group,
        amount: round2(byCat.get(c.id)?.amount), count: byCat.get(c.id)?.count || 0,
        budget: budgetOf([c]),
      }))
      .filter((c) => c.amount > 0 || c.budget)
      .sort((a, b) => b.amount - a.amount)

    const byGrp = tally((r) => catById.get(r.categoryId)?.group || 'admin_other')
    const groups = new Set([...byGrp.keys(), ...categories.filter((c) => c.monthlyBudget != null).map((c) => c.group)])
    const byGroup = [...groups]
      .map((group) => {
        const t = byGrp.get(group) || { amount: 0, count: 0 }
        return {
          group, amount: round2(t.amount), count: t.count,
          budget: budgetOf(categories.filter((c) => c.group === group)),
          share: expenses > 0 ? pct1((t.amount / expenses) * 100) : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const byPaidFrom = [...tally((r) => r.paidFrom)]
      .map(([paidFrom, t]) => ({ paidFrom, amount: round2(t.amount), count: t.count }))
      .sort((a, b) => b.amount - a.amount)

    // Payees grouped case-insensitively, shown with their latest spelling.
    const payeeMap = new Map()
    for (const r of outRows) {
      const k = r.payee.trim().toLowerCase()
      const t = payeeMap.get(k) || { payee: r.payee.trim(), amount: 0, count: 0 }
      t.amount += r.amount; t.count += 1
      payeeMap.set(k, t)
    }
    const topPayees = [...payeeMap.values()]
      .map((t) => ({ ...t, amount: round2(t.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    // Daily series (monthly when the period is longer than 62 days), zero-filled.
    const monthly = days > 62
    const bucket = (d) => (monthly ? dayKey(d).slice(0, 7) : dayKey(d))
    const series = new Map()
    for (let i = 0; i < days; i++) {
      const k = bucket(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i))
      if (!series.has(k)) series.set(k, { date: k, out: 0, in: 0 })
    }
    for (const r of rows) {
      const s = series.get(bucket(r.date))
      if (s) s[r.type === 'income' ? 'in' : 'out'] += r.amount
    }
    const daily = [...series.values()].map((s) => ({ date: s.date, out: round2(s.out), in: round2(s.in) }))

    res.json({
      period: { from: dayKey(from), to: dayKey(to), days },
      totals: {
        expenses, otherIncome, revenue, net,
        margin: income > 0 ? pct1((net / income) * 100) : 0,
        unpaid: round2(unpaid._sum.amount || 0),
        unpaidCount: unpaid._count || 0,
        prevExpenses,
        expenseTrend: prevExpenses > 0 ? pct1(((expenses - prevExpenses) / prevExpenses) * 100) : null,
      },
      cash: { collected: cashCollected, otherIn, spent, inHand: round2(cashCollected + otherIn - spent) },
      kpis: {
        occupiedRoomNights: roomNights,
        cpor: roomNights > 0 ? round2(expenses / roomNights) : 0,
        expenseRatio: revenue > 0 ? pct1((expenses / revenue) * 100) : 0,
      },
      byGroup, byCategory, byPaidFrom, topPayees, daily,
    })
  } catch (e) { fail(res, 'getSummary', e) }
}
