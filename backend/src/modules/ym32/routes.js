import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM32 · Sewmini Wijesiri · Profile
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
