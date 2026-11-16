import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM13 · Migara Wijesinghe · Buyer demands
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
