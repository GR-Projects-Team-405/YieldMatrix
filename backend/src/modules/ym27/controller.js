import pool from '../../config/db.js';
import databaseStore, {
  FarmerWalletUnavailableError,
  InsufficientWalletBalanceError,
  InvalidPayoutRequestError,
  PayoutIdempotencyConflictError,
} from './databaseStore.js';
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

function getDataMode(req, res) {
  const configuredMode = process.env.YM27_DATA_MODE;
  if (!configuredMode || configuredMode === 'mock') return 'mock';
  if (configuredMode === 'database') return 'database';
  res.status(503).json({ error: 'Wallet service configuration is unavailable', requestId: req.requestId });
  return undefined;
}

function respondWithDatabaseError(req, res, error) {
  if (error instanceof FarmerWalletUnavailableError) {
    return res.status(403).json({
      error: 'An approved simulated farmer wallet is unavailable.',
      mode: 'database',
      requestId: req.requestId,
    });
  }

  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const errorCode = typeof rawCode === 'string' && /^[A-Z0-9_]{2,10}$/.test(rawCode)
    ? rawCode
    : 'UNCLASSIFIED';
  console.error('[YM27] database read failed', { requestId: req.requestId, errorCode });
  return res.status(503).json({
    error: 'Wallet data is temporarily unavailable.',
    mode: 'database',
    requestId: req.requestId,
  });
}

async function respondWithDatabaseRead(req, res, read) {
  try {
    const data = await read();
    return res.json({ ...data, mode: 'database', requestId: req.requestId });
  } catch (error) {
    return respondWithDatabaseError(req, res, error);
  }
}

function respondWithDatabasePayoutError(req, res, error) {
  if (error instanceof FarmerWalletUnavailableError) {
    return res.status(403).json({
      error: 'An approved simulated farmer wallet is unavailable.',
      mode: 'database',
      requestId: req.requestId,
    });
  }
  if (error instanceof InvalidPayoutRequestError) {
    return res.status(400).json({
      error: 'Enter a positive safe-integer amount in LKR cents and a valid idempotency key.',
      mode: 'database',
      requestId: req.requestId,
    });
  }
  if (error instanceof InsufficientWalletBalanceError) {
    return res.status(400).json({
      error: 'The available simulated wallet balance is insufficient.',
      mode: 'database',
      requestId: req.requestId,
    });
  }
  if (error instanceof PayoutIdempotencyConflictError) {
    return res.status(409).json({
      error: 'This idempotency key was already used for a different payout amount.',
      mode: 'database',
      requestId: req.requestId,
    });
  }

  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const errorCode = typeof rawCode === 'string' && /^[A-Z0-9_]{2,10}$/.test(rawCode)
    ? rawCode
    : 'UNCLASSIFIED';
  console.error('[YM27] database payout write failed', { requestId: req.requestId, errorCode });
  return res.status(503).json({
    error: 'Payout request could not be completed.',
    mode: 'database',
    requestId: req.requestId,
  });
}

function getSessionId(req, res) {
  const sessionId = req.get('X-YM27-Session-Id');
  if (!sessionId || !uuidPattern.test(sessionId)) {
    res.status(400).json({ error: 'A valid simulated wallet session is required.', requestId: req.requestId });
    return undefined;
  }
  return sessionId;
}

export async function getWallet(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    return respondWithDatabaseRead(req, res, () => databaseStore.getWallet(req.user.id));
  }

  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  return res.json({
    summary: walletSummary,
    remainingRequestable: getRemainingRequestable(req.user.id, sessionId),
    mode,
    requestId: req.requestId,
  });
}

export async function getTransactions(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    return respondWithDatabaseRead(req, res, async () => ({
      transactions: await databaseStore.getTransactions(req.user.id),
    }));
  }
  return res.json({ transactions, mode, requestId: req.requestId });
}

export async function getSettlements(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    return respondWithDatabaseRead(req, res, async () => ({
      settlements: await databaseStore.getSettlements(req.user.id),
    }));
  }
  return res.json({ settlements, mode, requestId: req.requestId });
}

export async function getSettlement(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    if (!uuidPattern.test(req.params.settlementId)) {
      return res.status(404).json({ error: 'Settlement not found', mode, requestId: req.requestId });
    }
    try {
      const settlement = await databaseStore.getSettlement(req.user.id, req.params.settlementId);
      if (!settlement) {
        return res.status(404).json({ error: 'Settlement not found', mode, requestId: req.requestId });
      }
      return res.json({ settlement, mode, requestId: req.requestId });
    } catch (error) {
      return respondWithDatabaseError(req, res, error);
    }
  }

  const settlement = settlements.find((item) => item.id === req.params.settlementId);
  if (!settlement) return res.status(404).json({ error: 'Settlement not found', mode, requestId: req.requestId });
  return res.json({ settlement, mode, requestId: req.requestId });
}

export function getPayoutOptions(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  return res.json({
    payoutOptions: mode === 'database' ? [] : payoutOptions,
    mode,
    destinationSource: mode === 'database' ? 'not-stored' : 'simulated',
    payoutSubmissionEnabled: mode === 'mock' || process.env.YM27_PAYOUT_WRITE_ENABLED === 'true',
    requestId: req.requestId,
  });
}

export async function getPayouts(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    return respondWithDatabaseRead(req, res, () => databaseStore.getPayouts(req.user.id));
  }

  const sessionId = getSessionId(req, res);
  if (!sessionId) return;
  return res.json({
    payouts: getPayoutHistory(req.user.id, sessionId),
    remainingRequestable: getRemainingRequestable(req.user.id, sessionId),
    mode,
    requestId: req.requestId,
  });
}

export async function postPayout(req, res) {
  const mode = getDataMode(req, res);
  if (!mode) return;
  if (mode === 'database') {
    if (process.env.YM27_PAYOUT_WRITE_ENABLED !== 'true') {
      return res.status(503).json({
        error: 'Payout submission is not enabled for this database process.',
        mode,
        requestId: req.requestId,
      });
    }

    const idempotencyKey = req.get('Idempotency-Key');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => key !== 'amountCents')) {
      return res.status(400).json({
        error: 'A payout amount in integer LKR cents is required; destinations are not stored.',
        mode,
        requestId: req.requestId,
      });
    }

    try {
      const result = await databaseStore.createPayout({
        farmerId: req.user.id,
        amountCents: req.body.amountCents,
        idempotencyKey,
      });
      return res.status(result.replayed ? 200 : 201).json({
        payout: result.payout,
        replayed: result.replayed,
        mode,
        requestId: req.requestId,
      });
    } catch (error) {
      return respondWithDatabasePayoutError(req, res, error);
    }
  }

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
    mode,
    requestId: req.requestId,
  });
}
