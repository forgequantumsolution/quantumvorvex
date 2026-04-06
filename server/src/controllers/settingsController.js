import path from 'path'
import fs from 'fs'
import multer from 'multer'
import prisma from '../utils/prisma.js'

// Multer config for logo uploads
const uploadDir = path.resolve('uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `logo-${Date.now()}${ext}`)
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

    // Batch update room types
    if (Array.isArray(roomTypes)) {
      results.roomTypes = await Promise.all(
        roomTypes.map((rt) => {
          if (rt.id) {
            return prisma.roomType.update({ where: { id: rt.id }, data: rt })
          }
          return prisma.roomType.upsert({
            where: { name: rt.name },
            update: rt,
            create: rt,
          })
        })
      )
    }

    // Batch update food plans
    if (Array.isArray(foodPlans)) {
      results.foodPlans = await Promise.all(
        foodPlans.map((fp) => {
          if (fp.id) {
            return prisma.foodPlan.update({ where: { id: fp.id }, data: fp })
          }
          return prisma.foodPlan.upsert({
            where: { name: fp.name },
            update: fp,
            create: fp,
          })
        })
      )
    }

    // Batch update amenities
    if (Array.isArray(amenities)) {
      results.amenities = await Promise.all(
        amenities.map((am) => {
          if (am.id) {
            return prisma.amenity.update({ where: { id: am.id }, data: am })
          }
          return prisma.amenity.upsert({
            where: { name: am.name },
            update: am,
            create: am,
          })
        })
      )
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
