import path from 'path'
import fs from 'fs'
import multer from 'multer'
import prisma from '../utils/prisma.js'

// Multer config for document uploads
const docsDir = path.resolve('uploads/documents')
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const safe = path.basename(file.originalname, ext).replace(/\s+/g, '-')
    cb(null, `${safe}-${Date.now()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Only image and PDF files are allowed.'))
  },
})

// GET /documents
export const getDocuments = async (req, res) => {
  try {
    const rows = await prisma.guest.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        docId: true,
        name: true,
        phone: true,
        status: true,
        idType: true,
        idNumber: true,
        room: { select: { number: true } },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        // ID/KYC files captured at booking time live in BookingDocument,
        // linked to a Booking — pull them in via the guest's bookings.
        bookings: {
          select: {
            documents: {
              select: { id: true, docType: true, url: true, verified: true, uploadedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Merge per-guest Document rows with their bookings' BookingDocument rows
    // into a single `documents` array of the shape the client expects.
    const guests = rows.map(({ bookings, ...g }) => {
      const bookingDocs = bookings.flatMap((b) =>
        b.documents.map((d) => ({
          id: d.id,
          guestId: g.id,
          docType: d.docType,
          url: d.url,
          verified: d.verified,
          uploadedAt: d.uploadedAt,
          source: 'booking',
        }))
      )
      const documents = [...g.documents, ...bookingDocs].sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
      )
      return { ...g, documents, _count: { documents: documents.length } }
    })

    // Documents captured at booking time live in BookingDocument linked only by
    // bookingId. A booking has no Guest until check-in, so its docs are invisible
    // to the guest-keyed query above. Surface those orphan bookings (no linked
    // guest) as guest-like rows so their KYC files show up before check-in.
    const orphanBookings = await prisma.booking.findMany({
      where: { guestId: null, documents: { some: {} }, deletedAt: null },
      select: {
        id: true,
        bookingNo: true,
        guestName: true,
        idType: true,
        idNumber: true,
        room: { select: { number: true } },
        documents: {
          select: { id: true, docType: true, url: true, verified: true, uploadedAt: true },
          orderBy: { uploadedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const orphanGuests = orphanBookings.map((b) => {
      const documents = b.documents.map((d) => ({
        id: d.id,
        bookingId: b.id,
        docType: d.docType,
        url: d.url,
        verified: d.verified,
        uploadedAt: d.uploadedAt,
        source: 'booking',
      }))
      return {
        // Prefixed so the client never mistakes this for a real guestId.
        id: `booking:${b.id}`,
        docId: b.bookingNo,
        name: b.guestName,
        phone: null,
        status: 'booking',
        idType: b.idType,
        idNumber: b.idNumber,
        room: b.room,
        documents,
        _count: { documents: documents.length },
      }
    })

    return res.status(200).json({ guests: [...guests, ...orphanGuests] })
  } catch (err) {
    console.error('getDocuments error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Max KYC documents a guest may hold (ID front/back, photo, additional).
// Mirrors the 4 upload slots the client shows.
const MAX_DOCUMENTS = 4

// POST /documents/:guestId
export const uploadDocument = async (req, res) => {
  try {
    const { guestId } = req.params
    const { docType } = req.body

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' })
    }

    if (!docType) {
      return res.status(400).json({ message: 'docType is required.' })
    }

    const guest = await prisma.guest.findUnique({ where: { id: guestId } })
    if (!guest) {
      // Reject before persisting; the multer-saved temp file is cleaned up below.
      unlinkDocFile(`/uploads/documents/${req.file.filename}`)
      return res.status(404).json({ message: 'Guest not found.' })
    }

    // Cap the total at MAX_DOCUMENTS. The client merges a guest's own Document
    // rows with the ID docs captured on their bookings, so count both here to
    // keep the server's limit consistent with the "x / 4" the user sees.
    const [docCount, bookingDocCount] = await Promise.all([
      prisma.document.count({ where: { guestId } }),
      prisma.bookingDocument.count({ where: { booking: { guestId } } }),
    ])
    if (docCount + bookingDocCount >= MAX_DOCUMENTS) {
      unlinkDocFile(`/uploads/documents/${req.file.filename}`)
      return res
        .status(409)
        .json({ message: `Document limit reached (${MAX_DOCUMENTS} per guest).` })
    }

    // Block re-uploading a slot that's already filled (same docType).
    const duplicate = await prisma.document.findFirst({ where: { guestId, docType } })
    if (duplicate) {
      unlinkDocFile(`/uploads/documents/${req.file.filename}`)
      return res
        .status(409)
        .json({ message: `A "${docType}" document already exists for this guest.` })
    }

    const url = `/uploads/documents/${req.file.filename}`

    const document = await prisma.document.create({
      data: {
        guestId,
        docType,
        url,
        verified: false,
      },
    })

    return res.status(201).json({ document })
  } catch (err) {
    console.error('uploadDocument error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /documents/:id/verify
// The id may belong to either Document (guest KYC) or BookingDocument
// (ID docs captured at booking time). updateMany returns a count instead of
// throwing on no-match, so we can try one table then fall back to the other.
export const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params
    // Verify is often called with no request body; in Express 5 req.body is
    // undefined for a bodyless request, so default it before destructuring.
    const { verified } = req.body || {}
    const value = verified !== undefined ? verified : true

    const doc = await prisma.document.updateMany({ where: { id }, data: { verified: value } })
    if (doc.count > 0) {
      return res.status(200).json({ document: { id, verified: value } })
    }

    const bookingDoc = await prisma.bookingDocument.updateMany({ where: { id }, data: { verified: value } })
    if (bookingDoc.count > 0) {
      return res.status(200).json({ document: { id, verified: value } })
    }

    return res.status(404).json({ message: 'Document not found.' })
  } catch (err) {
    console.error('verifyDocument error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Best-effort removal of the file backing a document URL (/uploads/documents/x).
const unlinkDocFile = (url) => {
  if (!url) return
  try {
    const filePath = path.resolve(url.replace(/^[/\\]+/, ''))
    // Only delete inside the uploads dir — never follow a URL outside it.
    if (filePath.startsWith(path.resolve('uploads')) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (e) {
    console.warn('unlinkDocFile failed:', e.message)
  }
}

// DELETE /documents/:id — hard delete a guest or booking document (and its file).
// Documents are just uploaded files, not financial records, so removal is permanent.
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params

    const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, url: true } })
    if (doc) {
      await prisma.document.delete({ where: { id } })
      unlinkDocFile(doc.url)
      return res.status(200).json({ message: 'Document deleted.' })
    }

    const bookingDoc = await prisma.bookingDocument.findUnique({ where: { id }, select: { id: true, url: true } })
    if (bookingDoc) {
      await prisma.bookingDocument.delete({ where: { id } })
      unlinkDocFile(bookingDoc.url)
      return res.status(200).json({ message: 'Document deleted.' })
    }

    return res.status(404).json({ message: 'Document not found.' })
  } catch (err) {
    console.error('deleteDocument error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
