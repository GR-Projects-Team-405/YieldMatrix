import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM21 · Rashmika Ravihara · Driver overview & vehicle
const router = Router();
router.get('/status', verifyToken, authorizeRoles('driver'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
