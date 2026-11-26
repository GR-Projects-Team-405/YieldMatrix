import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, runBulkMatch } from './controller.js';

const router = Router();

router.get('/status', verifyToken, authorizeRoles('buyer'), getStatus);
router.post('/match', verifyToken, authorizeRoles('buyer'), runBulkMatch);

export default router;