import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getPickupHistory, getPickupStopDetails, getPickupStops, getStatus, recordPickup } from './controller.js';
// YM23 · Sandeepa Subashini · Pickup management
const router = Router();
router.get('/status', verifyToken, authorizeRoles('driver'), getStatus);
router.get('/pickup-stops', verifyToken, authorizeRoles('driver'), getPickupStops);
router.get('/pickup-stops/:stopId', verifyToken, authorizeRoles('driver'), getPickupStopDetails);
router.get('/pickup-history', verifyToken, authorizeRoles('driver'), getPickupHistory);
router.post('/pickup-stops/:stopId/record', verifyToken, authorizeRoles('driver'), recordPickup);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
