import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus } from './controller.js';
// YM03 · Chamalsha Induwara · Sign up & Login
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
