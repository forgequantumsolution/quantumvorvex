import express from 'express'
import { login, logout, me } from '../controllers/authController.js'
import { verifyToken } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.post('/login',  validate(schemas.login), login)
router.post('/logout', logout)
router.get('/me',      verifyToken, me)

export default router
