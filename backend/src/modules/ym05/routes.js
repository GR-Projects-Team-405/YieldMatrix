import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getNotifications, getStatus } from './controller.js';
// YM05 · Chamidu Pethum · Notifications
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);
router.get('/notifications', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getNotifications);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
