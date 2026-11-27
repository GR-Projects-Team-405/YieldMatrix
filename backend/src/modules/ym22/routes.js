import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getAssignedTrip, getAssignedTrips } from './controller.js';
// YM22 · Rukshan Senevirathna · Trips & routes
const router = Router();
router.get('/trips', verifyToken, authorizeRoles('driver'), getAssignedTrips);
router.get('/trips/:tripId', verifyToken, authorizeRoles('driver'), getAssignedTrip);
export default router;
