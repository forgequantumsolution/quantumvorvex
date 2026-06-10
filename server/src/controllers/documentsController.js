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

    return res.status(200).json({ guests })
  } catch (err) {
    console.error('getDocuments error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

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
      return res.status(404).json({ message: 'Guest not found.' })
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
