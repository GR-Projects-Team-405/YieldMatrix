import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getNotifications, getPreferences, getStatus, markNotificationRead, updatePreferences } from './controller.js';
// YM05 · Chamidu Pethum · Notifications
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);
router.get('/preferences', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getPreferences);
router.put('/preferences', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), updatePreferences);
router.get('/notifications', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getNotifications);
router.patch('/notifications/:id/read', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), markNotificationRead);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
