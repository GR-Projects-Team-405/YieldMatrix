import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getPayoutOptions,
  getPayouts,
  getSettlement,
  getSettlements,
  getStatus,
  getTransactions,
  getWallet,
  postPayout,
} from './controller.js';
// YM27 · Udith Rashan · Farmer wallet
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
router.get('/wallet', verifyToken, authorizeRoles('farmer'), getWallet);
router.get('/wallet/transactions', verifyToken, authorizeRoles('farmer'), getTransactions);
router.get('/wallet/settlements', verifyToken, authorizeRoles('farmer'), getSettlements);
router.get('/wallet/settlements/:settlementId', verifyToken, authorizeRoles('farmer'), getSettlement);
router.get('/payout-options', verifyToken, authorizeRoles('farmer'), getPayoutOptions);
router.get('/wallet/payouts', verifyToken, authorizeRoles('farmer'), getPayouts);
router.post('/wallet/payouts', verifyToken, authorizeRoles('farmer'), postPayout);
export default router;
