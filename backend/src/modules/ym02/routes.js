import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getAccountStatus, login, forgotPassword, resetPassword } from './controller.js';
// YM02 · Ashen Ranasingha · Login & account access
const router = Router();
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
// Any signed-in role (including pending, rejected and suspended users) can view its own status.
router.get('/account-status', verifyToken, getAccountStatus);
router.get('/status', verifyToken, authorizeRoles('admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;