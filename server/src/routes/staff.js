import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getStaff, createStaff, updateStaff, getActivity, getPermissions, updatePermissions } from '../controllers/staffController.js'
const router = express.Router()
router.get('/', verifyToken, getStaff)
router.post('/', verifyToken, createStaff)
router.put('/:id', verifyToken, updateStaff)
router.get('/activity', verifyToken, getActivity)
router.get('/permissions', verifyToken, getPermissions)
router.put('/permissions', verifyToken, updatePermissions)
export default router
