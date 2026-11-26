import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getMyTransactions, getMyTransactionById, getMyOrder } from './controller.js';
// YM20 · Praveena Buddini · Order & transaction records
const router = Router();
router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer', 'admin'), getStatus);
router.get('/transactions', verifyToken, authorizeRoles('buyer', 'farmer'), getMyTransactions);
router.get('/transactions/:id', verifyToken, authorizeRoles('buyer', 'farmer'), getMyTransactionById);
router.get('/orders/:id', verifyToken, authorizeRoles('buyer', 'farmer'), getMyOrder);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;