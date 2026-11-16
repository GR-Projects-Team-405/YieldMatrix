import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM24 · Sasindu Lakshan · Delivery & incidents
const router = Router();
router.get('/status', verifyToken, authorizeRoles('driver'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
