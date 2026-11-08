import path from 'path'
import fs from 'fs'
import multer from 'multer'
import prisma from '../utils/prisma.js'
import { linkOrigin } from '../utils/invoiceLink.js'

// Multer config for logo uploads
const uploadDir = path.resolve('uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    // Prefix by field name ('logo' / 'stamp') so uploads are self-describing.
    const prefix = /^[a-z]+$/i.test(file.fieldname) ? file.fieldname : 'file'
    cb(null, `${prefix}-${Date.now()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Only image files are allowed.'))
  },
})

// GET /settings
export const getSettings = async (req, res) => {
  try {
    const hotel = await prisma.hotel.findFirst()
    const roomTypes = await prisma.roomType.findMany({ orderBy: { name: 'asc' } })
    const foodPlans = await prisma.foodPlan.findMany({ orderBy: { name: 'asc' } })
    const amenities = await prisma.amenity.findMany({ orderBy: { name: 'asc' } })

    return res.status(200).json({ hotel, roomTypes, foodPlans, amenities })
  } catch (err) {
    console.error('getSettings error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /settings
export const updateSettings = async (req, res) => {
  try {
    const { hotel: hotelData, roomTypes, foodPlans, amenities } = req.body

    const results = {}

    // Upsert hotel record
    if (hotelData) {
      const existing = await prisma.hotel.findFirst()
      if (existing) {
        results.hotel = await prisma.hotel.update({
          where: { id: existing.id },
          data: hotelData,
        })
      } else {
        results.hotel = await prisma.hotel.create({ data: hotelData })
      }
    }

    // Batch update room types. The submitted array is treated as the full
    // desired set: rows absent from it are deleted (only when no Room references
    // them, to avoid an FK violation).
    if (Array.isArray(roomTypes)) {
      results.roomTypes = await Promise.all(
        roomTypes.map((rt) => {
          if (rt.id) {
            return prisma.roomType.update({ where: { id: rt.id }, data: rt })
          }
          return prisma.roomType.upsert({
            where: { propertyId_name: { propertyId: req.propertyId, name: rt.name } },
            update: rt,
            create: rt,
          })
        })
      )
      const keepNames = roomTypes.map((rt) => rt.name)
      await prisma.roomType.deleteMany({
        where: { name: { notIn: keepNames }, rooms: { none: {} } },
      })
    }

    // Batch update food plans (deletes rows absent from the submitted set).
    if (Array.isArray(foodPlans)) {
      results.foodPlans = await Promise.all(
        foodPlans.map((fp) => {
          if (fp.id) {
            return prisma.foodPlan.update({ where: { id: fp.id }, data: fp })
          }
          return prisma.foodPlan.upsert({
            where: { propertyId_name: { propertyId: req.propertyId, name: fp.name } },
            update: fp,
            create: fp,
          })
        })
      )
      await prisma.foodPlan.deleteMany({
        where: { name: { notIn: foodPlans.map((fp) => fp.name) } },
      })
    }

    // Batch update amenities (deletes rows absent from the submitted set).
    if (Array.isArray(amenities)) {
      results.amenities = await Promise.all(
        amenities.map((am) => {
          if (am.id) {
            return prisma.amenity.update({ where: { id: am.id }, data: am })
          }
          return prisma.amenity.upsert({
            where: { propertyId_name: { propertyId: req.propertyId, name: am.name } },
            update: am,
            create: am,
          })
        })
      )
      await prisma.amenity.deleteMany({
        where: { name: { notIn: amenities.map((am) => am.name) } },
      })
    }

    return res.status(200).json({ message: 'Settings updated successfully.', ...results })
  } catch (err) {
    console.error('updateSettings error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /settings/logo
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' })
    }

    const logoUrl = `/uploads/${req.file.filename}`

    const existing = await prisma.hotel.findFirst()
    let hotel
    if (existing) {
      hotel = await prisma.hotel.update({ where: { id: existing.id }, data: { logoUrl } })
    } else {
      hotel = await prisma.hotel.create({ data: { logoUrl } })
    }

    return res.status(200).json({ logoUrl, hotel })
  } catch (err) {
    console.error('uploadLogo error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /settings/stamp — stamp + authorised-signatory image printed on invoices.
export const uploadStamp = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' })
    }

    const stampUrl = `/uploads/${req.file.filename}`

    const existing = await prisma.hotel.findFirst()
    let hotel
    if (existing) {
      hotel = await prisma.hotel.update({ where: { id: existing.id }, data: { stampUrl } })
    } else {
      hotel = await prisma.hotel.create({ data: { stampUrl } })
    }

    return res.status(200).json({ stampUrl, hotel })
  } catch (err) {
    console.error('uploadStamp error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// Payment-QR upload: one raster image (the owner's PhonePe/Paytm/GPay business
// QR), any field name, 2MB max.
export const uploadQr = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && /^image\//.test(file.mimetype)) cb(null, true)
    else cb(Object.assign(new Error('Only PNG, JPG or WebP images are allowed.'), { status: 400 }))
  },
}).any()

// Remove a previous upload from disk (best effort; only our own /uploads files).
const removeUpload = (url) => {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return
  fs.promises.unlink(path.join(uploadDir, path.basename(url))).catch(() => {})
}

// POST /settings/upi-qr — the payment QR guests scan (wins over the generated one).
export const uploadUpiQr = async (req, res) => {
  try {
    const file = req.files?.[0]
    if (!file) return res.status(400).json({ message: 'No file uploaded.' })
    const upiQrUrl = `/uploads/${file.filename}`
    const existing = await prisma.hotel.findFirst()
    const hotel = existing
      ? await prisma.hotel.update({ where: { id: existing.id }, data: { upiQrUrl } })
      : await prisma.hotel.create({ data: { upiQrUrl } })
    if (existing?.upiQrUrl && existing.upiQrUrl !== upiQrUrl) removeUpload(existing.upiQrUrl)
    return res.status(200).json({ upiQrUrl, hotel })
  } catch (err) {
    console.error('uploadUpiQr error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /settings/upi-qr — back to the QR generated from the UPI ID.
export const deleteUpiQr = async (req, res) => {
  try {
    const existing = await prisma.hotel.findFirst()
    if (!existing) return res.status(200).json({ upiQrUrl: null, hotel: null })
    const hotel = await prisma.hotel.update({ where: { id: existing.id }, data: { upiQrUrl: null } })
    removeUpload(existing.upiQrUrl)
    return res.status(200).json({ upiQrUrl: null, hotel })
  } catch (err) {
    console.error('deleteUpiQr error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /settings/link-origin — what guest links (invoice / pay) will start with.
export const getLinkOrigin = async (req, res) => {
  try {
    const hotel = await prisma.hotel.findFirst({ select: { publicUrl: true } })
    return res.status(200).json(linkOrigin(req, hotel))
  } catch (err) {
    console.error('getLinkOrigin error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
