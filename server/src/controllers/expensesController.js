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
import { runWithProperty, runUnscoped } from '../utils/propertyContext.js'
import { getUserAccess, listPropertyAccess } from '../utils/permissionCache.js'
import { LEVEL_RANK } from '../config/modules.js'

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
const includeWithProperty = { ...include, property: { select: { id: true, name: true, code: true } } }

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
// scope=all lists every active property the caller may view expenses at (or the
// one named by `property`), each row carrying its property.
export const getExpenses = async (req, res) => {
  try {
    const { type, status, paidFrom, categoryId, group, search } = req.query
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const { from, to } = parseRange(req.query)
    const all = req.query.scope === 'all'

    const where = { deletedAt: null, date: { gte: from, lte: to } }
    if (type && type !== 'all') where.type = type
    if (status && status !== 'all') where.status = status
    if (paidFrom && paidFrom !== 'all') where.paidFrom = paidFrom
    if (categoryId) where.categoryId = categoryId
    if (group) where.category = { group }
    if (search) {
      where.OR = ['payee', 'description', 'reference'].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }))
    }
    if (all) {
      // Like the portfolio totals: active properties, unless one (even archived) is asked for.
      const props = (await expenseProperties(req.user.userId)).map((pa) => pa.property)
      const one = req.query.property
      where.propertyId = { in: props.filter((p) => (one ? p.id === one : p.status === 'active')).map((p) => p.id) }
    }
    const totalsWhere = where.status ? where : { ...where, status: 'paid' }

    const run = () => Promise.all([
      prisma.expense.findMany({
        where, include: all ? includeWithProperty : include,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.groupBy({ by: ['type'], where: totalsWhere, _sum: { amount: true } }),
    ])
    // Across properties the tenant scope is lifted; propertyId IN (accessible) replaces it.
    const [expenses, total, sums] = await (all ? runUnscoped(run) : run())
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

// Deleting a cash-book entry is for the owner or an admin (Admin / Manager role)
// at this property — never ordinary staff, even with MANAGE on expenses.
const DELETE_ROLES = /^(admin|administrator|manager)$/i
export const canDeleteExpenses = (pa) => !!pa && (pa.isOwner || DELETE_ROLES.test(String(pa.roleName || '').trim()))

// GET /expenses/:id — one entry with its category, property and who recorded it.
export const getExpense = async (req, res) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, deletedAt: null }, include: includeWithProperty,
    })
    if (!expense) return notFound(res)
    const createdBy = expense.createdById
      ? await runUnscoped(() => prisma.user.findUnique({ where: { id: expense.createdById }, select: { id: true, name: true } }))
      : null
    res.json({ expense: { ...expense, createdBy }, canDelete: canDeleteExpenses(req.propertyAccess) })
  } catch (e) { fail(res, 'getExpense', e) }
}

// DELETE /expenses/:id — soft delete; owner or admin only.
export const deleteExpense = async (req, res) => {
  try {
    if (!canDeleteExpenses(req.propertyAccess)) {
      return res.status(403).json({ message: 'Only the owner or an admin can delete expenses.', code: 'ERR_FORBIDDEN' })
    }
    if (!(await findLive(req.params.id))) return notFound(res)
    await prisma.expense.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true })
  } catch (e) { fail(res, 'deleteExpense', e) }
}

// ── Summary ──────────────────────────────────────────────────────────────────

// Nights each checked-in / checked-out booking (or bed) held its room, as
// [start, end) day spans in ms. In-house stays run through tonight; a same-day
// stay counts one night. One query, reused for the period and every month.
const stayIntervals = async (upTo) => {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ['CheckedIn', 'CheckedOut'] }, deletedAt: null, fromDate: { lte: upTo } },
    select: { status: true, fromDate: true, toDate: true, checkedInAt: true, checkedOutAt: true },
  })
  const tomorrow = startOfDay(new Date()).getTime() + DAY_MS
  return bookings.map((b) => {
    const start = startOfDay(b.checkedInAt || b.fromDate).getTime()
    let end = b.status === 'CheckedIn'
      ? Math.max(tomorrow, start + DAY_MS)
      : startOfDay(b.checkedOutAt || b.toDate || b.checkedInAt || b.fromDate).getTime()
    if (end <= start) end = start + DAY_MS
    return [start, end]
  })
}

// Room-nights occupied in [from, to] (inclusive days).
const nightsIn = (spans, from, to) => {
  const fromDay = startOfDay(from).getTime()
  const toDayEx = startOfDay(to).getTime() + DAY_MS
  let nights = 0
  for (const [start, end] of spans) {
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

// Groups whose bills come every month whatever the occupancy.
const FIXED_GROUPS = new Set(['utilities', 'staff', 'taxes_fees'])
const AGING = [['0-7', 7], ['8-30', 30], ['31-60', 60], ['60+', Infinity]]

// Guest money, same source as the dashboards: payments on live invoices (or
// none), refunds paid out netted off. method 'advance' rows only move credit
// already received onto a rent invoice (pgRent) — counting them would count
// that money twice.
const countedPayment = { method: { not: 'advance' }, OR: [{ invoiceId: null }, { invoice: { deletedAt: null } }] }
const signed = (p) => (p.type === 'refund' ? -1 : 1) * (p.amount ?? p._sum?.amount ?? 0)

/**
 * The cash book summary for { from, to } (parseRange output) in the current
 * property scope. Shared by GET /expenses/summary and /expenses/portfolio.
 */
export const expenseSummary = async ({ from, to, days }) => {
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days)
  const inPeriod = { gte: from, lte: to }
  // Trend window: the 12 calendar months ending with the period's last month.
  const winFrom = new Date(to.getFullYear(), to.getMonth() - 11, 1)
  const winTo = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999)

  const [rows, prevRows, unpaidRows, payments, categories, spans, winRows, winPayments] = await Promise.all([
    prisma.expense.findMany({
      where: { deletedAt: null, status: 'paid', date: inPeriod },
      select: { id: true, type: true, amount: true, paidFrom: true, paymentMode: true, date: true, payee: true, categoryId: true },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, status: 'paid', type: 'expense', date: { gte: prevFrom, lte: prevTo } },
      select: { amount: true, categoryId: true },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, status: 'unpaid', type: 'expense', date: { lte: to } },
      select: { amount: true, date: true },
    }),
    prisma.payment.groupBy({ by: ['type', 'method'], where: { createdAt: inPeriod, ...countedPayment }, _sum: { amount: true } }),
    prisma.expenseCategory.findMany({ select: { id: true, name: true, group: true, monthlyBudget: true } }),
    stayIntervals(to > winTo ? to : winTo),
    prisma.expense.findMany({
      where: { deletedAt: null, status: 'paid', date: { gte: winFrom, lte: winTo } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: winFrom, lte: winTo }, ...countedPayment },
      select: { type: true, amount: true, createdAt: true },
    }),
  ])
  const roomNights = nightsIn(spans, from, to)

  const revenue = round2(payments.reduce((n, p) => n + signed(p), 0))
  const cashCollected = round2(payments.filter((p) => p.method === 'cash').reduce((n, p) => n + signed(p), 0))

  const outRows = rows.filter((r) => r.type === 'expense')
  const inRows = rows.filter((r) => r.type === 'income')
  const sum = (list) => list.reduce((n, r) => n + r.amount, 0)
  const expenses = round2(sum(outRows))
  const otherIncome = round2(sum(inRows))
  const net = round2(revenue + otherIncome - expenses)
  const income = revenue + otherIncome
  const prevExpenses = round2(sum(prevRows))
  const unpaid = round2(sum(unpaidRows))

  const atDesk = (r) => r.paidFrom === 'reception' && r.paymentMode === 'cash'
  const otherIn = round2(sum(inRows.filter(atDesk)))
  const spent = round2(sum(outRows.filter(atDesk)))

  // Breakdowns (money out only, except daily).
  const months = monthsIn(from, days)
  const catById = new Map(categories.map((c) => [c.id, c]))
  const groupOf = (r) => catById.get(r.categoryId)?.group || 'admin_other'
  const tally = (keyOf, list = outRows) => {
    const m = new Map()
    for (const r of list) {
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

  const byGrp = tally(groupOf)
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

  const prevByGroup = [...tally(groupOf, prevRows)]
    .map(([group, t]) => ({ group, amount: round2(t.amount) }))
    .sort((a, b) => b.amount - a.amount)

  let fixed = 0
  for (const [group, t] of byGrp) if (FIXED_GROUPS.has(group)) fixed += t.amount
  const fixedVariable = { fixed: round2(fixed), variable: round2(expenses - fixed) }

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

  const largest = [...outRows]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((r) => ({
      id: r.id, date: dayKey(r.date), payee: r.payee,
      category: catById.get(r.categoryId)?.name || null, group: groupOf(r), amount: round2(r.amount),
    }))

  // Unpaid bills by age (days from the bill's date to today).
  const today = startOfDay(new Date()).getTime()
  const aging = AGING.map(([bucket]) => ({ bucket, amount: 0, count: 0 }))
  for (const r of unpaidRows) {
    const age = Math.max(0, Math.round((today - startOfDay(r.date).getTime()) / DAY_MS))
    const b = aging[AGING.findIndex(([, max]) => age <= max)]
    b.amount += r.amount; b.count += 1
  }
  for (const b of aging) b.amount = round2(b.amount)

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

  // 12-month trend, same definitions as totals/kpis.
  const monthMap = new Map()
  for (let i = 0; i < 12; i++) {
    const m = new Date(winFrom.getFullYear(), winFrom.getMonth() + i, 1)
    monthMap.set(dayKey(m).slice(0, 7), { start: m, expenses: 0, revenue: 0, otherIncome: 0 })
  }
  for (const r of winRows) {
    const t = monthMap.get(dayKey(r.date).slice(0, 7))
    if (t) t[r.type === 'income' ? 'otherIncome' : 'expenses'] += r.amount
  }
  for (const p of winPayments) {
    const t = monthMap.get(dayKey(p.createdAt).slice(0, 7))
    if (t) t.revenue += signed(p)
  }
  const monthsSeries = [...monthMap].map(([month, t]) => {
    const nights = nightsIn(spans, t.start, new Date(t.start.getFullYear(), t.start.getMonth() + 1, 0))
    return {
      month,
      expenses: round2(t.expenses), revenue: round2(t.revenue), otherIncome: round2(t.otherIncome),
      net: round2(t.revenue + t.otherIncome - t.expenses),
      occupiedRoomNights: nights,
      cpor: nights > 0 ? round2(t.expenses / nights) : 0,
    }
  })

  return {
    period: { from: dayKey(from), to: dayKey(to), days },
    totals: {
      expenses, otherIncome, revenue, net,
      margin: income > 0 ? pct1((net / income) * 100) : 0,
      unpaid,
      unpaidCount: unpaidRows.length,
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
    months: monthsSeries, aging, fixedVariable, prevByGroup, largest,
  }
}

// GET /expenses/summary?from&to
export const getSummary = async (req, res) => {
  try {
    res.json(await expenseSummary(parseRange(req.query)))
  } catch (e) { fail(res, 'getSummary', e) }
}

// Sum fields of objects sharing a key, e.g. byGroup rows across properties.
const mergeBy = (list, key, fields) => {
  const m = new Map()
  for (const r of list) {
    const t = m.get(r[key]) || Object.fromEntries([[key, r[key]], ...fields.map((f) => [f, 0])])
    for (const f of fields) t[f] += r[f] || 0
    m.set(r[key], t)
  }
  return [...m.values()].map((t) => {
    for (const f of fields) t[f] = round2(t[f])
    return t
  })
}

// Properties the user owns or may view expenses at (property access records).
const expenseProperties = async (userId) => {
  const access = await getUserAccess(userId)
  return (await listPropertyAccess(access))
    .filter((pa) => pa.isOwner || (LEVEL_RANK[pa.perms.expenses] || 0) >= LEVEL_RANK.VIEW)
}

// GET /expenses/portfolio?from&to&properties=id1,id2 — every property the caller
// owns or may view expenses at, side by side. Totals cover active properties.
export const getPortfolio = async (req, res) => {
  try {
    const range = parseRange(req.query)
    const wanted = String(req.query?.properties || '').split(',').map((x) => x.trim()).filter(Boolean)
    const accessible = (await expenseProperties(req.user.userId))
      .filter((pa) => !wanted.length || wanted.includes(pa.property.id))

    const properties = await Promise.all(accessible.map(async (pa) => {
      const s = await runWithProperty(pa.property.id, () => expenseSummary(range))
      const { expenses, revenue, otherIncome, net, margin, unpaid, unpaidCount } = s.totals
      return {
        id: pa.property.id, name: pa.property.name, code: pa.property.code, status: pa.property.status,
        totals: { expenses, revenue, otherIncome, net, margin, unpaid, unpaidCount },
        cash: s.cash,
        kpis: { cpor: s.kpis.cpor, expenseRatio: s.kpis.expenseRatio, occupiedRoomNights: s.kpis.occupiedRoomNights },
        byGroup: s.byGroup.filter((g) => g.amount > 0).map(({ group, amount }) => ({ group, amount })),
        months: s.months,
      }
    }))

    const live = properties.filter((p) => p.status === 'active')
    const total = (f) => round2(live.reduce((n, p) => n + p.totals[f], 0))
    const totals = Object.fromEntries(['expenses', 'revenue', 'otherIncome', 'net', 'unpaid', 'unpaidCount'].map((f) => [f, total(f)]))
    const income = totals.revenue + totals.otherIncome
    totals.margin = income > 0 ? pct1((totals.net / income) * 100) : 0
    const cash = Object.fromEntries(['collected', 'otherIn', 'spent', 'inHand'].map((f) => [f, round2(live.reduce((n, p) => n + p.cash[f], 0))]))

    res.json({
      period: { from: dayKey(range.from), to: dayKey(range.to), days: range.days },
      properties: properties.map(({ months, ...p }) => p),
      totals,
      cash,
      byGroup: mergeBy(live.flatMap((p) => p.byGroup), 'group', ['amount']).sort((a, b) => b.amount - a.amount),
      months: mergeBy(live.flatMap((p) => p.months), 'month', ['expenses', 'revenue', 'net'])
        .map(({ month, expenses, revenue, net }) => ({ month, expenses, revenue, net })),
    })
  } catch (e) { fail(res, 'getPortfolio', e) }
}
