import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getStaff, createStaff, updateStaff, getActivity, getPermissions, updatePermissions } from '../controllers/staffController.js'
const router = express.Router()
router.get('/', verifyToken, getStaff)
router.post('/', verifyToken, createStaff)
// Static paths must be registered before the parameterized `/:id` route,
// otherwise PUT /permissions is captured by PUT /:id (id="permissions").
router.get('/activity', verifyToken, getActivity)
router.get('/permissions', verifyToken, getPermissions)
router.put('/permissions', verifyToken, updatePermissions)
router.put('/:id', verifyToken, updateStaff)
export default router
