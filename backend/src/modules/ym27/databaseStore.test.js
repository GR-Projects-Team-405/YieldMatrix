import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDatabaseStore,
  FarmerWalletUnavailableError,
  toSafeCents,
} from './databaseStore.js';

const farmerId = '11111111-1111-4111-8111-111111111111';
const walletId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const settlementId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function walletRow(overrides = {}) {
  return {
    id: walletId,
    available_cents: '12500000',
    pending_payout_cents: '500000',
    currency: 'LKR',
    ...overrides,
  };
}

function fakePool(responses) {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? { rows: [] };
    },
  };
}

test('converts BIGINT cents only within JavaScript safe integer range', () => {
  assert.equal(toSafeCents('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.equal(toSafeCents(250), 250);
  assert.throws(() => toSafeCents('9007199254740992'), RangeError);
  assert.throws(() => toSafeCents('1.5'), TypeError);
});

test('wallet summary is caller-owned and leaves unsupported totals unset', async () => {
  const pool = fakePool([{ rows: [walletRow()] }]);
  const store = createDatabaseStore(pool);

  const result = await store.getWallet(farmerId);

  assert.deepEqual(result, {
    summary: {
      availableBalance: 12500000,
      pendingPayout: 500000,
      pendingSettlements: null,
      totalEarned: null,
    },
    remainingRequestable: 12500000,
  });
  assert.deepEqual(pool.calls[0].values, [farmerId]);
  assert.match(pool.calls[0].text, /u\.approval_status = 'approved'/);
  assert.match(pool.calls[0].text, /u\.role = 'farmer'/);
  assert.match(pool.calls[0].text, /w\.account_type = 'farmer'/);
  assert.match(pool.calls[0].text, /w\.simulated = TRUE/);
});

test('wallet access fails when no approved simulated farmer wallet is found', async () => {
  const store = createDatabaseStore(fakePool([{ rows: [] }]));

  await assert.rejects(store.getWallet(farmerId), FarmerWalletUnavailableError);
});

test('transactions use authenticated ownership and journal-line sides', async () => {
  const pool = fakePool([
    { rows: [walletRow()] },
    {
      rows: [
        {
          line_id: 'line-1',
          journal_entry_id: settlementId,
          date: '2026-11-15',
          event_type: 'settlement',
          event_reference: 'Settlement recorded',
          bucket: 'available',
          side: 'credit',
          amount_cents: '3250000',
          payout_status: null,
        },
        {
          line_id: 'line-2',
          journal_entry_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          date: '2026-11-16',
          event_type: 'payout_hold',
          event_reference: 'Payout request',
          bucket: 'available',
          side: 'debit',
          amount_cents: '100000',
          payout_status: 'pending',
        },
      ],
    },
  ]);
  const store = createDatabaseStore(pool);

  const result = await store.getTransactions(farmerId);

  assert.deepEqual(result, [
    {
      id: 'line-1',
      journalEntryId: settlementId,
      eventType: 'settlement',
      bucket: 'available',
      date: '2026-11-15',
      description: 'Settlement recorded',
      type: 'credit',
      amount: 3250000,
      status: 'confirmed',
      settlementId,
    },
    {
      id: 'line-2',
      journalEntryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      eventType: 'payout_hold',
      bucket: 'available',
      date: '2026-11-16',
      description: 'Payout request',
      type: 'debit',
      amount: 100000,
      status: 'pending',
    },
  ]);
  assert.deepEqual(pool.calls[0].values, [farmerId]);
  assert.deepEqual(pool.calls[1].values, [walletId, farmerId]);
});

test('settlements expose journal values without fabricating fee or net values', async () => {
  const pool = fakePool([
    { rows: [walletRow()] },
    {
      rows: [{
        settlement_id: settlementId,
        order_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        date: '2026-11-15',
        journal_amount_cents: '3250000',
        produce: 'Tomato',
      }],
    },
  ]);
  const store = createDatabaseStore(pool);

  const [settlement] = await store.getSettlements(farmerId);

  assert.deepEqual(settlement, {
    id: settlementId,
    orderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    date: '2026-11-15',
    grossAmount: null,
    platformFee: null,
    netPaid: null,
    journalAmount: 3250000,
    status: 'confirmed',
    produce: 'Tomato',
    quantityKg: null,
  });
  assert.deepEqual(pool.calls[1].values, [walletId, farmerId]);
});

test('settlement detail is scoped to the authenticated farmer wallet', async () => {
  const pool = fakePool([
    { rows: [walletRow()] },
    { rows: [] },
  ]);
  const store = createDatabaseStore(pool);

  assert.equal(await store.getSettlement(farmerId, settlementId), null);
  assert.deepEqual(pool.calls[1].values, [walletId, farmerId, settlementId]);
  assert.match(pool.calls[1].text, /wl\.wallet_id = \$1/);
  assert.match(pool.calls[1].text, /u\.id = \$2/);
});

test('payout history maps database status and does not invent a destination', async () => {
  const pool = fakePool([
    { rows: [walletRow()] },
    {
      rows: [{
        id: settlementId,
        amount_cents: '500000',
        status: 'completed',
        date: '2026-11-18',
      }],
    },
  ]);
  const store = createDatabaseStore(pool);

  assert.deepEqual(await store.getPayouts(farmerId), {
    payouts: [{
      id: settlementId,
      date: '2026-11-18',
      amount: 500000,
      bankLabel: 'Not stored',
      status: 'confirmed',
      reference: settlementId,
    }],
    remainingRequestable: 12500000,
  });
  assert.deepEqual(pool.calls[1].values, [walletId, farmerId]);
});

test('database read errors propagate to the controller boundary', async () => {
  const pool = fakePool([new Error('database unavailable')]);
  const store = createDatabaseStore(pool);

  await assert.rejects(store.getWallet(farmerId), /database unavailable/);
});

test('repository executes SELECT statements only', async () => {
  const pool = fakePool([
    { rows: [walletRow()] },
    { rows: [] },
  ]);
  const store = createDatabaseStore(pool);
  await store.getTransactions(farmerId);

  assert.ok(pool.calls.every(({ text }) => /^\s*SELECT\b/i.test(text)));
});
