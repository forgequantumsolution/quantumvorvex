import prisma from '../utils/prisma.js'

// GET /food-plans
export const getFoodPlans = async (req, res) => {
  try {
    const foodPlans = await prisma.foodPlan.findMany({ orderBy: { name: 'asc' } })
    return res.status(200).json({ foodPlans })
  } catch (err) {
    console.error('getFoodPlans error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /food-plans
export const createFoodPlan = async (req, res) => {
  try {
    const { name, description, oneTimeRate, weeklyRate, monthlyRate, active } = req.body

    if (!name) {
      return res.status(400).json({ message: 'Food plan name is required.' })
    }

    const foodPlan = await prisma.foodPlan.create({
      data: {
        name,
        description,
        oneTimeRate: oneTimeRate || 0,
        weeklyRate: weeklyRate || 0,
        monthlyRate: monthlyRate || 0,
        active: active !== undefined ? active : true,
      },
    })

    return res.status(201).json({ foodPlan })
  } catch (err) {
    console.error('createFoodPlan error:', err)
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Food plan name already exists.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /food-plans/:id
export const updateFoodPlan = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, oneTimeRate, weeklyRate, monthlyRate, active } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (oneTimeRate !== undefined) updateData.oneTimeRate = oneTimeRate
    if (weeklyRate !== undefined) updateData.weeklyRate = weeklyRate
    if (monthlyRate !== undefined) updateData.monthlyRate = monthlyRate
    if (active !== undefined) updateData.active = active

    const foodPlan = await prisma.foodPlan.update({
      where: { id },
      data: updateData,
    })

    return res.status(200).json({ foodPlan })
  } catch (err) {
    console.error('updateFoodPlan error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Food plan not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /food-plans/:id
export const deleteFoodPlan = async (req, res) => {
  try {
    const { id } = req.params

    await prisma.foodPlan.delete({ where: { id } })
    return res.status(200).json({ message: 'Food plan deleted successfully.' })
  } catch (err) {
    console.error('deleteFoodPlan error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Food plan not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /food-orders - guests with active food plans
export const getFoodOrders = async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      where: {
        status: 'Active',
        foodPlan: { not: null },
      },
      include: {
        room: { select: { number: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json({ guests })
  } catch (err) {
    console.error('getFoodOrders error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
