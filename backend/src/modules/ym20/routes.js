import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM20 · Praveena Buddini · Order & transaction records
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer', 'admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
