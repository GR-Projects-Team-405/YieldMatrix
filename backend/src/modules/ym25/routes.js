import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getBatchHistory, getBatchVerification, getRecords, getStatus } from './controller.js';
// YM25 · Shathir Sheriff · Traceability
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getStatus);
router.get('/records', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getRecords);
router.get('/records/:batchId/history', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getBatchHistory);
router.get('/records/:batchId/verification', verifyToken, authorizeRoles('farmer', 'buyer', 'driver', 'admin'), getBatchVerification);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
