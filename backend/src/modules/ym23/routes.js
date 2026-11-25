import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getPickupStopDetails, getPickupStops, getStatus } from './controller.js';
// YM23 · Sandeepa Subashini · Pickup management
const router = Router();
router.get('/status', verifyToken, authorizeRoles('driver'), getStatus);
router.get('/pickup-stops', verifyToken, authorizeRoles('driver'), getPickupStops);
router.get('/pickup-stops/:stopId', verifyToken, authorizeRoles('driver'), getPickupStopDetails);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
