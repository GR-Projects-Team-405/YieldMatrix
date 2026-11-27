import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getDashboard,
  getAccountDetails,
  updateAccountDetails,
  updateAccountStatus,
  getApprovals,
  updateApprovalStatus,
  getMembers,
  getSuspendedAccounts,
  restoreMember,
  suspendMember,
} from './controller.js';

// YM30 · Yugen Suresh · People & access
// All routes are mounted at /api/ym30 by server.js
const router = Router();

// Module verification endpoint (Developer Guide requirement)
router.get('/status', verifyToken, authorizeRoles('admin'), getStatus);

// 1. Admin Dashboard (Overview page)
router.get('/dashboard', verifyToken, authorizeRoles('admin'), getDashboard);

// 2. Account Details (Profile, roles, permissions & activity timeline)
router.get('/accounts/:accountId', verifyToken, authorizeRoles('admin'), getAccountDetails);
router.patch('/accounts/:accountId', verifyToken, authorizeRoles('admin'), updateAccountDetails);
router.patch('/accounts/:accountId/status', verifyToken, authorizeRoles('admin'), updateAccountStatus);

// 3. Approval Requests (Review pending registrations)
router.get('/approvals', verifyToken, authorizeRoles('admin'), getApprovals);
router.patch('/approvals/:id', verifyToken, authorizeRoles('admin'), updateApprovalStatus);

// 4. Suspended Accounts (Manage suspended accounts & access restoration)
router.get('/suspended', verifyToken, authorizeRoles('admin'), getSuspendedAccounts);
router.patch('/suspended/:id/restore', verifyToken, authorizeRoles('admin'), restoreMember);
router.patch('/suspended/:id/suspend', verifyToken, authorizeRoles('admin'), suspendMember);

// 5. People and Access (Main Member Directory)
router.get('/members', verifyToken, authorizeRoles('admin'), getMembers);
router.patch('/members/:id/restore', verifyToken, authorizeRoles('admin'), restoreMember);
router.patch('/members/:id/suspend', verifyToken, authorizeRoles('admin'), suspendMember);

export default router;
