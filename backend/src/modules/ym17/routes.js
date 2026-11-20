import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getAllocations, getSummary } from './controller.js';
// YM17 · Nimesh De Alwis · Farmer allocations
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
// Task 01A: read-only inbox and summary. Ownership always comes from req.user.
router.get('/allocations', verifyToken, authorizeRoles('farmer'), getAllocations);
router.get('/summary', verifyToken, authorizeRoles('farmer'), getSummary);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
