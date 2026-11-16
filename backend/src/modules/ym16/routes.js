import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM16 · Nadula Hatharasingha · Reservations
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
