import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  list,
  create,
  detail,
  status,
  escrow,
  ledger,
  auditTrail,
  submit,
  farmerResponse,
  listFarmerReservations,
  decide,
  confirm,
  message,
  wallet,
} from './controller.js';

const router = Router();
const buyer = [verifyToken, authorizeRoles('buyer')];

router.get('/status', verifyToken, authorizeRoles('buyer', 'farmer'), getStatus);
router.get('/wallet', ...buyer, wallet);
router.get('/farmer/reservations', verifyToken, authorizeRoles('farmer'), listFarmerReservations);
router.post('/reservations', ...buyer, create);
router.get('/reservations', ...buyer, list);
router.get('/reservations/:id/status', ...buyer, status);
router.get('/reservations/:id/escrow', ...buyer, escrow);
router.get('/reservations/:id/ledger', ...buyer, ledger);
router.get('/reservations/:id/audit', ...buyer, auditTrail);
router.get('/reservations/:id', ...buyer, detail);
router.post('/reservations/:id/submit', ...buyer, submit);
router.post('/reservations/:id/farmer-response', verifyToken, authorizeRoles('farmer'), farmerResponse);
router.post('/reservations/:id/confirm', ...buyer, confirm);
router.post('/reservations/:id/allocations/:allocationId/decision', ...buyer, decide);
router.patch('/reservations/:id/allocations/:allocationId/decision', ...buyer, decide);
router.post('/reservations/:id/allocations/:allocationId/message', ...buyer, message);

export default router;
