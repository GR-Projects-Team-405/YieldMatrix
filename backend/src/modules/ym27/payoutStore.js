import { randomUUID } from 'node:crypto';
import { payoutOptions, payouts as mockPayouts, walletSummary } from './mockData.js';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_PAYOUTS_PER_SESSION = 50;
const sessions = new Map();

function sessionKey(farmerId, sessionId) {
  return `${farmerId}:${sessionId}`;
}

function expireSessions(now) {
  for (const [key, session] of sessions) {
    if (now - session.lastUsedAt >= SESSION_TTL_MS) sessions.delete(key);
  }
}

function findSession(farmerId, sessionId, create, now = Date.now()) {
  expireSessions(now);
  const key = sessionKey(farmerId, sessionId);
  const session = sessions.get(key);
  if (session) {
    session.lastUsedAt = now;
    sessions.delete(key);
    sessions.set(key, session);
    return session;
  }
  if (!create) return undefined;
  while (sessions.size >= MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey === undefined) break;
    sessions.delete(oldestKey);
  }
  const newSession = { lastUsedAt: now, payouts: [], nextReference: 1 };
  sessions.set(key, newSession);
  return newSession;
}

function reservedAmount(session) {
  return session.payouts.reduce((sum, payout) => sum + payout.amount, 0);
}

function publicPayout(payout) {
  const { idempotencyKey, bankValue, ...record } = payout;
  return record;
}

export function getRemainingRequestable(farmerId, sessionId) {
  const session = findSession(farmerId, sessionId, false);
  return walletSummary.availableBalance - (session ? reservedAmount(session) : 0);
}

export function getPayoutHistory(farmerId, sessionId) {
  const session = findSession(farmerId, sessionId, false);
  return [...(session?.payouts ?? []), ...mockPayouts]
    .sort((a, b) => b.date.localeCompare(a.date) || b.reference.localeCompare(a.reference))
    .map(publicPayout);
}

export function createSimulatedPayout({ farmerId, sessionId, idempotencyKey, amountCents, bankValue }) {
  const bank = payoutOptions.find((option) => option.value === bankValue);
  if (!bank) return { ok: false, status: 400, error: 'Choose one of the simulated destinations.' };
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, status: 400, error: 'Enter a positive amount in integer LKR cents.' };
  }

  const session = findSession(farmerId, sessionId, true);
  const existing = session.payouts.find((payout) => payout.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.amount !== amountCents || existing.bankValue !== bankValue) {
      return { ok: false, status: 409, error: 'This request key was already used for a different simulated payout.' };
    }
    return {
      ok: true,
      payout: publicPayout(existing),
      payouts: getPayoutHistory(farmerId, sessionId),
      remainingRequestable: getRemainingRequestable(farmerId, sessionId),
      replayed: true,
    };
  }
  if (session.payouts.length >= MAX_PAYOUTS_PER_SESSION) {
    return { ok: false, status: 429, error: 'The simulated payout request limit for this session has been reached.' };
  }

  const remainingRequestable = walletSummary.availableBalance - reservedAmount(session);
  if (amountCents > remainingRequestable) {
    return { ok: false, status: 400, error: 'That amount is above the remaining simulated balance.' };
  }

  const date = new Date().toISOString().slice(0, 10);
  const payout = {
    id: `local-${randomUUID()}`,
    date,
    amount: amountCents,
    bankLabel: bank.label,
    status: 'pending',
    reference: `SIM-LOCAL-${date.replaceAll('-', '')}-${String(session.nextReference).padStart(3, '0')}`,
    idempotencyKey,
    bankValue,
  };
  session.nextReference += 1;
  session.payouts.unshift(payout);

  return {
    ok: true,
    payout: publicPayout(payout),
    payouts: getPayoutHistory(farmerId, sessionId),
    remainingRequestable: getRemainingRequestable(farmerId, sessionId),
    replayed: false,
  };
}
