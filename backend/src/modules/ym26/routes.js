import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM26 · Shermi Weerasinghe · Admin operations
const router = Router();
router.get('/status', verifyToken, authorizeRoles('admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
