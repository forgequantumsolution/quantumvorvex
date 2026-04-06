import prisma from '../utils/prisma.js'

// GET /rooms
export const getRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { status: { not: 'deleted' } },
      include: { type: true },
      orderBy: { number: 'asc' },
    })
    return res.status(200).json({ rooms })
  } catch (err) {
    console.error('getRooms error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /rooms
export const createRoom = async (req, res) => {
  try {
    const { number, floor, status, dailyRate, monthlyRate, typeName, typeData } = req.body

    if (!number) {
      return res.status(400).json({ message: 'Room number is required.' })
    }

    // Resolve or create RoomType
    let roomType
    if (typeName) {
      roomType = await prisma.roomType.upsert({
        where: { name: typeName },
        update: typeData || {},
        create: {
          name: typeName,
          dailyRate: typeData?.dailyRate || dailyRate || 500,
          monthlyRate: typeData?.monthlyRate || monthlyRate || 10000,
          peakDailyRate: typeData?.peakDailyRate || 700,
          peakMonthlyRate: typeData?.peakMonthlyRate || 14000,
          maxOccupancy: typeData?.maxOccupancy || 2,
        },
      })
    } else {
      // Use first available type or create default
      roomType = await prisma.roomType.findFirst()
      if (!roomType) {
        roomType = await prisma.roomType.create({
          data: { name: 'Standard', dailyRate: 500, monthlyRate: 10000 },
        })
      }
    }

    const room = await prisma.room.create({
      data: {
        number,
        floor: floor || 1,
        status: status || 'available',
        dailyRate: dailyRate || roomType.dailyRate,
        monthlyRate: monthlyRate || roomType.monthlyRate,
        typeId: roomType.id,
      },
      include: { type: true },
    })

    return res.status(201).json({ room })
  } catch (err) {
    console.error('createRoom error:', err)
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Room number already exists.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /rooms/:id
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params
    const { number, floor, status, dailyRate, monthlyRate, typeName, typeId } = req.body

    const updateData = {}
    if (number !== undefined) updateData.number = number
    if (floor !== undefined) updateData.floor = floor
    if (status !== undefined) updateData.status = status
    if (dailyRate !== undefined) updateData.dailyRate = dailyRate
    if (monthlyRate !== undefined) updateData.monthlyRate = monthlyRate

    if (typeName) {
      const roomType = await prisma.roomType.upsert({
        where: { name: typeName },
        update: {},
        create: { name: typeName },
      })
      updateData.typeId = roomType.id
    } else if (typeId) {
      updateData.typeId = typeId
    }

    const room = await prisma.room.update({
      where: { id },
      data: updateData,
      include: { type: true },
    })

    return res.status(200).json({ room })
  } catch (err) {
    console.error('updateRoom error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /rooms/:id
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params
    const { hard } = req.query

    if (hard === 'true') {
      await prisma.room.delete({ where: { id } })
    } else {
      await prisma.room.update({
        where: { id },
        data: { status: 'deleted' },
      })
    }

    return res.status(200).json({ message: 'Room deleted successfully.' })
  } catch (err) {
    console.error('deleteRoom error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
