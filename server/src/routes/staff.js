import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getStaff, createStaff, updateStaff, getActivity, getPermissions, updatePermissions, getStaffSessions, forceLogoutStaff } from '../controllers/staffController.js'
const router = express.Router()
router.get('/', verifyToken, getStaff)
router.post('/', verifyToken, createStaff)
// Static paths must be registered before the parameterized `/:id` route,
// otherwise PUT /permissions is captured by PUT /:id (id="permissions").
router.get('/activity', verifyToken, getActivity)
router.get('/permissions', verifyToken, getPermissions)
router.put('/permissions', verifyToken, updatePermissions)
// Sessions / force-logout (sub-paths of /:id, safe to register near it)
router.get('/:id/sessions', verifyToken, getStaffSessions)
router.post('/:id/logout', verifyToken, forceLogoutStaff)
router.put('/:id', verifyToken, updateStaff)
export default router
