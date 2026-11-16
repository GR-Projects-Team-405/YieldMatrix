import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM10 · Kasuni Madeesha · Farmer offers
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
