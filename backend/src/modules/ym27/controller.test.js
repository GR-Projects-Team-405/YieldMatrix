import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  getPayoutOptions,
  getPayouts,
  getSettlement,
  getSettlements,
  getTransactions,
  getWallet,
  postPayout,
} from './controller.js';
import pool from '../../config/db.js';
import databaseStore from './databaseStore.js';

const farmerId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';
const originalDataMode = process.env.YM27_DATA_MODE;
const originalPayoutWriteEnabled = process.env.YM27_PAYOUT_WRITE_ENABLED;

afterEach(() => {
  if (originalDataMode === undefined) delete process.env.YM27_DATA_MODE;
  else process.env.YM27_DATA_MODE = originalDataMode;
  if (originalPayoutWriteEnabled === undefined) delete process.env.YM27_PAYOUT_WRITE_ENABLED;
  else process.env.YM27_PAYOUT_WRITE_ENABLED = originalPayoutWriteEnabled;
});

async function request(handler, { headers = {}, body, params = {} } = {}) {
  const res = {
    statusCode: 200,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  const req = {
    user: { id: farmerId },
    requestId: 'test-request',
    params,
    body,
    get(name) {
      return headers[name];
    },
  };
  await handler(req, res);
  return res;
}

test('default mock GET endpoints return mock mode and their established data', async () => {
  delete process.env.YM27_DATA_MODE;

  const wallet = await request(getWallet, { headers: { 'X-YM27-Session-Id': sessionId } });
  const txns = await request(getTransactions);
  const settlementList = await request(getSettlements);
  const settlementDetail = await request(getSettlement, { params: { settlementId: 'stl-001' } });
  const options = await request(getPayoutOptions);

  assert.equal(wallet.statusCode, 200);
  assert.equal(wallet.body.mode, 'mock');
  assert.equal(wallet.body.summary.availableBalance, 12500000);
  assert.equal(txns.body.mode, 'mock');
  assert.ok(txns.body.transactions.length > 0);
  assert.equal(settlementList.body.mode, 'mock');
  assert.ok(settlementList.body.settlements.length > 0);
  assert.equal(settlementDetail.body.settlement.id, 'stl-001');
  assert.deepEqual(options.body.payoutOptions.map(({ value }) => value), ['bank-001', 'bank-002', 'bank-003']);
  assert.equal(options.body.destinationSource, 'simulated');
  assert.equal(options.body.payoutSubmissionEnabled, true);
});

test('mock wallet and payout history require a valid session header', async () => {
  delete process.env.YM27_DATA_MODE;

  const missingWallet = await request(getWallet);
  const malformedHistory = await request(getPayouts, { headers: { 'X-YM27-Session-Id': 'not-a-uuid' } });

  assert.equal(missingWallet.statusCode, 400);
  assert.equal(malformedHistory.statusCode, 400);
});

test('mock payout creation records a pending request and idempotent retry returns the same record', async () => {
  delete process.env.YM27_DATA_MODE;
  const headers = {
    'X-YM27-Session-Id': sessionId,
    'Idempotency-Key': idempotencyKey,
  };
  const payload = { amountCents: 50000, bankValue: 'bank-001' };

  const created = await request(postPayout, { headers, body: payload });
  const replayed = await request(postPayout, { headers, body: payload });
  const history = await request(getPayouts, { headers: { 'X-YM27-Session-Id': sessionId } });

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.payout.status, 'pending');
  assert.equal(replayed.statusCode, 200);
  assert.equal(replayed.body.payout.id, created.body.payout.id);
  assert.equal(history.body.payouts.filter((payout) => payout.id === created.body.payout.id).length, 1);
});

test('mock payout rejects invalid amount, amount above balance, and unknown destination', async () => {
  delete process.env.YM27_DATA_MODE;
  const headers = {
    'X-YM27-Session-Id': '44444444-4444-4444-8444-444444444444',
    'Idempotency-Key': '55555555-5555-4555-8555-555555555555',
  };

  const invalidAmount = await request(postPayout, { headers, body: { amountCents: '100', bankValue: 'bank-001' } });
  const overBalance = await request(postPayout, { headers, body: { amountCents: 12500001, bankValue: 'bank-001' } });
  const invalidBank = await request(postPayout, { headers, body: { amountCents: 100, bankValue: 'other' } });

  assert.equal(invalidAmount.statusCode, 400);
  assert.equal(overBalance.statusCode, 400);
  assert.equal(invalidBank.statusCode, 400);
});

test('database read-only mode exposes no mock destinations and blocks payout writes', async () => {
  process.env.YM27_DATA_MODE = 'database';
  delete process.env.YM27_PAYOUT_WRITE_ENABLED;
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (sql) => {
    queries.push(sql);
    throw new Error('database query must not run in read-only payout mode');
  };

  try {
    const options = await request(getPayoutOptions);
    const payout = await request(postPayout, { body: { amountCents: 100, bankValue: 'bank-001' } });

    assert.equal(options.statusCode, 200);
    assert.deepEqual(options.body.payoutOptions, []);
    assert.equal(options.body.destinationSource, 'not-stored');
    assert.equal(options.body.payoutSubmissionEnabled, false);
    assert.equal(payout.statusCode, 503);
    assert.match(payout.body.error, /not enabled/);
    assert.deepEqual(queries, []);
  } finally {
    pool.query = originalQuery;
  }
});

test('database payout submission requires the process opt-in and accepts amount-only requests', async () => {
  process.env.YM27_DATA_MODE = 'database';
  process.env.YM27_PAYOUT_WRITE_ENABLED = 'true';
  const originalCreatePayout = databaseStore.createPayout;
  const calls = [];
  databaseStore.createPayout = async (input) => {
    calls.push(input);
    return {
      replayed: false,
      payout: {
        id: 'payout-1',
        date: '2026-11-23',
        amount: 1,
        bankLabel: 'Not stored',
        status: 'pending',
        reference: 'payout-1',
      },
    };
  };

  try {
    const options = await request(getPayoutOptions);
    const response = await request(postPayout, {
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { amountCents: 1 },
    });

    assert.equal(options.body.payoutSubmissionEnabled, true);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.payout.amount, 1);
    assert.deepEqual(calls, [{
      farmerId,
      amountCents: 1,
      idempotencyKey,
    }]);
  } finally {
    databaseStore.createPayout = originalCreatePayout;
  }
});

test('database payout submission rejects destination fields rather than persisting them', async () => {
  process.env.YM27_DATA_MODE = 'database';
  process.env.YM27_PAYOUT_WRITE_ENABLED = 'true';
  const originalCreatePayout = databaseStore.createPayout;
  databaseStore.createPayout = async () => {
    throw new Error('database writes must not start for a destination payload');
  };

  try {
    const response = await request(postPayout, {
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { amountCents: 1, bankValue: 'bank-001' },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      error: 'A payout amount in integer LKR cents is required; destinations are not stored.',
      mode: 'database',
      requestId: 'test-request',
    });
  } finally {
    databaseStore.createPayout = originalCreatePayout;
  }
});

test('database read failures return a generic 503 without exposing the underlying message', async () => {
  process.env.YM27_DATA_MODE = 'database';
  const originalGetWallet = databaseStore.getWallet;
  databaseStore.getWallet = async () => {
    const error = new Error('private database detail');
    error.code = 'ECONNRESET';
    throw error;
  };
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);

  try {
    const response = await request(getWallet);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      error: 'Wallet data is temporarily unavailable.',
      mode: 'database',
      requestId: 'test-request',
    });
    assert.doesNotMatch(JSON.stringify(response.body), /private database detail|ECONNRESET/);
    assert.deepEqual(logged, [['[YM27] database read failed', { requestId: 'test-request', errorCode: 'ECONNRESET' }]]);
  } finally {
    databaseStore.getWallet = originalGetWallet;
    console.error = originalConsoleError;
  }
});

test('unsupported data mode fails explicitly', async () => {
  process.env.YM27_DATA_MODE = 'unexpected';

  const response = await request(getTransactions);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.mode, undefined);
});
