import express, { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import {
  getStatus,
  getReferenceData,
  getMarketInsights,
  getDemandForecast,
  getPriceWeatherAdvice,
  getAdminDatasets,
  getAdminEvaluation,
  uploadMarketCsv,
  getUploadReview,
  commitUpload,
  rejectUpload,
} from './controller.js';

// YM29 · Yasindu Janapriya · Market information
const router = Router();

// Route-local CSV body parser (up to 2 MB for 10,000 rows) without modifying shared server.js 64kb JSON limit.
const parseCsvBody = express.text({
  type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  limit: '2mb',
});

// Shared / Reference
router.get('/status', verifyToken, authorizeRoles('farmer', 'buyer', 'admin'), getStatus);
router.get('/reference', verifyToken, authorizeRoles('farmer', 'buyer', 'admin'), getReferenceData);

// Farmer & Buyer Advisory Endpoints (Screens 1-3)
router.get('/insights', verifyToken, authorizeRoles('farmer', 'buyer'), getMarketInsights);
router.get('/forecast', verifyToken, authorizeRoles('farmer', 'buyer'), getDemandForecast);
router.get('/price-advice', verifyToken, authorizeRoles('farmer', 'buyer'), getPriceWeatherAdvice);

// Admin Market Data & CSV Upload Review Endpoints (Screens 4-5)
router.get('/admin/datasets', verifyToken, authorizeRoles('admin'), getAdminDatasets);
router.get('/admin/evaluation', verifyToken, authorizeRoles('admin'), getAdminEvaluation);
router.post('/admin/uploads', verifyToken, authorizeRoles('admin'), parseCsvBody, uploadMarketCsv);
router.get('/admin/uploads/:id', verifyToken, authorizeRoles('admin'), getUploadReview);
router.post('/admin/uploads/:id/commit', verifyToken, authorizeRoles('admin'), commitUpload);
router.post('/admin/uploads/:id/reject', verifyToken, authorizeRoles('admin'), rejectUpload);

export default router;
