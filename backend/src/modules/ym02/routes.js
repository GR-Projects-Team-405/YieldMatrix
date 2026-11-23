import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, login } from './controller.js';
// YM02 · Ashen Ranasingha · Login & account access
const router = Router();
router.post('/login', login);
router.get('/status', verifyToken, authorizeRoles('admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;