import { Router } from 'express';
import { verifyToken, authorizeRoles } from '../../middleware/authMiddleware.js';
import { getStatus, getAllocations, getSummary, getAllocationHistory, getAllocationDetails, declineAllocation, acceptAllocation } from './controller.js';
// YM17 · Nimesh De Alwis · Farmer allocations
const router = Router();
router.get('/status', verifyToken, authorizeRoles('farmer'), getStatus);
// Task 01A: read-only inbox and summary. Ownership always comes from req.user.
router.get('/allocations', verifyToken, authorizeRoles('farmer'), getAllocations);
router.get('/summary', verifyToken, authorizeRoles('farmer'), getSummary);
// Task 04B-1: read-only allocation history. MUST stay above the dynamic
// :allocationId route, otherwise Express would read "history" as an id and
// answer 400 instead of serving the history list.
router.get('/allocations/history', verifyToken, authorizeRoles('farmer'), getAllocationHistory);
// Task 02A: one allocation's details. Static routes above come first so the
// dynamic :allocationId segment can never shadow them.
router.get('/allocations/:allocationId', verifyToken, authorizeRoles('farmer'), getAllocationDetails);
// Task 03B-1: farmer decline (atomic decision + hold release). Kept after the
// read routes so GET /allocations/:allocationId keeps its exact behaviour.
router.post('/allocations/:allocationId/decline', verifyToken, authorizeRoles('farmer'), declineAllocation);
// Task 03B-2: farmer accept (allocation only; the live hold stays active).
router.post('/allocations/:allocationId/accept', verifyToken, authorizeRoles('farmer'), acceptAllocation);
// Add module endpoints here. Enforce ownership, assignment and state before private reads/writes.
export default router;
