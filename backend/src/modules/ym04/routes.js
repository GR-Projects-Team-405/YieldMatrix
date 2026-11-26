import { Router } from 'express';
import pg from 'pg';
import pool from '../../config/db.js';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';

// Ensure Neon PostgreSQL connections use direct SSL negotiation
pg.defaults.sslnegotiation = 'direct';
process.env.PGSSLNEGOTIATION = 'direct';
if (pool?.options) {
  pool.options.sslnegotiation = 'direct';
}
import {
  getStatus,
  getOverview,
  getCrops,
  createCrop,
  updateCrop,
  getGrades,
  createGrade,
  updateGrade,
  getAuditLogs,
  getAuditLogById
} from './controller.js';

// YM04 · Chamasha Saminidi Stuwart · Reference data & audit
const router = Router();

// 1. Status endpoint
router.get('/status', verifyToken, authorizeRoles('admin'), getStatus);

// 2. Reference data overview
router.get('/overview', verifyToken, authorizeRoles('admin'), getOverview);

// 3, 4, 5. Crop endpoints
router.get('/crops', verifyToken, authorizeRoles('admin'), getCrops);
router.post('/crops', verifyToken, authorizeRoles('admin'), createCrop);
router.patch('/crops/:id', verifyToken, authorizeRoles('admin'), updateCrop);

// 6, 7, 8. Grade endpoints
router.get('/grades', verifyToken, authorizeRoles('admin'), getGrades);
router.post('/grades', verifyToken, authorizeRoles('admin'), createGrade);
router.patch('/grades/:id', verifyToken, authorizeRoles('admin'), updateGrade);

// 9, 10. Audit trail endpoints
router.get('/audit-logs', verifyToken, authorizeRoles('admin'), getAuditLogs);
router.get('/audit-logs/:id', verifyToken, authorizeRoles('admin'), getAuditLogById);

export default router;
