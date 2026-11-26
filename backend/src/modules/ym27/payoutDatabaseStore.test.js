import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDatabaseStore,
  FarmerWalletUnavailableError,
  InsufficientWalletBalanceError,
  InvalidPayoutRequestError,
  PayoutIdempotencyConflictError,
} from './databaseStore.js';

const farmerId = '11111111-1111-4111-8111-111111111111';
const otherFarmerId = '99999999-9999-4999-8999-999999999999';
const walletId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';

function createMockPool({
  availableCents = 1000n,
  pendingPayoutCents = 25n,
  heldCents = 7n,
  ownerId = farmerId,
  role = 'farmer',
  approved = true,
  simulated = true,
  currency = 'LKR',
  failOn = null,
} = {}) {
  let releaseLock = null;
  let lockTail = Promise.resolve();
  let nextJournalId = 1;
  let nextPayoutId = 1;
  const calls = [];
  const state = {
    wallet: {
      id: walletId,
      owner_id: ownerId,
      account_type: 'farmer',
      simulated,
      currency,
      available_cents: availableCents,
      pending_payout_cents: pendingPayoutCents,
      held_cents: heldCents,
    },
    user: { id: ownerId, role, approval_status: approved ? 'approved' : 'pending' },
    entries: [],
    lines: [],
    payouts: [],
    rollbacks: 0,
  };

  function clone(value) {
    return structuredClone(value);
  }

  function maybeFail(sql) {
    if (failOn && sql.includes(failOn)) {
      const error = new Error('injected database failure');
      error.code = 'XX000';
      throw error;
    }
  }

  function lockWallet() {
    const previous = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => { unlock = resolve; });
    return previous.then(() => {
      releaseLock = unlock;
    });
  }

  function unlockWallet() {
    if (releaseLock) {
      const unlock = releaseLock;
      releaseLock = null;
      unlock();
    }
  }

  async function readQuery(sql, params) {
    if (sql.includes('FROM public.wallets AS w') && sql.includes('LIMIT 2')) {
      const requestedFarmer = params[0];
      if (state.user.id !== requestedFarmer || state.user.approval_status !== 'approved'
        || state.user.role !== 'farmer' || state.wallet.account_type !== 'farmer'
        || !state.wallet.simulated || state.wallet.currency !== 'LKR') {
        return { rows: [] };
      }
      return {
        rows: [{
          id: state.wallet.id,
          available_cents: String(state.wallet.available_cents),
          pending_payout_cents: String(state.wallet.pending_payout_cents),
          currency: state.wallet.currency,
        }],
      };
    }

    if (sql.includes('FROM public.payout_requests AS pr')) {
      if (params[0] !== state.wallet.id || params[1] !== state.user.id
        || state.user.approval_status !== 'approved') return { rows: [] };
      return {
        rows: state.payouts
          .filter((payout) => payout.wallet_id === state.wallet.id)
          .map(({ id, amount_cents, status, created_at }) => ({
            id,
            amount_cents: String(amount_cents),
            status,
            date: created_at.slice(0, 10),
          })),
      };
    }

    throw new Error(`Unexpected mock pool query: ${sql}`);
  }

  const pool = {
    calls,
    state,
    async query(sql, params = []) {
      calls.push({ sql, params });
      maybeFail(sql);
      return readQuery(sql, params);
    },
    async connect() {
      const clientState = { transaction: null };
      return {
        async query(sql, params = []) {
          calls.push({ sql, params });
          maybeFail(sql);
          const normalized = sql.trim();

          if (normalized === 'BEGIN') {
            clientState.transaction = clone({
              wallet: state.wallet,
              user: state.user,
              entries: state.entries,
              lines: state.lines,
              payouts: state.payouts,
            });
            return { rows: [], rowCount: null };
          }

          if (normalized.includes('FOR UPDATE OF u, w')) {
            await lockWallet();
            clientState.transaction = clone({
              wallet: state.wallet,
              user: state.user,
              entries: state.entries,
              lines: state.lines,
              payouts: state.payouts,
            });
            const tx = clientState.transaction;
            if (tx.user.id !== params[0] || tx.user.role !== 'farmer'
              || tx.user.approval_status !== 'approved'
              || tx.wallet.owner_id !== params[0] || tx.wallet.account_type !== 'farmer'
              || !tx.wallet.simulated || tx.wallet.currency !== 'LKR') {
              return { rows: [] };
            }
            return {
              rows: [{
                id: tx.wallet.id,
                available_cents: String(tx.wallet.available_cents),
                pending_payout_cents: String(tx.wallet.pending_payout_cents),
              }],
            };
          }

          const tx = clientState.transaction;
          if (!tx) throw new Error('Mock transaction was not started');

          if (normalized.includes('FROM public.payout_requests')
            && normalized.includes('FOR UPDATE')) {
            return {
              rows: tx.payouts.filter((payout) => payout.operation_key === params[0])
                .map((payout) => ({
                  id: payout.id,
                  wallet_id: payout.wallet_id,
                  amount_cents: String(payout.amount_cents),
                  status: payout.status,
                  created_at: payout.created_at,
                })),
            };
          }

          if (normalized.startsWith('UPDATE public.wallets')) {
            const amount = BigInt(params[1]);
            if (tx.wallet.id !== params[0] || tx.wallet.available_cents < amount) {
              return { rows: [], rowCount: 0 };
            }
            tx.wallet.available_cents -= amount;
            tx.wallet.pending_payout_cents += amount;
            return { rows: [{ id: tx.wallet.id }], rowCount: 1 };
          }

          if (normalized.startsWith('INSERT INTO public.wallet_journal_entries')) {
            const row = {
              id: `journal-${nextJournalId++}`,
              event_reference: params[0],
              operation_key: params[1],
              amount_cents: BigInt(params[2]),
              actor_id: params[3],
              event_type: 'payout_hold',
            };
            tx.entries.push(row);
            return { rows: [{ id: row.id }], rowCount: 1 };
          }

          if (normalized.startsWith('INSERT INTO public.wallet_journal_lines')) {
            const [entryId, lineWalletId, amount] = params;
            tx.lines.push(
              { entry_id: entryId, wallet_id: lineWalletId, bucket: 'available', side: 'debit', amount_cents: BigInt(amount) },
              { entry_id: entryId, wallet_id: lineWalletId, bucket: 'pending_payout', side: 'credit', amount_cents: BigInt(amount) },
            );
            return { rows: [], rowCount: 2 };
          }

          if (normalized.startsWith('INSERT INTO public.payout_requests')) {
            const [id, payoutWalletId, amount, journalEntryId, operationKey] = params;
            if (tx.payouts.some((payout) => payout.operation_key === operationKey)) {
              const error = new Error('duplicate key');
              error.code = '23505';
              throw error;
            }
            const row = {
              id: `payout-${nextPayoutId++}`,
              requested_id: id,
              wallet_id: payoutWalletId,
              amount_cents: BigInt(amount),
              status: 'pending',
              journal_entry_id: journalEntryId,
              operation_key: operationKey,
              created_at: '2026-11-23T10:00:00.000Z',
            };
            tx.payouts.push(row);
            return {
              rows: [{
                id: row.id,
                wallet_id: row.wallet_id,
                amount_cents: String(row.amount_cents),
                status: row.status,
                created_at: row.created_at,
              }],
              rowCount: 1,
            };
          }

          if (normalized === 'COMMIT') {
            for (const entry of tx.entries) {
              const lines = tx.lines.filter((line) => line.entry_id === entry.id);
              const debits = lines.filter((line) => line.side === 'debit')
                .reduce((sum, line) => sum + line.amount_cents, 0n);
              const credits = lines.filter((line) => line.side === 'credit')
                .reduce((sum, line) => sum + line.amount_cents, 0n);
              if (debits !== credits || debits !== entry.amount_cents) {
                throw new Error('Journal balance constraint failed');
              }
            }
            state.wallet = tx.wallet;
            state.user = tx.user;
            state.entries = tx.entries;
            state.lines = tx.lines;
            state.payouts = tx.payouts;
            clientState.transaction = null;
            unlockWallet();
            return { rows: [], rowCount: null };
          }

          if (normalized === 'ROLLBACK') {
            state.rollbacks += 1;
            clientState.transaction = null;
            unlockWallet();
            return { rows: [], rowCount: null };
          }

          throw new Error(`Unexpected mock client query: ${sql}`);
        },
        release() {
          if (clientState.transaction) unlockWallet();
        },
      };
    },
  };
  return pool;
}

test('creates a pending payout with a farmer-scoped durable key and balanced hold journal', async () => {
  const pool = createMockPool();
  const store = createDatabaseStore(pool);

  const result = await store.createPayout({
    farmerId,
    amountCents: 100,
    idempotencyKey,
  });

  assert.equal(result.replayed, false);
  assert.equal(result.payout.amount, 100);
  assert.equal(result.payout.status, 'pending');
  assert.equal(result.payout.bankLabel, 'Not stored');
  assert.equal(pool.state.wallet.available_cents, 900n);
  assert.equal(pool.state.wallet.pending_payout_cents, 125n);
  assert.equal(pool.state.wallet.held_cents, 7n);
  assert.equal(pool.state.payouts.length, 1);
  assert.equal(pool.state.payouts[0].journal_entry_id, 'journal-1');
  assert.equal(pool.state.payouts[0].operation_key, `ym27:payout:v1:${farmerId}:${idempotencyKey}`);
  assert.deepEqual(pool.state.lines.map(({ bucket, side, amount_cents }) => ({ bucket, side, amount_cents })), [
    { bucket: 'available', side: 'debit', amount_cents: 100n },
    { bucket: 'pending_payout', side: 'credit', amount_cents: 100n },
  ]);
});

test('rejects invalid cents and invalid idempotency keys before connecting', async () => {
  const pool = createMockPool();
  const store = createDatabaseStore(pool);

  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 0, idempotencyKey }),
    InvalidPayoutRequestError,
  );
  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 1.5, idempotencyKey }),
    InvalidPayoutRequestError,
  );
  await assert.rejects(
    store.createPayout({ farmerId, amountCents: Number.MAX_SAFE_INTEGER + 1, idempotencyKey }),
    InvalidPayoutRequestError,
  );
  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 1, idempotencyKey: 'not-a-uuid' }),
    InvalidPayoutRequestError,
  );
  assert.equal(pool.calls.length, 0);
});

test('rejects insufficient balance without changing wallet or journals', async () => {
  const pool = createMockPool({ availableCents: 99n });
  const store = createDatabaseStore(pool);

  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 100, idempotencyKey }),
    InsufficientWalletBalanceError,
  );

  assert.equal(pool.state.wallet.available_cents, 99n);
  assert.equal(pool.state.wallet.pending_payout_cents, 25n);
  assert.equal(pool.state.entries.length, 0);
  assert.equal(pool.state.payouts.length, 0);
  assert.equal(pool.state.rollbacks, 1);
});

test('rejects unapproved, non-farmer, non-simulated, non-LKR, and other-farmer wallets', async () => {
  for (const options of [
    { approved: false },
    { role: 'buyer' },
    { ownerId: otherFarmerId },
    { simulated: false },
    { currency: 'USD' },
  ]) {
    const pool = createMockPool(options);
    const store = createDatabaseStore(pool);
    await assert.rejects(
      store.createPayout({ farmerId, amountCents: 1, idempotencyKey }),
      FarmerWalletUnavailableError,
    );
    assert.equal(pool.state.payouts.length, 0);
    assert.equal(pool.state.wallet.available_cents, 1000n);
  }
});

test('same-key same-amount retries return the saved request without reserving twice', async () => {
  const pool = createMockPool();
  const store = createDatabaseStore(pool);
  const input = { farmerId, amountCents: 100, idempotencyKey };

  const first = await store.createPayout(input);
  const replay = await store.createPayout(input);

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.payout.id, first.payout.id);
  assert.equal(pool.state.wallet.available_cents, 900n);
  assert.equal(pool.state.wallet.pending_payout_cents, 125n);
  assert.equal(pool.state.entries.length, 1);
  assert.equal(pool.state.payouts.length, 1);
});

test('same-key conflicting amounts return a conflict without further writes', async () => {
  const pool = createMockPool();
  const store = createDatabaseStore(pool);
  await store.createPayout({ farmerId, amountCents: 100, idempotencyKey });

  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 101, idempotencyKey }),
    PayoutIdempotencyConflictError,
  );

  assert.equal(pool.state.wallet.available_cents, 900n);
  assert.equal(pool.state.entries.length, 1);
  assert.equal(pool.state.payouts.length, 1);
});

test('concurrent requests serialize on the wallet and cannot overdraw available funds', async () => {
  const pool = createMockPool({ availableCents: 150n, pendingPayoutCents: 0n });
  const store = createDatabaseStore(pool);
  const requests = await Promise.allSettled([
    store.createPayout({ farmerId, amountCents: 100, idempotencyKey }),
    store.createPayout({
      farmerId,
      amountCents: 100,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    }),
  ]);

  assert.equal(requests.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(requests.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(pool.state.wallet.available_cents, 50n);
  assert.equal(pool.state.wallet.pending_payout_cents, 100n);
  assert.equal(pool.state.payouts.length, 1);
  assert.equal(pool.state.entries.length, 1);
});

test('concurrent retries with one idempotency key reserve the amount only once', async () => {
  const pool = createMockPool({ availableCents: 150n, pendingPayoutCents: 0n });
  const store = createDatabaseStore(pool);
  const input = { farmerId, amountCents: 100, idempotencyKey };

  const results = await Promise.all([
    store.createPayout(input),
    store.createPayout(input),
  ]);

  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(results[0].payout.id, results[1].payout.id);
  assert.equal(pool.state.wallet.available_cents, 50n);
  assert.equal(pool.state.wallet.pending_payout_cents, 100n);
  assert.equal(pool.state.payouts.length, 1);
  assert.equal(pool.state.entries.length, 1);
});

test('rolls back wallet, journal, and payout changes if a later insert fails', async () => {
  const pool = createMockPool({ failOn: 'INSERT INTO public.payout_requests' });
  const store = createDatabaseStore(pool);

  await assert.rejects(
    store.createPayout({ farmerId, amountCents: 100, idempotencyKey }),
    /injected database failure/,
  );

  assert.equal(pool.state.wallet.available_cents, 1000n);
  assert.equal(pool.state.wallet.pending_payout_cents, 25n);
  assert.equal(pool.state.entries.length, 0);
  assert.equal(pool.state.lines.length, 0);
  assert.equal(pool.state.payouts.length, 0);
  assert.equal(pool.state.rollbacks, 1);
});

test('payout history reads the persisted row through a fresh store instance', async () => {
  const pool = createMockPool();
  const store = createDatabaseStore(pool);
  const created = await store.createPayout({ farmerId, amountCents: 100, idempotencyKey });
  const freshStore = createDatabaseStore(pool);

  const history = await freshStore.getPayouts(farmerId);

  assert.deepEqual(history.payouts, [created.payout]);
  assert.equal(history.remainingRequestable, 900);
});
