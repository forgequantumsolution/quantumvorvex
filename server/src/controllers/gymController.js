/**
 * Gym — members, membership plans, renewals, freezes, dues and the dashboard.
 *
 * A member buys a plan → a GymMembership (startDate … endDate, inclusive) that
 * collects one or more GymPayments. A member is an outside customer or a linked
 * hotel / PG guest (guestId). Their status is derived from their memberships:
 *
 *   no_plan   never bought one (or every one was cancelled)
 *   upcoming  their plan starts later
 *   active    a plan covers today
 *   expiring  … and ends within EXPIRING_DAYS (and is not renewed yet)
 *   frozen    the plan is paused; unfreezing pushes the end date out
 *   expired   their last plan has ended
 *
 * Gyms here are small (hundreds of members), so lists and the dashboard load the
 * members with their memberships and derive everything in memory.
 */
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { isPropertyAdmin } from '../utils/roles.js'

const DAY = 86400000
const EXPIRING_DAYS = 7
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => new Date(startOfDay(d).getTime() + n * DAY)
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const me = (req) => req.user?.userId || null

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code }
}
const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message, code: e.code })
    logger.error(`${label} error`, { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}
const notFound = (what = 'Member') => new HttpError(404, `${what} not found.`, 'ERR_NOT_FOUND')

// What is still owed on one membership.
const dueOf = (m) => (m.status === 'cancelled' ? 0 : Math.max(0, round2(m.price - m.discount - m.amountPaid)))
const live = (ms) => ms.filter((m) => m.status !== 'cancelled')

/** Status + current plan of a member, from their memberships. */
export function memberState(memberships, today = startOfDay()) {
  const ms = live(memberships)
  if (!ms.length) return { status: 'no_plan', current: null, daysLeft: null }
  const frozen = ms.find((m) => m.status === 'frozen')
  if (frozen) return { status: 'frozen', current: frozen, daysLeft: daysBetween(today, frozen.endDate) }
  const covering = ms.find((m) => m.startDate <= today && m.endDate >= today)
  const later = ms.filter((m) => m.startDate > today).sort((a, b) => a.startDate - b.startDate)
  if (covering) {
    const daysLeft = daysBetween(today, covering.endDate)
    // Already renewed in advance → not "expiring".
    const status = daysLeft <= EXPIRING_DAYS && !later.length ? 'expiring' : 'active'
    return { status, current: covering, daysLeft, next: later[0] || null }
  }
  if (later.length) return { status: 'upcoming', current: later[0], daysLeft: daysBetween(today, later[0].endDate) }
  const last = [...ms].sort((a, b) => b.endDate - a.endDate)[0]
  return { status: 'expired', current: last, daysLeft: daysBetween(today, last.endDate) }
}

const membershipOut = (m) => ({
  id: m.id, planId: m.planId, planName: m.planName, durationDays: m.durationDays,
  startDate: m.startDate, endDate: m.endDate, price: m.price, discount: m.discount, amountPaid: m.amountPaid,
  due: dueOf(m), status: m.status, frozenAt: m.frozenAt, frozenDays: m.frozenDays, isRenewal: m.isRenewal,
  notes: m.notes, createdAt: m.createdAt,
  ...(m.payments && { payments: m.payments.map((p) => ({ id: p.id, amount: p.amount, mode: p.mode, paidAt: p.paidAt })) }),
})

function memberOut(m, today) {
  const st = memberState(m.memberships || [], today)
  const { memberships, ...rest } = m
  return {
    ...rest,
    status: st.status,
    daysLeft: st.daysLeft,
    current: st.current ? membershipOut(st.current) : null,
    due: round2((memberships || []).reduce((n, x) => n + dueOf(x), 0)),
  }
}

const MEMBERSHIP_SELECT = {
  id: true, planId: true, planName: true, durationDays: true, startDate: true, endDate: true, price: true,
  discount: true, amountPaid: true, status: true, frozenAt: true, frozenDays: true, isRenewal: true, notes: true, createdAt: true,
}
const loadMembers = () => prisma.gymMember.findMany({
  where: { deletedAt: null },
  include: { memberships: { select: MEMBERSHIP_SELECT } },
  orderBy: { joinedAt: 'desc' },
})

const findMember = async (id) => {
  const m = await prisma.gymMember.findFirst({ where: { id, deletedAt: null } })
  if (!m) throw notFound()
  return m
}

// GM-0001: per-property sequence; retries on the unique index if two saves race.
async function createWithMemberNo(tx, data) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = (await tx.gymMember.count()) + 1 + attempt
    try {
      return await tx.gymMember.create({ data: { ...data, memberNo: `GM-${String(n).padStart(4, '0')}` } })
    } catch (e) {
      if (e.code !== 'P2002') throw e
    }
  }
  throw new Error('Could not allocate a member number')
}

/**
 * Sell `planId` to `member`. Starts on `startDate`, or — for a renewal — the day
 * after their current plan ends, so renewing early never loses days. Records the
 * amount paid now as the first payment.
 */
async function sellPlan(tx, member, body, userId) {
  const plan = await tx.gymPlan.findFirst({ where: { id: body.planId } })
  if (!plan) throw new HttpError(400, 'Choose a valid plan.', 'ERR_PLAN')
  if (!plan.active) throw new HttpError(400, 'This plan is no longer offered.', 'ERR_PLAN_RETIRED')

  const existing = live(await tx.gymMembership.findMany({ where: { memberId: member.id }, select: MEMBERSHIP_SELECT }))
  const today = startOfDay()
  const lastEnd = existing.reduce((d, m) => (m.endDate > d ? m.endDate : d), new Date(0))
  const start = body.startDate
    ? startOfDay(new Date(body.startDate))
    : lastEnd >= today ? addDays(lastEnd, 1) : today
  const end = addDays(start, plan.durationDays - 1)
  const clash = existing.find((m) => m.startDate <= end && m.endDate >= start)
  if (clash) {
    throw new HttpError(409, `Overlaps the ${clash.planName} plan (${clash.startDate.toISOString().slice(0, 10)} to ${clash.endDate.toISOString().slice(0, 10)}).`, 'ERR_OVERLAP')
  }

  const discount = round2(Math.min(body.discount || 0, plan.price))
  const payable = round2(plan.price - discount)
  const paid = round2(body.amountPaid || 0)
  if (paid > payable) throw new HttpError(400, `Amount paid is more than the ₹${payable} payable.`, 'ERR_OVERPAID')

  const membership = await tx.gymMembership.create({
    data: {
      memberId: member.id, planId: plan.id, planName: plan.name, durationDays: plan.durationDays,
      startDate: start, endDate: end, price: plan.price, discount, amountPaid: paid,
      isRenewal: existing.length > 0 || (await tx.gymMembership.count({ where: { memberId: member.id } })) > 0,
      notes: body.notes || null, createdById: userId,
    },
  })
  if (paid > 0) {
    await tx.gymPayment.create({
      data: { membershipId: membership.id, memberId: member.id, amount: paid, mode: body.payMode || 'cash', createdById: userId },
    })
  }
  return membership
}

const memberData = (b) => ({
  name: b.name, phone: b.phone, email: b.email, gender: b.gender, dob: b.dob ? new Date(b.dob) : null,
  address: b.address, idType: b.idType, idNumber: b.idNumber, emergencyName: b.emergencyName,
  emergencyPhone: b.emergencyPhone, healthNotes: b.healthNotes, goal: b.goal,
  source: b.guestId ? 'guest' : b.source, guestId: b.guestId, notes: b.notes,
})

// ── Members ──────────────────────────────────────────────────────────────────

const TABS = {
  all:      () => true,
  active:   (m) => ['active', 'expiring', 'upcoming'].includes(m.status),
  expiring: (m) => m.status === 'expiring',
  expired:  (m) => m.status === 'expired',
  frozen:   (m) => m.status === 'frozen',
  dues:     (m) => m.due > 0,
  no_plan:  (m) => m.status === 'no_plan',
}

// GET /gym/members?tab=&search=&page=&pageSize=
export const getMembers = handle('getMembers', async (req, res) => {
  const today = startOfDay()
  const tab = TABS[req.query.tab] ? req.query.tab : 'all'
  const q = String(req.query.search || '').trim().toLowerCase()
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25))

  const all = (await loadMembers()).map((m) => memberOut(m, today))
  const counts = Object.fromEntries(Object.entries(TABS).map(([k, f]) => [k, all.filter(f).length]))
  let rows = all.filter(TABS[tab])
  if (q) {
    rows = rows.filter((m) => [m.name, m.phone, m.memberNo, m.email, m.current?.planName]
      .some((v) => v && String(v).toLowerCase().includes(q)))
  }
  if (tab === 'expiring') rows.sort((a, b) => a.daysLeft - b.daysLeft)
  if (tab === 'expired') rows.sort((a, b) => b.daysLeft - a.daysLeft)
  if (tab === 'dues') rows.sort((a, b) => b.due - a.due)
  res.json({ members: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, counts })
})

// GET /gym/members/:id — profile, every membership with its payments, the linked guest.
export const getMember = handle('getMember', async (req, res) => {
  const m = await prisma.gymMember.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: {
      memberships: { select: { ...MEMBERSHIP_SELECT, payments: { orderBy: { paidAt: 'desc' } } }, orderBy: { startDate: 'desc' } },
      guest: { select: { id: true, name: true, status: true, room: { select: { number: true } } } },
    },
  })
  if (!m) throw notFound()
  const out = memberOut(m, startOfDay())
  res.json({
    member: { ...out, memberships: m.memberships.map(membershipOut) },
    canDelete: isPropertyAdmin(req.propertyAccess),
  })
})

// POST /gym/members — new member, optionally with their first plan.
export const createMember = handle('createMember', async (req, res) => {
  const { membership, joinedAt, ...b } = req.body
  const created = await prisma.$transaction(async (tx) => {
    if (b.guestId) {
      const g = await tx.guest.findFirst({ where: { id: b.guestId, deletedAt: null } })
      if (!g) throw new HttpError(400, 'That guest was not found.', 'ERR_GUEST')
    }
    const member = await createWithMemberNo(tx, {
      ...memberData(b), joinedAt: joinedAt ? new Date(joinedAt) : new Date(), createdById: me(req),
    })
    if (membership?.planId) await sellPlan(tx, member, membership, me(req))
    return member
  })
  logger.info('Gym member added', { event: 'GYM', memberNo: created.memberNo })
  const full = await prisma.gymMember.findFirst({ where: { id: created.id }, include: { memberships: { select: MEMBERSHIP_SELECT } } })
  res.status(201).json({ member: memberOut(full, startOfDay()) })
})

// PUT /gym/members/:id
export const updateMember = handle('updateMember', async (req, res) => {
  const m = await findMember(req.params.id)
  const { joinedAt, ...b } = req.body
  const updated = await prisma.gymMember.update({
    where: { id: m.id },
    data: { ...memberData(b), ...(joinedAt && { joinedAt: new Date(joinedAt) }) },
    include: { memberships: { select: MEMBERSHIP_SELECT } },
  })
  res.json({ member: memberOut(updated, startOfDay()) })
})

// DELETE /gym/members/:id — owner or admin only; soft delete keeps the revenue history.
export const deleteMember = handle('deleteMember', async (req, res) => {
  if (!isPropertyAdmin(req.propertyAccess)) throw new HttpError(403, 'Only the owner or an admin can delete members.', 'ERR_FORBIDDEN')
  const m = await findMember(req.params.id)
  await prisma.gymMember.update({ where: { id: m.id }, data: { deletedAt: new Date() } })
  res.json({ ok: true })
})

// ── Memberships ──────────────────────────────────────────────────────────────

// POST /gym/members/:id/memberships — sell a plan / renew.
export const addMembership = handle('addMembership', async (req, res) => {
  const member = await findMember(req.params.id)
  const created = await prisma.$transaction((tx) => sellPlan(tx, member, req.body, me(req)))
  logger.info('Gym plan sold', { event: 'GYM', memberNo: member.memberNo, plan: created.planName, renewal: created.isRenewal })
  res.status(201).json({ membership: membershipOut(created) })
})

const findMembership = async (id) => {
  const ms = await prisma.gymMembership.findFirst({ where: { id, member: { deletedAt: null } } })
  if (!ms) throw notFound('Membership')
  return ms
}

// POST /gym/memberships/:id/freeze — pause a running plan (travel, injury…).
export const freezeMembership = handle('freezeMembership', async (req, res) => {
  const ms = await findMembership(req.params.id)
  const today = startOfDay()
  if (ms.status !== 'active' || ms.startDate > today || ms.endDate < today) {
    throw new HttpError(409, 'Only a plan that is running today can be frozen.', 'ERR_STATE')
  }
  const updated = await prisma.gymMembership.update({ where: { id: ms.id }, data: { status: 'frozen', frozenAt: new Date() } })
  res.json({ membership: membershipOut(updated) })
})

// POST /gym/memberships/:id/unfreeze — resume; the end date (and any plan
// queued after it) moves out by the days it was frozen.
export const unfreezeMembership = handle('unfreezeMembership', async (req, res) => {
  const ms = await findMembership(req.params.id)
  if (ms.status !== 'frozen') throw new HttpError(409, 'This plan is not frozen.', 'ERR_STATE')
  const days = Math.max(0, daysBetween(ms.frozenAt, new Date()))
  const updated = await prisma.$transaction(async (tx) => {
    const later = await tx.gymMembership.findMany({
      where: { memberId: ms.memberId, status: { not: 'cancelled' }, startDate: { gt: ms.endDate } },
    })
    for (const l of later) {
      await tx.gymMembership.update({ where: { id: l.id }, data: { startDate: addDays(l.startDate, days), endDate: addDays(l.endDate, days) } })
    }
    return tx.gymMembership.update({
      where: { id: ms.id },
      data: { status: 'active', frozenAt: null, frozenDays: ms.frozenDays + days, endDate: addDays(ms.endDate, days) },
    })
  })
  res.json({ membership: membershipOut(updated), extendedBy: days })
})

// POST /gym/memberships/:id/cancel — owner or admin only.
export const cancelMembership = handle('cancelMembership', async (req, res) => {
  if (!isPropertyAdmin(req.propertyAccess)) throw new HttpError(403, 'Only the owner or an admin can cancel a plan.', 'ERR_FORBIDDEN')
  const ms = await findMembership(req.params.id)
  if (ms.status === 'cancelled') throw new HttpError(409, 'This plan is already cancelled.', 'ERR_STATE')
  const updated = await prisma.gymMembership.update({ where: { id: ms.id }, data: { status: 'cancelled', frozenAt: null } })
  res.json({ membership: membershipOut(updated) })
})

// POST /gym/memberships/:id/payments — collect (part of) what is due.
export const addPayment = handle('addPayment', async (req, res) => {
  const ms = await findMembership(req.params.id)
  const due = dueOf(ms)
  const amount = round2(req.body.amount)
  if (due <= 0) throw new HttpError(409, 'Nothing is due on this plan.', 'ERR_NOTHING_DUE')
  if (amount > due) throw new HttpError(400, `Only ₹${due} is due.`, 'ERR_OVERPAID')
  const updated = await prisma.$transaction(async (tx) => {
    await tx.gymPayment.create({ data: { membershipId: ms.id, memberId: ms.memberId, amount, mode: req.body.mode, createdById: me(req) } })
    return tx.gymMembership.update({ where: { id: ms.id }, data: { amountPaid: round2(ms.amountPaid + amount) } })
  })
  res.status(201).json({ membership: membershipOut(updated) })
})

// ── Plans ────────────────────────────────────────────────────────────────────

// GET /gym/plans — every plan with how many members are on it now.
export const getPlans = handle('getPlans', async (req, res) => {
  const today = startOfDay()
  const [plans, members] = await Promise.all([
    prisma.gymPlan.findMany({ orderBy: [{ active: 'desc' }, { durationDays: 'asc' }, { price: 'asc' }] }),
    loadMembers(),
  ])
  const onPlan = {}
  for (const m of members) {
    const st = memberState(m.memberships, today)
    if (['active', 'expiring', 'frozen'].includes(st.status) && st.current?.planId) {
      onPlan[st.current.planId] = (onPlan[st.current.planId] || 0) + 1
    }
  }
  res.json({ plans: plans.map((p) => ({ ...p, activeMembers: onPlan[p.id] || 0 })) })
})

export const createPlan = handle('createPlan', async (req, res) => {
  const plan = await prisma.gymPlan.create({ data: { ...req.body, active: req.body.active ?? true } })
  res.status(201).json({ plan: { ...plan, activeMembers: 0 } })
})

export const updatePlan = handle('updatePlan', async (req, res) => {
  const p = await prisma.gymPlan.findFirst({ where: { id: req.params.id } })
  if (!p) throw notFound('Plan')
  // Price / length changes apply to new sales only: memberships keep their snapshot.
  const plan = await prisma.gymPlan.update({ where: { id: p.id }, data: req.body })
  res.json({ plan })
})

// DELETE /gym/plans/:id — a plan that was ever sold is retired, not deleted.
export const deletePlan = handle('deletePlan', async (req, res) => {
  const p = await prisma.gymPlan.findFirst({ where: { id: req.params.id } })
  if (!p) throw notFound('Plan')
  const sold = await prisma.gymMembership.count({ where: { planId: p.id } })
  if (sold) {
    await prisma.gymPlan.update({ where: { id: p.id }, data: { active: false } })
    return res.json({ ok: true, retired: true })
  }
  await prisma.gymPlan.delete({ where: { id: p.id } })
  res.json({ ok: true, retired: false })
})

// ── Hotel / PG guests ────────────────────────────────────────────────────────

// GET /gym/guests — in-house guests, to sign one up as a member.
export const getInHouseGuests = handle('getInHouseGuests', async (req, res) => {
  const [guests, members] = await Promise.all([
    prisma.guest.findMany({
      where: { deletedAt: null, status: { in: ['Active', 'Due'] } },
      select: { id: true, name: true, phone: true, email: true, gender: true, address: true, room: { select: { number: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.gymMember.findMany({ where: { deletedAt: null, guestId: { not: null } }, select: { guestId: true } }),
  ])
  const taken = new Set(members.map((m) => m.guestId))
  res.json({ guests: guests.map((g) => ({ ...g, roomNumber: g.room?.number || null, room: undefined, isMember: taken.has(g.id) })) })
})

// ── Dashboard ────────────────────────────────────────────────────────────────

// GET /gym/dashboard — KPIs, 6-month trend, plan mix, who the members are, and
// the follow-up lists (expiring, dues).
export const getDashboard = handle('getDashboard', async (req, res) => {
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  // Same point in last month (day-of-month capped), for a like-for-like trend.
  const prevSameDay = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(),
    Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()), 23, 59, 59)

  const [rawMembers, payments, plans] = await Promise.all([
    loadMembers(),
    prisma.gymPayment.findMany({
      where: { paidAt: { gte: trendStart }, member: { deletedAt: null } },
      select: { amount: true, mode: true, paidAt: true, membership: { select: { planName: true } }, member: { select: { id: true, name: true, memberNo: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.gymPlan.count({ where: { active: true } }),
  ])
  const members = rawMembers.map((m) => ({ raw: m, ...memberOut(m, today) }))
  const isLive = (m) => ['active', 'expiring'].includes(m.status)
  const liveMembers = members.filter(isLive)

  const sum = (rows) => round2(rows.reduce((n, p) => n + p.amount, 0))
  const revenueThis = sum(payments.filter((p) => p.paidAt >= monthStart))
  const revenueLastToDate = sum(payments.filter((p) => p.paidAt >= prevMonthStart && p.paidAt <= prevSameDay))
  const revenueLast = sum(payments.filter((p) => p.paidAt >= prevMonthStart && p.paidAt < monthStart))

  // Renewal rate: plans that ended in the last 90 days → did the member buy another?
  const since = addDays(today, -90)
  let ended = 0
  let renewed = 0
  for (const m of members) {
    const ms = live(m.raw.memberships)
    for (const x of ms) {
      if (x.endDate >= since && x.endDate < today) {
        ended++
        if (ms.some((y) => y.id !== x.id && y.startDate > x.startDate)) renewed++
      }
    }
  }

  // 6-month trend.
  const months = []
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const trend = Object.fromEntries(months.map((k) => [k, { month: k, revenue: 0, newMembers: 0, signups: 0, renewals: 0 }]))
  for (const p of payments) { const t = trend[monthKey(p.paidAt)]; if (t) t.revenue = round2(t.revenue + p.amount) }
  for (const m of members) {
    const t = trend[monthKey(new Date(m.joinedAt))]; if (t) t.newMembers++
    for (const x of live(m.raw.memberships)) {
      const tm = trend[monthKey(x.createdAt)]
      if (tm) tm[x.isRenewal ? 'renewals' : 'signups']++
    }
  }

  const tally = (rows, key) => {
    const out = {}
    for (const r of rows) { const k = key(r) || 'unknown'; out[k] = (out[k] || 0) + 1 }
    return Object.entries(out).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
  }
  const dues = members.filter((m) => m.due > 0)
  const brief = (m) => ({
    id: m.id, name: m.name, phone: m.phone, memberNo: m.memberNo, status: m.status, daysLeft: m.daysLeft,
    due: m.due, planName: m.current?.planName || null, endDate: m.current?.endDate || null,
  })

  res.json({
    kpis: {
      active: liveMembers.length,
      total: members.length,
      expiring: members.filter((m) => m.status === 'expiring').length,
      expiredRecently: members.filter((m) => m.status === 'expired' && m.daysLeft >= -30).length,
      expired: members.filter((m) => m.status === 'expired').length,
      frozen: members.filter((m) => m.status === 'frozen').length,
      newThisMonth: members.filter((m) => new Date(m.joinedAt) >= monthStart).length,
      revenueThisMonth: revenueThis,
      revenueLastMonth: revenueLast,
      revenueTrend: revenueLastToDate ? Math.round(((revenueThis - revenueLastToDate) / revenueLastToDate) * 1000) / 10 : null,
      duesAmount: round2(dues.reduce((n, m) => n + m.due, 0)),
      duesMembers: dues.length,
      renewalRate: ended ? Math.round((renewed / ended) * 1000) / 10 : null,
      renewalBase: ended,
      revenuePerMember: liveMembers.length ? round2(revenueThis / liveMembers.length) : 0,
      activePlans: plans,
    },
    trend: months.map((k) => trend[k]),
    planMix: tally(liveMembers, (m) => m.current?.planName),
    sources: tally(liveMembers, (m) => (m.guestId || m.source === 'guest' ? 'guest' : 'outside')),
    genders: tally(liveMembers, (m) => m.gender),
    goals: tally(liveMembers, (m) => m.goal),
    payModes: tally(payments.filter((p) => p.paidAt >= monthStart), (p) => p.mode)
      .map((r) => ({ ...r, amount: sum(payments.filter((p) => p.paidAt >= monthStart && p.mode === r.key)) })),
    expiring: members
      .filter((m) => m.status === 'expiring' || (m.status === 'expired' && m.daysLeft >= -7))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10).map(brief),
    topDues: [...dues].sort((a, b) => b.due - a.due).slice(0, 6).map(brief),
    recentPayments: payments.slice(0, 8).map((p) => ({
      amount: p.amount, mode: p.mode, paidAt: p.paidAt, planName: p.membership?.planName, member: p.member,
    })),
  })
})
