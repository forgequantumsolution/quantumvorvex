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
    const guests = await prisma.guest.findMany({
      select: {
        id: true,
        docId: true,
        name: true,
        phone: true,
        status: true,
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'desc' },
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
export const verifyDocument = async (req, res) => {
  try {
    const { id } = req.params
    const { verified } = req.body

    const document = await prisma.document.update({
      where: { id },
      data: { verified: verified !== undefined ? verified : true },
    })

    return res.status(200).json({ document })
  } catch (err) {
    console.error('verifyDocument error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Document not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
