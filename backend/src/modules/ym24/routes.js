import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, listDeliveries, getDelivery } from './controller.js';
// YM24 · Sasindu Lakshan · Delivery & incidents
const router = Router();
router.get('/status', verifyToken, authorizeRoles('driver'), getStatus);
router.get('/deliveries', verifyToken, authorizeRoles('driver'), listDeliveries);
router.get('/deliveries/:tripId', verifyToken, authorizeRoles('driver'), getDelivery);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;