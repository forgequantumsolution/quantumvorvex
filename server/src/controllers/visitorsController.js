/**
 * Visitors — the property's visitor register (gate / front-desk log).
 *
 * Two ways in:
 *   - QR self-registration: each property has one QR (/visit?t=<visitorToken>).
 *     The visitor fills the form on their phone; the entry lands as "pending"
 *     for the desk to approve (or straight in as "checked_in" when the property
 *     auto-approves). The visitor keeps a live pass page (/visit?p=<passToken>).
 *   - Desk entry: staff record a walk-in (checked in now) or pre-register an
 *     expected visitor.
 *
 * Lifecycle: expected → pending → checked_in → checked_out, or rejected.
 * Phones on the property's blocklist are flagged, never silently refused.
 * Rows are soft-deleted (deletedAt), and only the owner or an admin may delete.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { runWithProperty, runUnscoped } from '../utils/propertyContext.js'
import { VISITOR_PURPOSES } from '../middleware/validate.js'
import { isPropertyAdmin } from '../utils/roles.js'


const newToken = () => crypto.randomBytes(16).toString('hex')
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const pad = (n, w = 2) => String(n).padStart(w, '0')

const fail = (res, label, e) => {
  logger.error(`${label} error`, { error: e.message })
  res.status(500).json({ message: 'Internal server error.' })
}
const notFound = (res) => res.status(404).json({ message: 'Visitor not found.', code: 'ERR_NOT_FOUND' })
const forbidden = (res, message) => res.status(403).json({ message, code: 'ERR_FORBIDDEN' })

// Show only the last 4 characters of an ID number in lists.
const maskId = (v) => (v ? (v.length <= 4 ? v : `${'•'.repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`) : null)
const forList = (v) => ({ ...v, idNumber: maskId(v.idNumber), passToken: undefined })

const findLive = (id) => prisma.visitor.findFirst({ where: { id, deletedAt: null } })
const isBlocked = (phone) => prisma.visitorBlock.findFirst({ where: { phone } })

// Pass number V261112-03: day + that day's sequence at this property. Retries on
// the (propertyId, passNo) unique index if two registrations race.
async function createWithPassNo(data) {
  const day = startOfToday()
  const prefix = `V${pad(day.getFullYear() % 100)}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = (await prisma.visitor.count({ where: { createdAt: { gte: day } } })) + 1 + attempt
    try {
      return await prisma.visitor.create({ data: { ...data, passNo: `${prefix}-${pad(n)}`, passToken: newToken() } })
    } catch (e) {
      if (e.code !== 'P2002') throw e
    }
  }
  throw new Error('Could not allocate a pass number')
}

// Aadhaar is 12 digits; store it without the spaces people type. Returns an
// error message, or null (normalising body.idNumber in place).
function checkAadhaar(body, current = {}) {
  const type = 'idType' in body ? body.idType : current.idType
  if (!body.idNumber || type !== 'aadhaar') return null
  const digits = String(body.idNumber).replace(/[\s-]/g, '')
  if (!/^\d{12}$/.test(digits)) return 'Aadhaar number must be 12 digits.'
  body.idNumber = digits
  return null
}
const aadhaarInvalid = (res, message) => res.status(400).json({
  error: 'Validation failed', code: 'ERR_VALIDATION', message, details: [{ field: 'idNumber', message }],
})

// ── ID scans (Aadhaar front/back) ────────────────────────────────────────────
// Kept outside the public /uploads folder: only signed-in staff can open them.

const visitorDocsDir = path.resolve('private-uploads/visitors')
fs.mkdirSync(visitorDocsDir, { recursive: true })
const DOC_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }
const DOC_SIDES = ['front', 'back']

const visitorUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, visitorDocsDir),
    // Random names: nothing about the visitor in the file name.
    filename: (req, file, cb) => cb(null, `${newToken()}${DOC_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => (DOC_EXT[file.mimetype]
    ? cb(null, true)
    : cb(new Error('Only JPG, PNG, WebP or PDF files are allowed.'))),
}).fields(DOC_SIDES.map((name) => ({ name, maxCount: 1 })))

// Multipart fields "front" / "back"; upload errors become a 400.
export const receiveVisitorDocs = (req, res, next) => visitorUpload(req, res, (err) => {
  if (!err) return next()
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 8 MB or smaller.' : err.message
  res.status(400).json({ message, code: 'ERR_UPLOAD' })
})

const removeFile = (name) => fs.promises.unlink(path.join(visitorDocsDir, path.basename(name))).catch(() => {})
const discardUploads = (req) => Object.values(req.files || {}).flat().forEach((f) => removeFile(f.filename))
const docOut = (d) => ({ id: d.id, side: d.side, mimeType: d.mimeType, createdAt: d.createdAt })

// Save the uploaded sides, replacing (and deleting) any earlier scan of that side.
async function storeDocs(visitorId, req) {
  const saved = []
  for (const side of DOC_SIDES) {
    const f = req.files?.[side]?.[0]
    if (!f) continue
    const old = await prisma.visitorDocument.findFirst({ where: { visitorId, side } })
    const data = { fileName: f.filename, mimeType: f.mimetype }
    saved.push(old
      ? await prisma.visitorDocument.update({ where: { id: old.id }, data: { ...data, createdAt: new Date() } })
      : await prisma.visitorDocument.create({ data: { visitorId, side, ...data } }))
    if (old) removeFile(old.fileName)
  }
  return saved
}

// POST /visitors/:id/documents — desk upload (multipart "front" / "back").
export const uploadVisitorDocuments = async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) { discardUploads(req); return notFound(res) }
    if (!Object.keys(req.files || {}).length) return res.status(400).json({ message: 'No files uploaded.' })
    const docs = await storeDocs(v.id, req)
    logger.info('Visitor ID scans uploaded', { event: 'VISITOR', passNo: v.passNo, sides: docs.map((d) => d.side) })
    res.status(201).json({ documents: docs.map(docOut) })
  } catch (e) { discardUploads(req); fail(res, 'uploadVisitorDocuments', e) }
}

// GET /visitors/:id/documents/:docId — the scan itself, for signed-in staff only.
export const getVisitorDocumentFile = async (req, res) => {
  try {
    const d = await prisma.visitorDocument.findFirst({
      where: { id: req.params.docId, visitorId: req.params.id, visitor: { deletedAt: null } },
    })
    if (!d) return res.status(404).json({ message: 'Document not found.' })
    res.set('Cache-Control', 'private, no-store')
    res.type(d.mimeType)
    res.sendFile(path.join(visitorDocsDir, path.basename(d.fileName)), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'Document file is missing.' })
    })
  } catch (e) { fail(res, 'getVisitorDocumentFile', e) }
}

// DELETE /visitors/:id/documents/:docId
export const deleteVisitorDocument = async (req, res) => {
  try {
    const d = await prisma.visitorDocument.findFirst({ where: { id: req.params.docId, visitorId: req.params.id } })
    if (!d) return res.status(404).json({ message: 'Document not found.' })
    await prisma.visitorDocument.delete({ where: { id: d.id } })
    removeFile(d.fileName)
    res.json({ ok: true })
  } catch (e) { fail(res, 'deleteVisitorDocument', e) }
}

// ── Register ─────────────────────────────────────────────────────────────────

const TABS = {
  inside:   () => ({ status: 'checked_in' }),
  pending:  () => ({ status: 'pending' }),
  expected: () => ({ status: 'expected' }),
  today:    () => ({ OR: [{ createdAt: { gte: startOfToday() } }, { checkInAt: { gte: startOfToday() } }, { status: 'checked_in' }] }),
  all:      () => ({}),
}

// GET /visitors?tab=inside|pending|expected|today|all&search&from&to&page&limit
// counts are for the whole property, independent of the tab and search.
export const getVisitors = async (req, res) => {
  try {
    const tab = TABS[req.query.tab] ? req.query.tab : 'today'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25))
    const where = { deletedAt: null, ...TABS[tab]() }
    const and = []
    const search = String(req.query.search || '').trim()
    if (search) {
      and.push({ OR: ['name', 'phone', 'company', 'hostName', 'roomNumber', 'passNo', 'vehicleNo']
        .map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) })
    }
    const from = req.query.from && new Date(`${req.query.from}T00:00:00`)
    const to = req.query.to && new Date(`${req.query.to}T23:59:59.999`)
    if (from && !Number.isNaN(+from)) and.push({ createdAt: { gte: from } })
    if (to && !Number.isNaN(+to)) and.push({ createdAt: { lte: to } })
    if (and.length) where.AND = and

    const today = startOfToday()
    const live = { deletedAt: null }
    const [visitors, total, inside, pending, expected, todayCount, outToday] = await Promise.all([
      prisma.visitor.findMany({
        where,
        // Waiting and inside first, then newest.
        orderBy: tab === 'inside' ? [{ checkInAt: 'desc' }] : [{ createdAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.visitor.count({ where }),
      prisma.visitor.count({ where: { ...live, status: 'checked_in' } }),
      prisma.visitor.count({ where: { ...live, status: 'pending' } }),
      prisma.visitor.count({ where: { ...live, status: 'expected' } }),
      prisma.visitor.count({ where: { ...live, OR: [{ createdAt: { gte: today } }, { checkInAt: { gte: today } }] } }),
      prisma.visitor.count({ where: { ...live, checkOutAt: { gte: today } } }),
    ])
    res.json({
      visitors: visitors.map(forList), total, page, limit,
      counts: { inside, pending, expected, today: todayCount, checkedOutToday: outToday },
    })
  } catch (e) { fail(res, 'getVisitors', e) }
}

// GET /visitors/lookup?phone= — the returning visitor's last details (to prefill
// the desk form) and whether the phone is blocked.
export const lookupVisitor = async (req, res) => {
  try {
    const phone = String(req.query.phone || '').replace(/[\s-]/g, '')
    if (!/^\+?\d{7,15}$/.test(phone)) return res.json({ visitor: null, visits: 0, blocked: null })
    const [last, visits, block] = await Promise.all([
      prisma.visitor.findFirst({ where: { phone, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.visitor.count({ where: { phone, deletedAt: null } }),
      isBlocked(phone),
    ])
    const visitor = last && {
      name: last.name, email: last.email, company: last.company, idType: last.idType,
      idNumber: last.idNumber, vehicleNo: last.vehicleNo, lastVisitAt: last.createdAt,
    }
    res.json({ visitor, visits, blocked: block ? { reason: block.reason, at: block.createdAt } : null })
  } catch (e) { fail(res, 'lookupVisitor', e) }
}

// GET /visitors/:id — the full entry, who handled it, visit count, block state.
export const getVisitor = async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    const userIds = [v.createdById, v.checkedInById].filter(Boolean)
    const [users, visits, block, documents] = await Promise.all([
      userIds.length
        ? runUnscoped(() => prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }))
        : [],
      prisma.visitor.count({ where: { phone: v.phone, deletedAt: null } }),
      isBlocked(v.phone),
      prisma.visitorDocument.findMany({ where: { visitorId: v.id }, orderBy: { side: 'desc' } }),
    ])
    const nameOf = (id) => users.find((u) => u.id === id)?.name || null
    res.json({
      visitor: {
        ...v, passToken: undefined, createdByName: nameOf(v.createdById), checkedInByName: nameOf(v.checkedInById),
        documents: documents.map(docOut),
      },
      visits,
      blocked: block ? { reason: block.reason, at: block.createdAt } : null,
      canDelete: isPropertyAdmin(req.propertyAccess),
    })
  } catch (e) { fail(res, 'getVisitor', e) }
}

// POST /visitors — desk entry. checkIn → in now; expectedAt → pre-registered.
export const createVisitor = async (req, res) => {
  try {
    const { checkIn, expectedAt, companions, ...fields } = req.body
    const idError = checkAadhaar(fields)
    if (idError) return aadhaarInvalid(res, idError)
    const now = new Date()
    const status = expectedAt && !checkIn ? 'expected' : 'checked_in'
    const flagged = !!(await isBlocked(fields.phone))
    const visitor = await createWithPassNo({
      ...fields,
      companions: companions ?? 0,
      source: 'desk',
      status,
      expectedAt: expectedAt ? new Date(expectedAt) : null,
      checkInAt: status === 'checked_in' ? now : null,
      checkedInById: status === 'checked_in' ? req.user?.userId || null : null,
      createdById: req.user?.userId || null,
      flagged,
    })
    logger.info('Visitor registered', { event: 'VISITOR', passNo: visitor.passNo, source: 'desk', status })
    res.status(201).json({ visitor: forList(visitor) })
  } catch (e) { fail(res, 'createVisitor', e) }
}

// PUT /visitors/:id — correct the details (status changes have their own routes).
export const updateVisitor = async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    const data = { ...req.body }
    const idError = checkAadhaar(data, v)
    if (idError) return aadhaarInvalid(res, idError)
    if ('expectedAt' in data) data.expectedAt = data.expectedAt ? new Date(data.expectedAt) : null
    if (data.phone && data.phone !== v.phone) data.flagged = !!(await isBlocked(data.phone))
    const visitor = await prisma.visitor.update({ where: { id: v.id }, data })
    res.json({ visitor: forList(visitor) })
  } catch (e) { fail(res, 'updateVisitor', e) }
}

// Moves one visitor from one of `from` statuses to `to`, or 409s.
const transition = (label, from, build) => async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    if (!from.includes(v.status)) {
      return res.status(409).json({ message: `This visitor is already ${v.status.replace('_', ' ')}.`, code: 'ERR_VISITOR_STATE', status: v.status })
    }
    const visitor = await prisma.visitor.update({ where: { id: v.id }, data: build(req, v) })
    logger.info(`Visitor ${label}`, { event: 'VISITOR', passNo: v.passNo })
    res.json({ visitor: forList(visitor) })
  } catch (e) { fail(res, `visitor ${label}`, e) }
}

// POST /visitors/:id/check-in — approve a QR registration / admit an expected visitor.
export const checkInVisitor = transition('checked in', ['pending', 'expected'], (req) => ({
  status: 'checked_in', checkInAt: new Date(), checkedInById: req.user?.userId || null, rejectReason: null,
}))
// POST /visitors/:id/reject { reason }
export const rejectVisitor = transition('rejected', ['pending', 'expected'], (req) => ({
  status: 'rejected', rejectReason: req.body.reason || null,
}))
// POST /visitors/:id/check-out
export const checkOutVisitor = transition('checked out', ['checked_in'], () => ({
  status: 'checked_out', checkOutAt: new Date(),
}))

// POST /visitors/:id/block { reason } — block this visitor's phone at the property.
export const blockVisitor = async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    const reason = req.body.reason || null
    await prisma.visitorBlock.upsert({
      where: { propertyId_phone: { propertyId: req.propertyId, phone: v.phone } },
      update: { reason },
      create: { phone: v.phone, reason, createdById: req.user?.userId || null },
    })
    await prisma.visitor.updateMany({ where: { phone: v.phone, status: { in: ['pending', 'expected', 'checked_in'] } }, data: { flagged: true } })
    res.json({ blocked: { reason } })
  } catch (e) { fail(res, 'blockVisitor', e) }
}

// DELETE /visitors/:id/block — lift the block on this visitor's phone.
export const unblockVisitor = async (req, res) => {
  try {
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    await prisma.visitorBlock.deleteMany({ where: { phone: v.phone } })
    await prisma.visitor.updateMany({ where: { phone: v.phone }, data: { flagged: false } })
    res.json({ blocked: null })
  } catch (e) { fail(res, 'unblockVisitor', e) }
}

// DELETE /visitors/:id — owner or admin only.
export const deleteVisitor = async (req, res) => {
  try {
    if (!isPropertyAdmin(req.propertyAccess)) return forbidden(res, 'Only the owner or an admin can delete visitor entries.')
    const v = await findLive(req.params.id)
    if (!v) return notFound(res)
    await prisma.visitor.update({ where: { id: v.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true })
  } catch (e) { fail(res, 'deleteVisitor', e) }
}

// ── The property's QR ────────────────────────────────────────────────────────

const qrPayload = (p, pa) => ({
  token: p.visitorToken, autoApprove: p.visitorAutoApprove, propertyName: p.name, canAdmin: isPropertyAdmin(pa),
})

// GET /visitors/qr — the property's visitor QR token (created on first use).
export const getVisitorQr = async (req, res) => {
  try {
    let p = await runUnscoped(() => prisma.property.findUnique({ where: { id: req.propertyId } }))
    if (!p.visitorToken) {
      p = await runUnscoped(() => prisma.property.update({ where: { id: p.id }, data: { visitorToken: newToken() } }))
    }
    res.json(qrPayload(p, req.propertyAccess))
  } catch (e) { fail(res, 'getVisitorQr', e) }
}

// POST /visitors/qr/regenerate — a new token; every printed QR stops working.
export const regenerateVisitorQr = async (req, res) => {
  try {
    if (!isPropertyAdmin(req.propertyAccess)) return forbidden(res, 'Only the owner or an admin can replace the visitor QR.')
    const p = await runUnscoped(() => prisma.property.update({ where: { id: req.propertyId }, data: { visitorToken: newToken() } }))
    logger.info('Visitor QR regenerated', { event: 'VISITOR', propertyId: p.id })
    res.json(qrPayload(p, req.propertyAccess))
  } catch (e) { fail(res, 'regenerateVisitorQr', e) }
}

// PUT /visitors/settings { autoApprove }
export const updateVisitorSettings = async (req, res) => {
  try {
    if (!isPropertyAdmin(req.propertyAccess)) return forbidden(res, 'Only the owner or an admin can change visitor settings.')
    const p = await runUnscoped(() => prisma.property.update({
      where: { id: req.propertyId }, data: { visitorAutoApprove: req.body.autoApprove },
    }))
    res.json(qrPayload(p, req.propertyAccess))
  } catch (e) { fail(res, 'updateVisitorSettings', e) }
}

// ── Public (no login) ────────────────────────────────────────────────────────
// Authorised by the property's visitor token, or by a visitor's own pass token.

const QR_INVALID = { message: 'This QR code is no longer valid. Please ask at the reception.', code: 'ERR_QR_INVALID' }

const propertyByToken = async (token) => {
  if (!token || String(token).length < 16) return null
  const p = await runUnscoped(() => prisma.property.findUnique({ where: { visitorToken: String(token) } }))
  return p && p.status === 'active' ? p : null
}

// The name and logo the visitor sees: the property's saved business profile.
const brandOf = async (p) => {
  const hotel = await runWithProperty(p.id, () => prisma.hotel.findFirst({ select: { name: true, logoUrl: true, address: true } }))
  return { name: hotel?.name || p.name, logoUrl: hotel?.logoUrl || null, address: hotel?.address || null }
}

const publicPass = (v, brand) => ({
  passNo: v.passNo, name: v.name, purpose: v.purpose, hostName: v.hostName, roomNumber: v.roomNumber,
  companions: v.companions, status: v.status, createdAt: v.createdAt, checkInAt: v.checkInAt,
  checkOutAt: v.checkOutAt, rejectReason: v.rejectReason, property: brand,
})

// GET /public/visit/:token — what the QR form needs.
export const getPublicVisitForm = async (req, res) => {
  try {
    const p = await propertyByToken(req.params.token)
    if (!p) return res.status(404).json(QR_INVALID)
    res.json({ property: await brandOf(p), autoApprove: p.visitorAutoApprove, purposes: VISITOR_PURPOSES })
  } catch (e) { fail(res, 'getPublicVisitForm', e) }
}

// POST /public/visit/:token — a visitor registers. status / source / flags are
// decided here, never taken from the request.
export const submitPublicVisit = async (req, res) => {
  try {
    const p = await propertyByToken(req.params.token)
    if (!p) return res.status(404).json(QR_INVALID)
    const { consent, companions, ...fields } = req.body
    const idError = checkAadhaar(fields)
    if (idError) return aadhaarInvalid(res, idError)
    const result = await runWithProperty(p.id, async () => {
      const flagged = !!(await isBlocked(fields.phone))
      // A blocked phone always waits for the desk, even when auto-approve is on.
      const autoIn = p.visitorAutoApprove && !flagged
      const now = new Date()
      const visitor = await createWithPassNo({
        ...fields,
        companions: companions ?? 0,
        source: 'qr',
        status: autoIn ? 'checked_in' : 'pending',
        checkInAt: autoIn ? now : null,
        consentAt: consent ? now : null,
        flagged,
      })
      const who = `${visitor.name}${visitor.hostName ? ` to meet ${visitor.hostName}` : ''}`
      await prisma.notification.create({
        data: flagged
          ? { type: 'danger', message: `Blocked visitor at the gate: ${who} (${visitor.passNo})` }
          : autoIn
            ? { type: 'info', message: `Visitor checked in by QR: ${who} (${visitor.passNo})` }
            : { type: 'warning', message: `Visitor waiting for approval: ${who} (${visitor.passNo})` },
      })
      return visitor
    })
    logger.info('Visitor registered', { event: 'VISITOR', passNo: result.passNo, source: 'qr', propertyId: p.id })
    res.status(201).json({ passToken: result.passToken, pass: publicPass(result, await brandOf(p)) })
  } catch (e) { fail(res, 'submitPublicVisit', e) }
}

const visitorByPass = async (passToken) => {
  if (!passToken || String(passToken).length < 16) return null
  const v = await runUnscoped(() => prisma.visitor.findUnique({ where: { passToken: String(passToken) } }))
  return v && !v.deletedAt ? v : null
}

// GET /public/pass/:passToken — the visitor's own pass, polled for its status.
export const getPublicPass = async (req, res) => {
  try {
    const v = await visitorByPass(req.params.passToken)
    if (!v) return res.status(404).json({ message: 'This visitor pass was not found.', code: 'ERR_PASS_INVALID' })
    const p = await runUnscoped(() => prisma.property.findUnique({ where: { id: v.propertyId } }))
    res.json({ pass: publicPass(v, await brandOf(p)) })
  } catch (e) { fail(res, 'getPublicPass', e) }
}

// POST /public/pass/:passToken/checkout — the visitor signs out on the way out.
export const publicCheckOut = async (req, res) => {
  try {
    const v = await visitorByPass(req.params.passToken)
    if (!v) return res.status(404).json({ message: 'This visitor pass was not found.', code: 'ERR_PASS_INVALID' })
    if (v.status !== 'checked_in') {
      return res.status(409).json({ message: 'You are not checked in.', code: 'ERR_VISITOR_STATE', status: v.status })
    }
    const updated = await runWithProperty(v.propertyId, () => prisma.visitor.update({
      where: { id: v.id }, data: { status: 'checked_out', checkOutAt: new Date() },
    }))
    const p = await runUnscoped(() => prisma.property.findUnique({ where: { id: v.propertyId } }))
    res.json({ pass: publicPass(updated, await brandOf(p)) })
  } catch (e) { fail(res, 'publicCheckOut', e) }
}

// POST /public/pass/:passToken/documents — the visitor adds their ID scans just
// after registering (multipart "front" / "back"). Closed after 30 minutes.
const PUBLIC_UPLOAD_WINDOW_MS = 30 * 60 * 1000
export const publicUploadDocuments = async (req, res) => {
  try {
    const v = await visitorByPass(req.params.passToken)
    if (!v) { discardUploads(req); return res.status(404).json({ message: 'This visitor pass was not found.', code: 'ERR_PASS_INVALID' }) }
    const open = ['pending', 'expected', 'checked_in'].includes(v.status) && Date.now() - v.createdAt.getTime() < PUBLIC_UPLOAD_WINDOW_MS
    if (!open) {
      discardUploads(req)
      return res.status(409).json({ message: 'ID scans can only be added right after registering. Please show your ID at the desk.', code: 'ERR_UPLOAD_CLOSED' })
    }
    if (!Object.keys(req.files || {}).length) return res.status(400).json({ message: 'No files uploaded.' })
    const docs = await runWithProperty(v.propertyId, () => storeDocs(v.id, req))
    res.status(201).json({ uploaded: docs.map((d) => d.side) })
  } catch (e) { discardUploads(req); fail(res, 'publicUploadDocuments', e) }
}
