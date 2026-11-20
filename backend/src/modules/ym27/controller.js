import pool from '../../config/db.js';
import { payoutOptions, settlements, transactions, walletSummary } from './mockData.js';
import { createSimulatedPayout, getPayoutHistory, getRemainingRequestable } from './payoutStore.js';
// YM27 · Udith Rashan · Farmer wallet
export async function getStatus(req, res, next) {
  try {
    // Parameterised, caller-scoped example; this query runs only when /status is requested.
    const { rows } = await pool.query('SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3', [req.user.id, req.user.role, 'approved']);
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM27', owner: 'Udith Rashan', status: 'scaffold', user: rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionId(req, res) {
  const sessionId = req.get('X-YM27-Session-Id');
  if (!sessionId || !uuidPattern.test(sessionId)) {
    res.status(400).json({ error: 'A valid simulated wallet session is required.', requestId: req.requestId });
    return undefined;
  }
  return sessionId;
}

export function getWallet(req, res) {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  return res.json({
    summary: walletSummary,
    remainingRequestable: getRemainingRequestable(req.user.id, sessionId),
    requestId: req.requestId,
  });
}

export function getTransactions(req, res) {
  return res.json({ transactions, requestId: req.requestId });
}

export function getSettlements(req, res) {
  return res.json({ settlements, requestId: req.requestId });
}

export function getSettlement(req, res) {
  const settlement = settlements.find((item) => item.id === req.params.settlementId);
  if (!settlement) return res.status(404).json({ error: 'Settlement not found', requestId: req.requestId });
  return res.json({ settlement, requestId: req.requestId });
}

export function getPayoutOptions(req, res) {
  return res.json({ payoutOptions, requestId: req.requestId });
}

export function getPayouts(req, res) {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  return res.json({
    payouts: getPayoutHistory(req.user.id, sessionId),
    remainingRequestable: getRemainingRequestable(req.user.id, sessionId),
    requestId: req.requestId,
  });
}

export function postPayout(req, res) {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || !uuidPattern.test(idempotencyKey)) {
    return res.status(400).json({ error: 'A valid payout request key is required.', requestId: req.requestId });
  }
  if (Object.hasOwn(req.body ?? {}, 'userId') || Object.hasOwn(req.body ?? {}, 'farmerId')) {
    return res.status(400).json({ error: 'Farmer identity must come from the authenticated session.', requestId: req.requestId });
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'A simulated payout request is required.', requestId: req.requestId });
  }

  const result = createSimulatedPayout({
    farmerId: req.user.id,
    sessionId,
    idempotencyKey,
    amountCents: req.body.amountCents,
    bankValue: req.body.bankValue,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error, requestId: req.requestId });
  return res.status(result.replayed ? 200 : 201).json({
    payout: result.payout,
    payouts: result.payouts,
    remainingRequestable: result.remainingRequestable,
    requestId: req.requestId,
  });
}
