import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getCategories,
  createCategory,
  updateCategory,
  getExpenses,
  getPayees,
  getSummary,
  getPortfolio,
  createExpense,
  updateExpense,
  payExpense,
  deleteExpense,
} from '../controllers/expensesController.js'

const router = express.Router()

// Reads need VIEW, writes MANAGE (inferred from the method).
router.use(verifyToken, requirePermission('expenses'))

// Static paths before /:id
router.get('/categories',     getCategories)
router.post('/categories',    validate(schemas.createExpenseCategory), createCategory)
router.put('/categories/:id', validate(schemas.updateExpenseCategory), updateCategory)
router.get('/payees',         getPayees)
router.get('/summary',        getSummary)
router.get('/portfolio',      getPortfolio)

router.get('/',          getExpenses)
router.post('/',         validate(schemas.createExpense), createExpense)
router.put('/:id',       validate(schemas.updateExpense), updateExpense)
router.post('/:id/pay',  validate(schemas.payExpense), payExpense)
router.delete('/:id',    deleteExpense)

export default router
