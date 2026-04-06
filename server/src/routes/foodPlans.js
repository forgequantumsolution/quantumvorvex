import express from 'express'
import {
  getFoodPlans,
  createFoodPlan,
  updateFoodPlan,
  deleteFoodPlan,
  getFoodOrders,
} from '../controllers/foodController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

// Food Plans routes
router.get('/food-plans', getFoodPlans)
router.post('/food-plans', createFoodPlan)
router.put('/food-plans/:id', updateFoodPlan)
router.delete('/food-plans/:id', deleteFoodPlan)

// Food Orders route
router.get('/food-orders', getFoodOrders)

export default router
