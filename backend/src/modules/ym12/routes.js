import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getProduceDetails } from './controller.js';
// YM12 · MHD Muhthas · Produce & suppliers
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.get('/produce/:listingId', verifyToken, authorizeRoles('buyer'), getProduceDetails);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
