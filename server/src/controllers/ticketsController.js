/**
 * Tickets — the property's internal task tracker.
 *
 * Someone raises a ticket and assigns it to a team member. The assignee works
 * it: open → in_progress ⇄ on_hold → resolved. The person who raised it (or an
 * admin) then checks the work: verify → closed, or reopen → back to the
 * assignee. cancel ends it without the work being done. Every change is logged
 * in TicketActivity, and a checklist breaks the work into steps.
 *
 * Who sees what: owners / admins / managers see every ticket at the property.
 * Everyone else sees tickets they raised, tickets assigned to them, and the
 * unassigned queue (so anyone can pick work up).
 *
 * Who may do what (see permissionsFor):
 *   raiser or admin — edit details, (re)assign, verify, reopen, cancel
 *   assignee or admin — start, hold, resume, resolve
 *   anyone who can see it — comment; take it if unassigned
 *   admin — delete
 */
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { runUnscoped } from '../utils/propertyContext.js'
import { isPropertyAdmin } from '../utils/roles.js'

const ACTIVE = ['open', 'in_progress', 'on_hold']
const DONE = ['resolved', 'closed', 'cancelled']

const fail = (res, label, e) => {
  logger.error(`${label} error`, { error: e.message })
  res.status(500).json({ message: 'Internal server error.' })
}
const notFound = (res) => res.status(404).json({ message: 'Ticket not found.', code: 'ERR_NOT_FOUND' })
const forbidden = (res, message) => res.status(403).json({ message, code: 'ERR_FORBIDDEN' })

const me = (req) => req.user?.userId
const isAdmin = (req) => isPropertyAdmin(req.propertyAccess)

// Tickets this user may see at the current property.
const visibleWhere = (req) => (isAdmin(req)
  ? { deletedAt: null }
  : { deletedAt: null, OR: [{ createdById: me(req) }, { assigneeId: me(req) }, { assigneeId: null }] })

const findVisible = (req, id) => prisma.ticket.findFirst({ where: { id, ...visibleWhere(req) } })

export function permissionsFor(req, t) {
  const admin = isAdmin(req)
  const raiser = t.createdById === me(req)
  const assignee = !!t.assigneeId && t.assigneeId === me(req)
  const active = ACTIVE.includes(t.status)
  const owner = admin || raiser
  const worker = admin || assignee
  return {
    edit: owner && t.status !== 'closed' && t.status !== 'cancelled',
    assign: owner && !DONE.includes(t.status),
    take: !t.assigneeId && active,
    start: worker && t.status === 'open',
    hold: worker && (t.status === 'open' || t.status === 'in_progress'),
    resume: worker && t.status === 'on_hold',
    resolve: worker && active,
    verify: owner && t.status === 'resolved',
    reopen: owner && DONE.includes(t.status),
    cancel: owner && active,
    checklist: (owner || assignee) && !['closed', 'cancelled'].includes(t.status),
    comment: true,
    delete: admin,
  }
}

// id → name for the given user ids (users are not property-scoped).
async function userNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return {}
  const users = await runUnscoped(() => prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }))
  return Object.fromEntries(users.map((u) => [u.id, u.name]))
}

const log = (ticketId, userId, type, extra = {}) =>
  prisma.ticketActivity.create({ data: { ticketId, userId: userId || null, type, ...extra } })

// TK-0001 — per-property sequence; retries if two tickets race for a number.
async function createWithNumber(data) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = (await prisma.ticket.count()) + 1 + attempt
    try {
      return await prisma.ticket.create({ data: { ...data, ticketNo: `TK-${String(n).padStart(4, '0')}` } })
    } catch (e) {
      if (e.code !== 'P2002') throw e
    }
  }
  throw new Error('Could not allocate a ticket number')
}

// ── Assignees ────────────────────────────────────────────────────────────────

// Active users who can open this property and its Tickets page: org owners,
// plus members whose role here has tickets access.
async function assigneesFor(propertyId) {
  const users = await runUnscoped(() => prisma.user.findMany({
    where: {
      status: 'active',
      OR: [{ roleRef: { isOwner: true } }, { propertyAccess: { some: { propertyId } } }],
    },
    select: {
      id: true, name: true, email: true,
      roleRef: { select: { name: true, isOwner: true } },
      propertyAccess: {
        where: { propertyId },
        select: { role: { select: { name: true, isOwner: true, permissions: { where: { module: 'tickets' }, select: { level: true } } } } },
      },
    },
    orderBy: { name: 'asc' },
  }))
  return users
    .map((u) => {
      const here = u.propertyAccess[0]?.role
      const owner = !!u.roleRef?.isOwner || !!here?.isOwner
      const level = owner ? 'MANAGE' : here?.permissions[0]?.level || 'NONE'
      return { id: u.id, name: u.name, email: u.email, role: owner ? (u.roleRef?.name || here?.name) : here?.name, level }
    })
    .filter((u) => u.level !== 'NONE')
}

// GET /tickets/assignees
export const getAssignees = async (req, res) => {
  try {
    res.json({ assignees: await assigneesFor(req.propertyId), me: me(req), admin: isAdmin(req) })
  } catch (e) { fail(res, 'getAssignees', e) }
}

// ── List ─────────────────────────────────────────────────────────────────────

const TABS = {
  mine:       (req) => ({ assigneeId: me(req), status: { in: ACTIVE } }),
  created:    (req) => ({ createdById: me(req), status: { notIn: ['closed', 'cancelled'] } }),
  open:       () => ({ status: { in: ACTIVE } }),
  unassigned: () => ({ assigneeId: null, status: { in: ACTIVE } }),
  overdue:    () => ({ status: { in: ACTIVE }, dueAt: { lt: new Date() } }),
  verify:     () => ({ status: 'resolved' }),
  closed:     () => ({ status: { in: ['closed', 'cancelled'] } }),
  all:        () => ({}),
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

// GET /tickets?tab&priority&category&assignee&search&page&limit
// counts follow the caller's visibility, not the tab or filters.
export const getTickets = async (req, res) => {
  try {
    const tab = TABS[req.query.tab] ? req.query.tab : 'open'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const base = visibleWhere(req)
    const and = [base, TABS[tab](req)]
    if (req.query.priority && PRIORITY_RANK[req.query.priority] != null) and.push({ priority: req.query.priority })
    if (req.query.category) and.push({ category: String(req.query.category) })
    if (req.query.assignee) and.push({ assigneeId: req.query.assignee === 'none' ? null : String(req.query.assignee) })
    const search = String(req.query.search || '').trim()
    if (search) {
      and.push({ OR: ['title', 'ticketNo', 'description', 'roomNumber'].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) })
    }
    const where = { AND: and }
    const count = (extra) => prisma.ticket.count({ where: { AND: [base, extra] } })

    const [rows, total, mine, created, open, unassigned, overdue, verify] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: tab === 'closed' ? [{ updatedAt: 'desc' }] : [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
        include: {
          checklist: { select: { done: true } },
          _count: { select: { activity: { where: { type: 'comment' } } } },
        },
      }),
      prisma.ticket.count({ where }),
      count(TABS.mine(req)), count(TABS.created(req)), count(TABS.open()),
      count(TABS.unassigned()), count(TABS.overdue()), count(TABS.verify()),
    ])
    const names = await userNames(rows.flatMap((t) => [t.assigneeId, t.createdById]))
    // Active work first by priority, then due date; everything else newest first.
    const tickets = rows.map((t) => {
      const { checklist, _count, ...rest } = t
      return {
        ...rest,
        assigneeName: names[t.assigneeId] || null,
        createdByName: names[t.createdById] || null,
        checklistTotal: checklist.length,
        checklistDone: checklist.filter((c) => c.done).length,
        comments: _count.activity,
      }
    })
    if (['mine', 'open', 'unassigned', 'overdue'].includes(tab)) {
      tickets.sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        || ((a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity)))
    }
    res.json({ tickets, total, page, limit, counts: { mine, created, open, unassigned, overdue, verify } })
  } catch (e) { fail(res, 'getTickets', e) }
}

// ── One ticket ───────────────────────────────────────────────────────────────

async function ticketPayload(req, t) {
  const [checklist, activity] = await Promise.all([
    prisma.ticketChecklistItem.findMany({ where: { ticketId: t.id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.ticketActivity.findMany({ where: { ticketId: t.id }, orderBy: { createdAt: 'asc' } }),
  ])
  const assigneeIds = activity.filter((a) => a.type === 'assigned').flatMap((a) => [a.fromValue, a.toValue])
  const names = await userNames([t.assigneeId, t.createdById, ...activity.map((a) => a.userId), ...checklist.map((c) => c.doneById), ...assigneeIds])
  return {
    ticket: { ...t, assigneeName: names[t.assigneeId] || null, createdByName: names[t.createdById] || null },
    checklist: checklist.map((c) => ({ ...c, doneByName: names[c.doneById] || null })),
    activity: activity.map((a) => ({
      ...a,
      userName: names[a.userId] || null,
      ...(a.type === 'assigned' ? { fromName: names[a.fromValue] || null, toName: names[a.toValue] || null } : {}),
    })),
    can: permissionsFor(req, t),
  }
}

// GET /tickets/:id
export const getTicket = async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    res.json(await ticketPayload(req, t))
  } catch (e) { fail(res, 'getTicket', e) }
}

const validAssignee = async (propertyId, id) => !id || (await assigneesFor(propertyId)).some((u) => u.id === id)

// POST /tickets
export const createTicket = async (req, res) => {
  try {
    const { checklist = [], assigneeId, dueAt, ...fields } = req.body
    if (!(await validAssignee(req.propertyId, assigneeId))) {
      return res.status(400).json({ message: 'That person cannot be assigned tickets at this property.', code: 'ERR_ASSIGNEE' })
    }
    const ticket = await createWithNumber({
      ...fields,
      assigneeId,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdById: me(req),
      checklist: { create: checklist.map((text, i) => ({ text, sortOrder: i })) },
    })
    await log(ticket.id, me(req), 'created')
    if (assigneeId) await log(ticket.id, me(req), 'assigned', { toValue: assigneeId })
    logger.info('Ticket created', { event: 'TICKET', ticketNo: ticket.ticketNo })
    res.status(201).json(await ticketPayload(req, ticket))
  } catch (e) { fail(res, 'createTicket', e) }
}

const LOGGED_FIELDS = { priority: 'priority', dueAt: 'due' }

// PUT /tickets/:id — edit the details (raiser or admin).
export const updateTicket = async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    if (!permissionsFor(req, t).edit) return forbidden(res, 'Only the person who raised this ticket or an admin can edit it.')
    const data = { ...req.body }
    if ('dueAt' in data) data.dueAt = data.dueAt ? new Date(data.dueAt) : null
    const updated = await prisma.ticket.update({ where: { id: t.id }, data })
    const changed = []
    for (const [field, type] of Object.entries(LOGGED_FIELDS)) {
      if (!(field in data)) continue
      const before = t[field] instanceof Date ? t[field].toISOString() : t[field]
      const after = data[field] instanceof Date ? data[field].toISOString() : data[field]
      if (before !== after) await log(t.id, me(req), type, { fromValue: before, toValue: after })
    }
    for (const f of ['title', 'description', 'category', 'roomNumber']) if (f in data && data[f] !== t[f]) changed.push(f)
    if (changed.length) await log(t.id, me(req), 'edited', { message: changed.join(',') })
    res.json(await ticketPayload(req, updated))
  } catch (e) { fail(res, 'updateTicket', e) }
}

// POST /tickets/:id/assign { assigneeId | null } — reassign, or take an unassigned ticket.
export const assignTicket = async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    const can = permissionsFor(req, t)
    const { assigneeId } = req.body
    const taking = can.take && assigneeId === me(req)
    if (!can.assign && !taking) return forbidden(res, 'Only the person who raised this ticket or an admin can reassign it.')
    if (assigneeId === t.assigneeId) return res.json(await ticketPayload(req, t))
    if (!(await validAssignee(req.propertyId, assigneeId))) {
      return res.status(400).json({ message: 'That person cannot be assigned tickets at this property.', code: 'ERR_ASSIGNEE' })
    }
    // A new person starts from "open"; unassigning puts it back in the queue.
    const data = { assigneeId }
    if (t.status === 'in_progress' || t.status === 'on_hold') { data.status = 'open'; data.startedAt = null }
    const updated = await prisma.ticket.update({ where: { id: t.id }, data })
    await log(t.id, me(req), 'assigned', { fromValue: t.assigneeId, toValue: assigneeId })
    if (data.status) await log(t.id, me(req), 'status', { fromValue: t.status, toValue: 'open' })
    res.json(await ticketPayload(req, updated))
  } catch (e) { fail(res, 'assignTicket', e) }
}

// action → [permission, next status, extra data, note required?]
const ACTIONS = {
  start:   ['start', 'in_progress', () => ({ startedAt: new Date() })],
  hold:    ['hold', 'on_hold', () => ({}), true],
  resume:  ['resume', 'in_progress', () => ({})],
  resolve: ['resolve', 'resolved', () => ({ resolvedAt: new Date() })],
  verify:  ['verify', 'closed', () => ({ closedAt: new Date() })],
  reopen:  ['reopen', null, (t) => ({ resolvedAt: null, closedAt: null, reopenCount: t.reopenCount + 1 }), true],
  cancel:  ['cancel', 'cancelled', () => ({ closedAt: new Date() })],
}

// POST /tickets/:id/status { action, note }
export const changeStatus = async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    const { action, note } = req.body
    const [perm, next, extra, needsNote] = ACTIONS[action]
    if (!permissionsFor(req, t)[perm]) {
      return res.status(409).json({ message: 'This step is not available for this ticket right now.', code: 'ERR_TICKET_STATE', status: t.status })
    }
    if (needsNote && !note) return res.status(400).json({ message: 'Please add a reason.', code: 'ERR_VALIDATION', details: [{ field: 'note', message: 'Please add a reason.' }] })
    // Reopened work goes back to its assignee (or the queue).
    const status = next || (t.assigneeId ? 'in_progress' : 'open')
    const updated = await prisma.ticket.update({ where: { id: t.id }, data: { status, ...extra(t) } })
    await log(t.id, me(req), 'status', { fromValue: t.status, toValue: status, message: note || null })
    logger.info('Ticket status', { event: 'TICKET', ticketNo: t.ticketNo, from: t.status, to: status })
    res.json(await ticketPayload(req, updated))
  } catch (e) { fail(res, 'changeStatus', e) }
}

// POST /tickets/:id/comments { message }
export const addComment = async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    await log(t.id, me(req), 'comment', { message: req.body.message })
    await prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } })
    res.status(201).json(await ticketPayload(req, t))
  } catch (e) { fail(res, 'addComment', e) }
}

// ── Checklist ────────────────────────────────────────────────────────────────

const withChecklistAccess = (label, fn) => async (req, res) => {
  try {
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    if (!permissionsFor(req, t).checklist) return forbidden(res, 'Only the assignee, the person who raised it or an admin can change the checklist.')
    await fn(req, t)
    await prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } })
    res.json(await ticketPayload(req, await prisma.ticket.findFirst({ where: { id: t.id } })))
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message })
    fail(res, label, e)
  }
}

const itemOf = async (t, itemId) => {
  const item = await prisma.ticketChecklistItem.findFirst({ where: { id: itemId, ticketId: t.id } })
  if (!item) throw Object.assign(new Error('Checklist step not found.'), { status: 404 })
  return item
}

// POST /tickets/:id/checklist { text }
export const addChecklistItem = withChecklistAccess('addChecklistItem', async (req, t) => {
  const last = await prisma.ticketChecklistItem.findFirst({ where: { ticketId: t.id }, orderBy: { sortOrder: 'desc' } })
  await prisma.ticketChecklistItem.create({ data: { ticketId: t.id, text: req.body.text, sortOrder: (last?.sortOrder ?? -1) + 1 } })
})

// PUT /tickets/:id/checklist/:itemId { done?, text? }
export const updateChecklistItem = withChecklistAccess('updateChecklistItem', async (req, t) => {
  const item = await itemOf(t, req.params.itemId)
  const data = {}
  if (req.body.text != null) data.text = req.body.text
  if (req.body.done != null && req.body.done !== item.done) {
    data.done = req.body.done
    data.doneById = req.body.done ? me(req) : null
    data.doneAt = req.body.done ? new Date() : null
    await log(t.id, me(req), 'checklist', { message: item.text, toValue: req.body.done ? 'done' : 'undone' })
  }
  await prisma.ticketChecklistItem.update({ where: { id: item.id }, data })
})

// DELETE /tickets/:id/checklist/:itemId
export const deleteChecklistItem = withChecklistAccess('deleteChecklistItem', async (req, t) => {
  const item = await itemOf(t, req.params.itemId)
  await prisma.ticketChecklistItem.delete({ where: { id: item.id } })
})

// DELETE /tickets/:id — admin only, soft delete.
export const deleteTicket = async (req, res) => {
  try {
    if (!isAdmin(req)) return forbidden(res, 'Only the owner or an admin can delete tickets.')
    const t = await findVisible(req, req.params.id)
    if (!t) return notFound(res)
    await prisma.ticket.update({ where: { id: t.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true })
  } catch (e) { fail(res, 'deleteTicket', e) }
}
