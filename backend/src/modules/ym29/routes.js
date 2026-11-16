import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM29 · Yasindu Janapriya · Market information
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
