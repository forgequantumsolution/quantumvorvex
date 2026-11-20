import express from 'express'
import {
  getFoodPlans, createFoodPlan, updateFoodPlan, deleteFoodPlan,
  getDashboard, getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
  addSubscription, pauseSubscription, resumeSubscription, cancelSubscription, addPayment,
  getMeals, markMeal, markMealBulk, getMenu, saveMenu, getInHouseGuests,
} from '../controllers/foodController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

// IMPORTANT: this router is mounted at the bare '/api/v1' prefix (see app.js), so any
// router-level middleware here runs for EVERY /api/v1/* request that reaches it and would
// intercept routers mounted after it. Enforce per-route instead so non-food paths fall through.
// Reads need VIEW, writes MANAGE (inferred from the method). Deleting a customer
// and cancelling a plan are owner/admin only (checked in the controller).
const food = [verifyToken, requirePermission('food')]

// Meal plans
router.get('/food-plans',        ...food, getFoodPlans)
router.post('/food-plans',       ...food, validate(schemas.foodPlan), createFoodPlan)
router.put('/food-plans/:id',    ...food, validate(schemas.foodPlanUpdate), updateFoodPlan)
router.delete('/food-plans/:id', ...food, deleteFoodPlan)

router.get('/food/dashboard',    ...food, getDashboard)
router.get('/food/guests',       ...food, getInHouseGuests)

// Customers + subscriptions
router.get('/food/customers',                    ...food, getCustomers)
router.post('/food/customers',                   ...food, validate(schemas.createFoodCustomer), createCustomer)
router.get('/food/customers/:id',                ...food, getCustomer)
router.put('/food/customers/:id',                ...food, validate(schemas.foodCustomer), updateCustomer)
router.delete('/food/customers/:id',             ...food, deleteCustomer)
router.post('/food/customers/:id/subscriptions', ...food, validate(schemas.foodSubscription), addSubscription)

router.post('/food/subscriptions/:id/pause',     ...food, pauseSubscription)
router.post('/food/subscriptions/:id/resume',    ...food, resumeSubscription)
router.post('/food/subscriptions/:id/cancel',    ...food, cancelSubscription)
router.post('/food/subscriptions/:id/payments',  ...food, validate(schemas.foodPayment), addPayment)

// Daily meal sheet + weekly menu
router.get('/food/meals',        ...food, getMeals)
router.post('/food/meals',       ...food, validate(schemas.foodMeal), markMeal)
router.post('/food/meals/bulk',  ...food, validate(schemas.foodMealBulk), markMealBulk)
router.get('/food/menu',         ...food, getMenu)
router.put('/food/menu',         ...food, validate(schemas.foodMenu), saveMenu)

export default router
