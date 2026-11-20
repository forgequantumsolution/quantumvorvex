/**
 * Private ID scans (Aadhaar front / back) for a record type.
 *
 * Files live under server/private-uploads/<folder>, outside the public /uploads
 * folder, and are only streamed to signed-in staff through a controller. The
 * caller owns the Prisma model ({ id, <ownerKey>, side, fileName, mimeType,
 * createdAt }, unique on [ownerKey, side]).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

const DOC_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }
export const SCAN_SIDES = ['front', 'back']

export const scanOut = (d) => ({ id: d.id, side: d.side, mimeType: d.mimeType, createdAt: d.createdAt })

export function idScanStore(folder) {
  const dir = path.resolve('private-uploads', folder)
  fs.mkdirSync(dir, { recursive: true })

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      // Random names: nothing about the person in the file name.
      filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${DOC_EXT[file.mimetype]}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 2 },
    fileFilter: (req, file, cb) => (DOC_EXT[file.mimetype]
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG, WebP or PDF files are allowed.'))),
  }).fields(SCAN_SIDES.map((name) => ({ name, maxCount: 1 })))

  const removeFile = (name) => fs.promises.unlink(path.join(dir, path.basename(name))).catch(() => {})

  return {
    // Middleware: multipart fields "front" / "back"; upload errors become a 400.
    receive: (req, res, next) => upload(req, res, (err) => {
      if (!err) return next()
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 8 MB or smaller.' : err.message
      res.status(400).json({ message, code: 'ERR_UPLOAD' })
    }),
    removeFile,
    discard: (req) => Object.values(req.files || {}).flat().forEach((f) => removeFile(f.filename)),
    hasFiles: (req) => Object.keys(req.files || {}).length > 0,

    /** Save the uploaded sides on `model`, replacing (and deleting) an earlier scan of that side. */
    async store(model, ownerKey, ownerId, req) {
      const saved = []
      for (const side of SCAN_SIDES) {
        const f = req.files?.[side]?.[0]
        if (!f) continue
        const old = await model.findFirst({ where: { [ownerKey]: ownerId, side } })
        const data = { fileName: f.filename, mimeType: f.mimetype }
        saved.push(old
          ? await model.update({ where: { id: old.id }, data: { ...data, createdAt: new Date() } })
          : await model.create({ data: { [ownerKey]: ownerId, side, ...data } }))
        if (old) removeFile(old.fileName)
      }
      return saved
    },

    /** Stream one scan; never cached. */
    send(res, doc) {
      res.set('Cache-Control', 'private, no-store')
      res.type(doc.mimeType)
      res.sendFile(path.join(dir, path.basename(doc.fileName)), (err) => {
        if (err && !res.headersSent) res.status(404).json({ message: 'Document file is missing.' })
      })
    },
  }
}
