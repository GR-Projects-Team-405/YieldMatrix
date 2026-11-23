import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getBuyerWallet,
  getBuyerTransactions,
  getBuyerTransactionDetail,
  createSimulatedFunding,
  getBuyerHeldFunds,
  getBuyerRefunds,
  getAdminReconciliation,
  getAdminJournals,
  reverseJournalEntry,
} from './controller.js';

// YM28 · Umindu Isith · Buyer wallet & reconciliation
const router = Router();

// Module status check
router.get('/status', verifyToken, authorizeRoles('buyer', 'admin'), getStatus);

// Buyer wallet endpoints (/buyer/wallet/*)
router.get('/buyer/wallet', verifyToken, authorizeRoles('buyer'), getBuyerWallet);
router.get('/buyer/transactions', verifyToken, authorizeRoles('buyer'), getBuyerTransactions);
router.get('/buyer/transactions/:entryId', verifyToken, authorizeRoles('buyer'), getBuyerTransactionDetail);
router.post('/buyer/funding', verifyToken, authorizeRoles('buyer'), createSimulatedFunding);
router.get('/buyer/holds', verifyToken, authorizeRoles('buyer'), getBuyerHeldFunds);
router.get('/buyer/refunds', verifyToken, authorizeRoles('buyer'), getBuyerRefunds);

// Admin reconciliation endpoints (/admin/reconciliation/*)
router.get('/admin/reconciliation', verifyToken, authorizeRoles('admin'), getAdminReconciliation);
router.get('/admin/journals', verifyToken, authorizeRoles('admin'), getAdminJournals);
router.post('/admin/journals/:entryId/reverse', verifyToken, authorizeRoles('admin'), reverseJournalEntry);

export default router;