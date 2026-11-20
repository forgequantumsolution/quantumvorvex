/**
 * Food — meal plans, customers and their subscriptions, payments and dues, the
 * kitchen's daily meal sheet, the weekly menu, and the dashboard.
 *
 * A customer is an outside person or a hotel / PG guest. Customers signed up
 * from the booking form carry bookingId; guestId is filled in at check-in. A
 * customer subscribes to a plan for N days / weeks / months → a
 * FoodSubscription (startDate … endDate, inclusive) collecting FoodPayments.
 * Their status is derived from their subscriptions, never stored:
 *
 *   no_plan   never subscribed (or every subscription was cancelled)
 *   upcoming  their plan starts later
 *   active    a plan covers today
 *   expiring  … and ends within EXPIRING_DAYS (and is not renewed yet)
 *   paused    the plan is on hold; resuming pushes the end date out
 *   expired   their last plan has ended
 */
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { isPropertyAdmin } from '../utils/roles.js'

export const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner']
export const CYCLES = ['daily', 'weekly', 'monthly']
const RATE_OF = { daily: 'oneTimeRate', weekly: 'weeklyRate', monthly: 'monthlyRate' }

const DAY = 86400000
const EXPIRING_DAYS = 3
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = startOfDay(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const me = (req) => req.user?.userId || null
const parseMeals = (s) => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v.filter((m) => MEALS.includes(m)) : [] } catch { return [] } }
// yyyy-mm-dd (local) → local midnight; anything else → today.
const dayParam = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? startOfDay(new Date(`${v}T00:00`)) : startOfDay())

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code }
}
const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message, code: e.code })
    if (e.code === 'P2002') return res.status(409).json({ message: 'That name is already used.', code: 'ERR_DUPLICATE' })
    logger.error(`${label} error`, { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}
const notFound = (what = 'Customer') => new HttpError(404, `${what} not found.`, 'ERR_NOT_FOUND')

/** Last day of a subscription of `units` cycles starting on `start`. */
export function subscriptionEnd(start, cycle, units) {
  if (cycle === 'monthly') {
    const s = startOfDay(start)
    const e = new Date(s.getFullYear(), s.getMonth() + units, s.getDate())
    return addDays(e, -1)
  }
  return addDays(start, (cycle === 'weekly' ? 7 : 1) * units - 1)
}

// ── Status ───────────────────────────────────────────────────────────────────

const dueOf = (s) => (s.status === 'cancelled' ? 0 : Math.max(0, round2(s.price - s.discount - s.amountPaid)))
const live = (ss) => ss.filter((s) => s.status !== 'cancelled')

export function customerState(subs, today = startOfDay()) {
  const ss = live(subs)
  if (!ss.length) return { status: 'no_plan', current: null, daysLeft: null }
  const paused = ss.find((s) => s.status === 'paused')
  if (paused) return { status: 'paused', current: paused, daysLeft: daysBetween(today, paused.endDate) }
  const covering = ss.find((s) => s.startDate <= today && s.endDate >= today)
  const later = ss.filter((s) => s.startDate > today).sort((a, b) => a.startDate - b.startDate)
  if (covering) {
    const daysLeft = daysBetween(today, covering.endDate)
    const status = daysLeft <= EXPIRING_DAYS && !later.length ? 'expiring' : 'active'
    return { status, current: covering, daysLeft }
  }
  if (later.length) return { status: 'upcoming', current: later[0], daysLeft: daysBetween(today, later[0].endDate) }
  const last = [...ss].sort((a, b) => b.endDate - a.endDate)[0]
  return { status: 'expired', current: last, daysLeft: daysBetween(today, last.endDate) }
}

/** The subscription feeding `customer` on `day`, or null (paused plans don't eat). */
const eatingOn = (subs, day) => live(subs).find((s) => s.status === 'active' && s.startDate <= day && s.endDate >= day) || null

const SUB_SELECT = {
  id: true, planId: true, planName: true, meals: true, cycle: true, units: true, startDate: true, endDate: true,
  price: true, discount: true, amountPaid: true, status: true, pausedAt: true, pausedDays: true, isRenewal: true,
  bookingId: true, notes: true, createdAt: true,
}

const subOut = (s) => ({
  ...Object.fromEntries(Object.keys(SUB_SELECT).map((k) => [k, s[k]])),
  meals: parseMeals(s.meals),
  due: dueOf(s),
  ...(s.payments && { payments: s.payments.map((p) => ({ id: p.id, amount: p.amount, mode: p.mode, paidAt: p.paidAt })) }),
})

function customerOut(c, today) {
  const st = customerState(c.subscriptions || [], today)
  const { subscriptions, guest, booking, ...rest } = c
  return {
    ...rest,
    roomNumber: guest?.room?.number || booking?.room?.number || null,
    bedNo: guest?.bedNo ?? booking?.bedNo ?? null,
    status: st.status,
    daysLeft: st.daysLeft,
    current: st.current ? subOut(st.current) : null,
    due: round2((subscriptions || []).reduce((n, x) => n + dueOf(x), 0)),
  }
}

const ROOM_INCLUDE = {
  guest: { select: { id: true, status: true, bedNo: true, room: { select: { number: true } } } },
  booking: { select: { id: true, bookingNo: true, status: true, bedNo: true, room: { select: { number: true } } } },
}
const loadCustomers = () => prisma.foodCustomer.findMany({
  where: { deletedAt: null },
  include: { subscriptions: { select: SUB_SELECT }, ...ROOM_INCLUDE },
  orderBy: { createdAt: 'desc' },
})

const findCustomer = async (id) => {
  const c = await prisma.foodCustomer.findFirst({ where: { id, deletedAt: null } })
  if (!c) throw notFound()
  return c
}

// FC-0001: per-property sequence; retries on the unique index if two saves race.
async function createWithCustomerNo(tx, data) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = (await tx.foodCustomer.count()) + 1 + attempt
    try {
      return await tx.foodCustomer.create({ data: { ...data, customerNo: `FC-${String(n).padStart(4, '0')}` } })
    } catch (e) {
      if (e.code !== 'P2002') throw e
    }
  }
  throw new Error('Could not allocate a customer number')
}

/** Price of `units` cycles of `plan`, or an error when the plan has no rate for it. */
function priceFor(plan, cycle, units) {
  const rate = plan[RATE_OF[cycle]] || 0
  if (rate <= 0) throw new HttpError(400, `${plan.name} has no ${cycle === 'daily' ? 'per-day' : cycle} rate.`, 'ERR_NO_RATE')
  return round2(rate * units)
}

/**
 * Subscribe `customer` to a plan. Starts on `startDate`, or — for a renewal —
 * the day after their current subscription ends. Records the amount paid now.
 */
async function sellSubscription(tx, customer, body, userId) {
  const plan = await tx.foodPlan.findFirst({ where: { id: body.planId } })
  if (!plan) throw new HttpError(400, 'Choose a valid meal plan.', 'ERR_PLAN')
  if (!plan.active) throw new HttpError(400, 'This meal plan is no longer offered.', 'ERR_PLAN_RETIRED')
  const cycle = CYCLES.includes(body.cycle) ? body.cycle : 'monthly'
  const units = Math.max(1, Math.min(365, parseInt(body.units, 10) || 1))

  const existing = live(await tx.foodSubscription.findMany({ where: { customerId: customer.id }, select: SUB_SELECT }))
  const today = startOfDay()
  const lastEnd = existing.reduce((d, s) => (s.endDate > d ? s.endDate : d), new Date(0))
  const start = body.startDate
    ? startOfDay(new Date(body.startDate))
    : lastEnd >= today ? addDays(lastEnd, 1) : today
  const end = subscriptionEnd(start, cycle, units)
  const clash = existing.find((s) => s.startDate <= end && s.endDate >= start)
  if (clash) {
    throw new HttpError(409, `Overlaps the ${clash.planName} plan (${ymd(clash.startDate)} to ${ymd(clash.endDate)}).`, 'ERR_OVERLAP')
  }

  const price = priceFor(plan, cycle, units)
  const discount = round2(Math.min(body.discount || 0, price))
  const payable = round2(price - discount)
  const paid = round2(body.amountPaid || 0)
  if (paid > payable) throw new HttpError(400, `Amount paid is more than the ₹${payable} payable.`, 'ERR_OVERPAID')

  const sub = await tx.foodSubscription.create({
    data: {
      customerId: customer.id, planId: plan.id, planName: plan.name, meals: plan.meals, cycle, units,
      startDate: start, endDate: end, price, discount, amountPaid: paid,
      isRenewal: (await tx.foodSubscription.count({ where: { customerId: customer.id } })) > 0,
      bookingId: body.bookingId || null, notes: body.notes || null, createdById: userId,
    },
  })
  if (paid > 0) {
    await tx.foodPayment.create({
      data: { subscriptionId: sub.id, customerId: customer.id, amount: paid, mode: body.payMode || 'cash', createdById: userId },
    })
  }
  return sub
}

const customerData = (b) => ({
  name: b.name, phone: b.phone, email: b.email, address: b.address, diet: b.diet, guestId: b.guestId || null, notes: b.notes,
})

// ── Plans ────────────────────────────────────────────────────────────────────

const planOut = (p, subscribers = 0) => ({ ...p, meals: parseMeals(p.meals), subscribers })
const planData = (b) => {
  const d = {}
  for (const k of ['name', 'description', 'oneTimeRate', 'weeklyRate', 'monthlyRate', 'active']) if (b[k] !== undefined) d[k] = b[k]
  if (Array.isArray(b.meals)) d.meals = JSON.stringify(MEALS.filter((m) => b.meals.includes(m)))
  return d
}

// GET /food-plans — every plan with how many customers eat on it today.
export const getFoodPlans = handle('getFoodPlans', async (req, res) => {
  const today = startOfDay()
  const [plans, customers] = await Promise.all([
    prisma.foodPlan.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    loadCustomers(),
  ])
  const on = {}
  for (const c of customers) {
    const st = customerState(c.subscriptions, today)
    if (['active', 'expiring', 'paused'].includes(st.status) && st.current?.planId) on[st.current.planId] = (on[st.current.planId] || 0) + 1
  }
  res.json({ foodPlans: plans.map((p) => planOut(p, on[p.id] || 0)) })
})

export const createFoodPlan = handle('createFoodPlan', async (req, res) => {
  const plan = await prisma.foodPlan.create({ data: { ...planData(req.body), active: req.body.active ?? true } })
  res.status(201).json({ foodPlan: planOut(plan) })
})

export const updateFoodPlan = handle('updateFoodPlan', async (req, res) => {
  const p = await prisma.foodPlan.findFirst({ where: { id: req.params.id } })
  if (!p) throw notFound('Food plan')
  // Rate / meal changes apply to new subscriptions only: sold ones keep their snapshot.
  const plan = await prisma.foodPlan.update({ where: { id: p.id }, data: planData(req.body) })
  res.json({ foodPlan: planOut(plan) })
})

// DELETE /food-plans/:id — a plan that was ever sold is retired, not deleted.
export const deleteFoodPlan = handle('deleteFoodPlan', async (req, res) => {
  const p = await prisma.foodPlan.findFirst({ where: { id: req.params.id } })
  if (!p) throw notFound('Food plan')
  if (await prisma.foodSubscription.count({ where: { planId: p.id } })) {
    await prisma.foodPlan.update({ where: { id: p.id }, data: { active: false } })
    return res.json({ ok: true, retired: true })
  }
  await prisma.foodPlan.delete({ where: { id: p.id } })
  res.json({ ok: true, retired: false })
})

// ── Customers ────────────────────────────────────────────────────────────────

const TABS = {
  all:      () => true,
  active:   (c) => ['active', 'expiring', 'upcoming'].includes(c.status),
  expiring: (c) => c.status === 'expiring',
  expired:  (c) => c.status === 'expired',
  paused:   (c) => c.status === 'paused',
  dues:     (c) => c.due > 0,
  guests:   (c) => !!(c.guestId || c.bookingId),
  outside:  (c) => !c.guestId && !c.bookingId,
}

// GET /food/customers?tab=&search=&page=&pageSize=
export const getCustomers = handle('getCustomers', async (req, res) => {
  const today = startOfDay()
  const tab = TABS[req.query.tab] ? req.query.tab : 'all'
  const q = String(req.query.search || '').trim().toLowerCase()
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25))

  const all = (await loadCustomers()).map((c) => customerOut(c, today))
  const counts = Object.fromEntries(Object.entries(TABS).map(([k, f]) => [k, all.filter(f).length]))
  let rows = all.filter(TABS[tab])
  if (q) {
    rows = rows.filter((c) => [c.name, c.phone, c.customerNo, c.email, c.roomNumber, c.current?.planName]
      .some((v) => v && String(v).toLowerCase().includes(q)))
  }
  if (tab === 'expiring') rows.sort((a, b) => a.daysLeft - b.daysLeft)
  if (tab === 'expired') rows.sort((a, b) => b.daysLeft - a.daysLeft)
  if (tab === 'dues') rows.sort((a, b) => b.due - a.due)
  res.json({ customers: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, counts })
})

// GET /food/customers/:id — profile, subscriptions with payments, last 14 days of meals.
export const getCustomer = handle('getCustomer', async (req, res) => {
  const c = await prisma.foodCustomer.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      subscriptions: { select: { ...SUB_SELECT, payments: { orderBy: { paidAt: 'desc' } } }, orderBy: { startDate: 'desc' } },
      ...ROOM_INCLUDE,
      mealLogs: { where: { date: { gte: addDays(new Date(), -13) } }, select: { date: true, meal: true }, orderBy: { date: 'desc' } },
    },
  })
  if (!c) throw notFound()
  const { mealLogs, ...rest } = c
  res.json({
    customer: { ...customerOut(rest, startOfDay()), subscriptions: c.subscriptions.map(subOut), booking: c.booking, recentMeals: mealLogs },
    canDelete: isPropertyAdmin(req.propertyAccess),
  })
})

const checkGuest = async (tx, guestId) => {
  if (!guestId) return
  const g = await tx.guest.findFirst({ where: { id: guestId, deletedAt: null } })
  if (!g) throw new HttpError(400, 'That guest was not found.', 'ERR_GUEST')
}

// POST /food/customers — new customer, optionally with their first subscription.
export const createCustomer = handle('createCustomer', async (req, res) => {
  const { subscription, ...b } = req.body
  const created = await prisma.$transaction(async (tx) => {
    await checkGuest(tx, b.guestId)
    const c = await createWithCustomerNo(tx, { ...customerData(b), createdById: me(req) })
    if (subscription?.planId) await sellSubscription(tx, c, subscription, me(req))
    return c
  })
  logger.info('Food customer added', { event: 'FOOD', customerNo: created.customerNo })
  const full = await prisma.foodCustomer.findFirst({ where: { id: created.id }, include: { subscriptions: { select: SUB_SELECT }, ...ROOM_INCLUDE } })
  res.status(201).json({ customer: customerOut(full, startOfDay()) })
})

// PUT /food/customers/:id
export const updateCustomer = handle('updateCustomer', async (req, res) => {
  const c = await findCustomer(req.params.id)
  await checkGuest(prisma, req.body.guestId)
  const updated = await prisma.foodCustomer.update({
    where: { id: c.id },
    // A customer that came from a booking stays linked to it.
    data: { ...customerData(req.body), ...(c.bookingId && !req.body.guestId && { guestId: c.guestId }) },
    include: { subscriptions: { select: SUB_SELECT }, ...ROOM_INCLUDE },
  })
  res.json({ customer: customerOut(updated, startOfDay()) })
})

// DELETE /food/customers/:id — owner or admin only; soft delete keeps revenue history.
export const deleteCustomer = handle('deleteCustomer', async (req, res) => {
  if (!isPropertyAdmin(req.propertyAccess)) throw new HttpError(403, 'Only the owner or an admin can delete customers.', 'ERR_FORBIDDEN')
  const c = await findCustomer(req.params.id)
  await prisma.foodCustomer.update({ where: { id: c.id }, data: { deletedAt: new Date() } })
  res.json({ ok: true })
})

// ── Subscriptions ────────────────────────────────────────────────────────────

// POST /food/customers/:id/subscriptions — subscribe / renew.
export const addSubscription = handle('addSubscription', async (req, res) => {
  const c = await findCustomer(req.params.id)
  const created = await prisma.$transaction((tx) => sellSubscription(tx, c, req.body, me(req)))
  logger.info('Food plan sold', { event: 'FOOD', customerNo: c.customerNo, plan: created.planName, renewal: created.isRenewal })
  res.status(201).json({ subscription: subOut(created) })
})

const findSubscription = async (id) => {
  const s = await prisma.foodSubscription.findFirst({ where: { id, customer: { deletedAt: null } } })
  if (!s) throw notFound('Subscription')
  return s
}

// POST /food/subscriptions/:id/pause — on hold (travel, home visit…).
export const pauseSubscription = handle('pauseSubscription', async (req, res) => {
  const s = await findSubscription(req.params.id)
  const today = startOfDay()
  if (s.status !== 'active' || s.startDate > today || s.endDate < today) {
    throw new HttpError(409, 'Only a plan that is running today can be paused.', 'ERR_STATE')
  }
  const updated = await prisma.foodSubscription.update({ where: { id: s.id }, data: { status: 'paused', pausedAt: new Date() } })
  res.json({ subscription: subOut(updated) })
})

// POST /food/subscriptions/:id/resume — the end date (and any plan queued after
// it) moves out by the days it was paused.
export const resumeSubscription = handle('resumeSubscription', async (req, res) => {
  const s = await findSubscription(req.params.id)
  if (s.status !== 'paused') throw new HttpError(409, 'This plan is not paused.', 'ERR_STATE')
  const days = Math.max(0, daysBetween(s.pausedAt, new Date()))
  const updated = await prisma.$transaction(async (tx) => {
    const later = await tx.foodSubscription.findMany({
      where: { customerId: s.customerId, status: { not: 'cancelled' }, startDate: { gt: s.endDate } },
    })
    for (const l of later) {
      await tx.foodSubscription.update({ where: { id: l.id }, data: { startDate: addDays(l.startDate, days), endDate: addDays(l.endDate, days) } })
    }
    return tx.foodSubscription.update({
      where: { id: s.id },
      data: { status: 'active', pausedAt: null, pausedDays: s.pausedDays + days, endDate: addDays(s.endDate, days) },
    })
  })
  res.json({ subscription: subOut(updated), extendedBy: days })
})

// POST /food/subscriptions/:id/cancel — owner or admin only.
export const cancelSubscription = handle('cancelSubscription', async (req, res) => {
  if (!isPropertyAdmin(req.propertyAccess)) throw new HttpError(403, 'Only the owner or an admin can cancel a plan.', 'ERR_FORBIDDEN')
  const s = await findSubscription(req.params.id)
  if (s.status === 'cancelled') throw new HttpError(409, 'This plan is already cancelled.', 'ERR_STATE')
  const updated = await prisma.foodSubscription.update({ where: { id: s.id }, data: { status: 'cancelled', pausedAt: null } })
  res.json({ subscription: subOut(updated) })
})

// POST /food/subscriptions/:id/payments — collect (part of) what is due.
export const addPayment = handle('addPayment', async (req, res) => {
  const s = await findSubscription(req.params.id)
  const due = dueOf(s)
  const amount = round2(req.body.amount)
  if (due <= 0) throw new HttpError(409, 'Nothing is due on this plan.', 'ERR_NOTHING_DUE')
  if (amount > due) throw new HttpError(400, `Only ₹${due} is due.`, 'ERR_OVERPAID')
  const updated = await prisma.$transaction(async (tx) => {
    await tx.foodPayment.create({ data: { subscriptionId: s.id, customerId: s.customerId, amount, mode: req.body.mode, createdById: me(req) } })
    return tx.foodSubscription.update({ where: { id: s.id }, data: { amountPaid: round2(s.amountPaid + amount) } })
  })
  res.status(201).json({ subscription: subOut(updated) })
})

// ── Daily meal sheet ─────────────────────────────────────────────────────────

/** Who eats which meal on `day`, and who has been served. */
async function mealSheet(day) {
  const [customers, logs, menu] = await Promise.all([
    loadCustomers(),
    prisma.foodMealLog.findMany({ where: { date: day }, select: { customerId: true, meal: true } }),
    prisma.foodMenuItem.findMany({ where: { weekday: day.getDay() } }),
  ])
  const served = new Set(logs.map((l) => `${l.customerId}:${l.meal}`))
  const meals = Object.fromEntries(MEALS.map((m) => [m, { meal: m, expected: 0, served: 0, menu: '', people: [] }]))
  for (const m of menu) if (meals[m.meal]) meals[m.meal].menu = m.items
  for (const c of customers) {
    const sub = eatingOn(c.subscriptions, day)
    if (!sub) continue
    const out = customerOut(c, day)
    for (const meal of parseMeals(sub.meals)) {
      const isServed = served.has(`${c.id}:${meal}`)
      const row = meals[meal]
      row.expected++
      if (isServed) row.served++
      row.people.push({
        id: c.id, name: c.name, customerNo: c.customerNo, phone: c.phone, diet: c.diet,
        roomNumber: out.roomNumber, bedNo: out.bedNo, planName: sub.planName, subscriptionId: sub.id, served: isServed,
      })
    }
  }
  for (const m of MEALS) meals[m].people.sort((a, b) => String(a.roomNumber || '~').localeCompare(String(b.roomNumber || '~'), undefined, { numeric: true }) || a.name.localeCompare(b.name))
  return MEALS.map((m) => meals[m]).filter((m) => m.expected > 0 || m.menu)
}

// GET /food/meals?date=yyyy-mm-dd
export const getMeals = handle('getMeals', async (req, res) => {
  const day = dayParam(req.query.date)
  res.json({ date: day, meals: await mealSheet(day) })
})

// POST /food/meals — { customerId, date, meal, served } ticks a meal on / off.
export const markMeal = handle('markMeal', async (req, res) => {
  const { customerId, meal, served } = req.body
  const day = dayParam(req.body.date)
  if (day > startOfDay()) throw new HttpError(400, 'Meals can only be marked for today or earlier.', 'ERR_FUTURE')
  const c = await prisma.foodCustomer.findFirst({ where: { id: customerId, deletedAt: null }, include: { subscriptions: { select: SUB_SELECT } } })
  if (!c) throw notFound()
  if (served) {
    const sub = eatingOn(c.subscriptions, day)
    if (!sub || !parseMeals(sub.meals).includes(meal)) throw new HttpError(409, `${c.name} has no ${meal} on that day.`, 'ERR_NOT_ON_PLAN')
    await prisma.foodMealLog.upsert({
      where: { customerId_date_meal: { customerId: c.id, date: day, meal } },
      update: {},
      create: { customerId: c.id, subscriptionId: sub.id, date: day, meal, createdById: me(req) },
    })
  } else {
    await prisma.foodMealLog.deleteMany({ where: { customerId: c.id, date: day, meal } })
  }
  res.json({ ok: true })
})

// POST /food/meals/bulk — { date, meal, served } ticks everyone expected for a meal.
export const markMealBulk = handle('markMealBulk', async (req, res) => {
  const { meal, served } = req.body
  const day = dayParam(req.body.date)
  if (day > startOfDay()) throw new HttpError(400, 'Meals can only be marked for today or earlier.', 'ERR_FUTURE')
  const row = (await mealSheet(day)).find((m) => m.meal === meal)
  const people = row?.people || []
  if (served) {
    const todo = people.filter((p) => !p.served)
    if (todo.length) {
      await prisma.foodMealLog.createMany({
        data: todo.map((p) => ({ customerId: p.id, subscriptionId: p.subscriptionId, date: day, meal, createdById: me(req) })),
        skipDuplicates: true,
      })
    }
  } else {
    await prisma.foodMealLog.deleteMany({ where: { date: day, meal, customerId: { in: people.map((p) => p.id) } } })
  }
  res.json({ ok: true, count: people.length })
})

// ── Weekly menu ──────────────────────────────────────────────────────────────

// GET /food/menu — { items: [{ weekday, meal, items }] }
export const getMenu = handle('getMenu', async (req, res) => {
  const rows = await prisma.foodMenuItem.findMany({ orderBy: [{ weekday: 'asc' }] })
  res.json({ items: rows.map(({ weekday, meal, items }) => ({ weekday, meal, items })) })
})

// PUT /food/menu — { items: [{ weekday, meal, items }] }; an empty text clears that slot.
export const saveMenu = handle('saveMenu', async (req, res) => {
  await prisma.$transaction(async (tx) => {
    for (const { weekday, meal, items } of req.body.items) {
      const text = String(items || '').trim()
      if (!text) {
        await tx.foodMenuItem.deleteMany({ where: { weekday, meal } })
        continue
      }
      const existing = await tx.foodMenuItem.findFirst({ where: { weekday, meal } })
      if (existing) await tx.foodMenuItem.update({ where: { id: existing.id }, data: { items: text } })
      else await tx.foodMenuItem.create({ data: { weekday, meal, items: text } })
    }
  })
  const rows = await prisma.foodMenuItem.findMany()
  res.json({ items: rows.map(({ weekday, meal, items }) => ({ weekday, meal, items })) })
})

// ── Hotel / PG guests ────────────────────────────────────────────────────────

// GET /food/guests — in-house guests, to sign one up for meals.
export const getInHouseGuests = handle('getInHouseGuests', async (req, res) => {
  const [guests, customers] = await Promise.all([
    prisma.guest.findMany({
      where: { deletedAt: null, status: { in: ['Active', 'Due'] } },
      select: { id: true, name: true, phone: true, email: true, address: true, bedNo: true, room: { select: { number: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.foodCustomer.findMany({ where: { deletedAt: null, guestId: { not: null } }, select: { guestId: true } }),
  ])
  const taken = new Set(customers.map((c) => c.guestId))
  res.json({ guests: guests.map((g) => ({ ...g, roomNumber: g.room?.number || null, room: undefined, isCustomer: taken.has(g.id) })) })
})

// ── Dashboard ────────────────────────────────────────────────────────────────

// GET /food/dashboard — KPIs, today's meals, 6-month revenue, last 14 days of
// meals served, plan / diet / customer mix, and the follow-up lists.
export const getDashboard = handle('getDashboard', async (req, res) => {
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const prevSameDay = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(),
    Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()), 23, 59, 59)
  const servedSince = addDays(today, -13)

  const [raw, payments, plans, logs, sheet] = await Promise.all([
    loadCustomers(),
    prisma.foodPayment.findMany({
      where: { paidAt: { gte: trendStart }, customer: { deletedAt: null } },
      select: { amount: true, mode: true, paidAt: true, subscription: { select: { planName: true } }, customer: { select: { id: true, name: true, customerNo: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.foodPlan.count({ where: { active: true } }),
    prisma.foodMealLog.groupBy({ by: ['date', 'meal'], where: { date: { gte: servedSince } }, _count: { _all: true } }),
    mealSheet(today),
  ])
  const customers = raw.map((c) => ({ raw: c, ...customerOut(c, today) }))
  const eating = customers.filter((c) => ['active', 'expiring'].includes(c.status))

  const sum = (rows) => round2(rows.reduce((n, p) => n + p.amount, 0))
  const revenueThis = sum(payments.filter((p) => p.paidAt >= monthStart))
  const revenueLastToDate = sum(payments.filter((p) => p.paidAt >= prevMonthStart && p.paidAt <= prevSameDay))
  const revenueLast = sum(payments.filter((p) => p.paidAt >= prevMonthStart && p.paidAt < monthStart))

  const months = []
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const trend = Object.fromEntries(months.map((k) => [k, { month: k, revenue: 0, subscriptions: 0 }]))
  for (const p of payments) { const t = trend[monthKey(p.paidAt)]; if (t) t.revenue = round2(t.revenue + p.amount) }
  for (const c of customers) for (const s of live(c.raw.subscriptions)) { const t = trend[monthKey(s.createdAt)]; if (t) t.subscriptions++ }

  const served = []
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i)
    const row = { date: d, total: 0, ...Object.fromEntries(MEALS.map((m) => [m, 0])) }
    for (const l of logs) if (startOfDay(l.date).getTime() === d.getTime()) { row[l.meal] += l._count._all; row.total += l._count._all }
    served.push(row)
  }

  const tally = (rows, key) => {
    const out = {}
    for (const r of rows) { const k = key(r) || 'unknown'; out[k] = (out[k] || 0) + 1 }
    return Object.entries(out).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
  }
  const dues = customers.filter((c) => c.due > 0)
  const brief = (c) => ({
    id: c.id, name: c.name, phone: c.phone, customerNo: c.customerNo, status: c.status, daysLeft: c.daysLeft,
    due: c.due, planName: c.current?.planName || null, endDate: c.current?.endDate || null, roomNumber: c.roomNumber,
  })

  res.json({
    kpis: {
      active: eating.length,
      total: customers.length,
      mealsToday: sheet.reduce((n, m) => n + m.expected, 0),
      servedToday: sheet.reduce((n, m) => n + m.served, 0),
      expiring: customers.filter((c) => c.status === 'expiring').length,
      paused: customers.filter((c) => c.status === 'paused').length,
      newThisMonth: customers.filter((c) => new Date(c.createdAt) >= monthStart).length,
      revenueThisMonth: revenueThis,
      revenueLastMonth: revenueLast,
      revenueTrend: revenueLastToDate ? Math.round(((revenueThis - revenueLastToDate) / revenueLastToDate) * 1000) / 10 : null,
      duesAmount: round2(dues.reduce((n, c) => n + c.due, 0)),
      duesCustomers: dues.length,
      activePlans: plans,
    },
    today: sheet.map(({ people, ...m }) => m),
    trend: months.map((k) => trend[k]),
    served,
    planMix: tally(eating, (c) => c.current?.planName),
    sources: tally(eating, (c) => (c.guestId || c.bookingId ? 'guest' : 'outside')),
    diets: tally(eating, (c) => c.diet),
    expiring: customers
      .filter((c) => c.status === 'expiring' || (c.status === 'expired' && c.daysLeft >= -7))
      .sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10).map(brief),
    topDues: [...dues].sort((a, b) => b.due - a.due).slice(0, 6).map(brief),
    recentPayments: payments.slice(0, 8).map((p) => ({
      amount: p.amount, mode: p.mode, paidAt: p.paidAt, planName: p.subscription?.planName, customer: p.customer,
    })),
  })
})

// ── Booking hooks (called from the bookings controller) ──────────────────────

/** Throws when `planId` can't be sold with a booking; call before creating it. */
export async function checkBookingMeal(meal) {
  if (!meal?.planId) return
  const plan = await prisma.foodPlan.findFirst({ where: { id: meal.planId, active: true } })
  if (!plan) throw new HttpError(400, 'Choose a valid meal plan.', 'ERR_PLAN')
  const cycle = meal.cycle || 'monthly'
  priceFor(plan, cycle, 1)
}

/**
 * Sign a booking's guest up for meals for the length of the stay: a daily stay
 * pays per day (nights), a monthly one per month (open-ended tenancies start
 * with one month and are renewed from the Food module).
 */
export async function subscribeFromBooking(booking, meal, userId) {
  if (!meal?.planId) return null
  const cycle = booking.stayType === 'daily' ? 'daily' : 'monthly'
  const units = cycle === 'daily'
    ? Math.max(1, booking.nights || daysBetween(booking.fromDate, booking.toDate || addDays(booking.fromDate, 1)))
    : Math.max(1, booking.months || 1)
  const phone = String(booking.guestPhone || '').split(',')[0].trim() || 'N/A'
  const name = String(booking.guestName || '').split(',')[0].trim()
  return prisma.$transaction(async (tx) => {
    const c = await createWithCustomerNo(tx, {
      name, phone, email: booking.guestEmail || null, address: booking.guestAddress || null,
      diet: meal.diet || null, bookingId: booking.id, guestId: booking.guestId || null, createdById: userId,
    })
    await sellSubscription(tx, c, { planId: meal.planId, cycle, units, startDate: booking.fromDate, bookingId: booking.id }, userId)
    return c
  })
}

/** At check-in: tie the booking's food customer to the new guest record. */
export const linkBookingGuest = (tx, bookingId, guestId) =>
  tx.foodCustomer.updateMany({ where: { bookingId, guestId: null }, data: { guestId } })

/** Booking cancelled / no-show / deleted: cancel the meals sold with it. */
export const cancelBookingMeals = (tx, bookingId) =>
  tx.foodSubscription.updateMany({ where: { bookingId, status: { not: 'cancelled' } }, data: { status: 'cancelled', pausedAt: null } })

export { HttpError as FoodError }
