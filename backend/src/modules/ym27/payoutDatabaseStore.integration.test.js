import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import test from 'node:test';

const enabled = process.env.YM27_RUN_POSTGRES_INTEGRATION === '1';

function getLocalConfig() {
  const host = process.env.YM27_LOCAL_PG_HOST;
  const port = process.env.YM27_LOCAL_PG_PORT;
  const database = process.env.YM27_LOCAL_PG_DATABASE;
  const user = process.env.YM27_LOCAL_PG_USER;
  const password = process.env.YM27_LOCAL_PG_PASSWORD;
  const databaseMatch = /^ym27_local_test_v(\d+)$/.exec(database ?? '');

  if (!['::1', '127.0.0.1'].includes(host)
    || port !== '5432'
    || !databaseMatch
    || Number(databaseMatch[1]) < 2
    || !user
    || !password) {
    throw new Error('Configure an explicit loopback PostgreSQL 17 test target and password');
  }

  return { host, port: Number(port), database, user, password };
}

test('YM27 PostgreSQL payout integration tests', { skip: !enabled }, async (t) => {
  const config = getLocalConfig();
  register(new URL('./payoutDatabaseStore.test-loader.mjs', import.meta.url), import.meta.url);

  const { Pool } = await import('pg');
  const {
    createDatabaseStore,
    FarmerWalletUnavailableError,
    InsufficientWalletBalanceError,
    InvalidPayoutRequestError,
    PayoutIdempotencyConflictError,
  } = await import('./databaseStore.js');

  const pool = new Pool({
    ...config,
    ssl: false,
    max: 5,
    connectionTimeoutMillis: 5000,
    application_name: 'ym27_local_integration_test',
  });
  let successfulFixture;
  let successfulJournal;
  let simulationSourceWalletId;

  async function verifyLocalIdentity() {
    const { rows } = await pool.query(
      `SELECT current_database() AS database_name,
              inet_server_addr()::text AS server_address,
              inet_server_port() AS server_port,
              current_user AS current_user,
              current_setting('server_version_num')::integer AS server_version_num`,
    );
    const identity = rows[0];
    assert.ok(identity, 'PostgreSQL returned no server identity');
    assert.equal(identity.database_name, config.database);
    assert.ok(
      ['::1', '::1/128', '127.0.0.1', '127.0.0.1/32'].includes(identity.server_address),
      'PostgreSQL server address must be an exact loopback address',
    );
    assert.equal(Number(identity.server_port), 5432);
    assert.equal(identity.current_user, config.user);
    assert.equal(
      Math.floor(Number(identity.server_version_num) / 10000),
      17,
      'Integration tests require local PostgreSQL 17',
    );
  }

  async function assertDatabaseEmpty() {
    const [schemas, relations, types, extensions, views, functions, triggers] = await Promise.all([
      pool.query(
        `SELECT nspname AS schema_name
         FROM pg_catalog.pg_namespace
         WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
         ORDER BY nspname`,
      ),
      pool.query(
        `SELECT c.relname
         FROM pg_catalog.pg_class AS c
         JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'`,
      ),
      pool.query(
        `SELECT t.typname
         FROM pg_catalog.pg_type AS t
         JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'`,
      ),
      pool.query(
        `SELECT e.extname
         FROM pg_catalog.pg_extension AS e
         JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
         WHERE n.nspname <> 'pg_catalog'`,
      ),
      pool.query(
        `SELECT schemaname, viewname
         FROM pg_catalog.pg_views
         WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'`,
      ),
      pool.query(
        `SELECT n.nspname, p.proname
         FROM pg_catalog.pg_proc AS p
         JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
         WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
           AND p.prokind IN ('f', 'p')`,
      ),
      pool.query(
        `SELECT t.tgname
         FROM pg_catalog.pg_trigger AS t
         JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
         JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
         WHERE NOT t.tgisinternal
           AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'`,
      ),
    ]);

    assert.deepEqual(schemas.rows.map(({ schema_name }) => schema_name), ['public']);
    for (const result of [relations, types, extensions, views, functions, triggers]) {
      assert.equal(result.rows.length, 0);
    }
  }

  async function createTestSchema() {
    const schemaSql = await readFile(
      new URL('./payoutDatabaseStore.integration.schema.sql', import.meta.url),
      'utf8',
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      `SELECT tgname
       FROM pg_catalog.pg_trigger AS t
       JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND NOT t.tgisinternal`,
    );
    const triggerNames = rows.map(({ tgname }) => tgname);
    for (const required of [
      'workflow_transition',
      'immutable_record',
      'journal_line_guard',
      'journal_balanced',
    ]) {
      assert.ok(triggerNames.includes(required), `Missing local test trigger ${required}`);
    }
  }

  async function createFixture({
    availableCents = 1000,
    pendingPayoutCents = 50,
    heldCents = 8,
  } = {}) {
    const farmerId = randomUUID();
    const walletId = randomUUID();
    await pool.query(
      `INSERT INTO public.users (id, name, email, role, approval_status)
       VALUES ($1, $2, $3, 'farmer', 'approved')`,
      [farmerId, 'YM27 Integration Farmer', `${farmerId}@ym27.test`],
    );
    await pool.query(
      `INSERT INTO public.wallets
         (id, owner_id, account_type, currency, available_cents, held_cents,
          pending_payout_cents, simulated)
       VALUES ($1, $2, 'farmer', 'LKR', $3::bigint, $4::bigint, $5::bigint, TRUE)`,
      [walletId, farmerId, availableCents, heldCents, pendingPayoutCents],
    );
    return { farmerId, walletId };
  }

  async function readWallet(walletId) {
    const { rows } = await pool.query(
      `SELECT available_cents::text, pending_payout_cents::text, held_cents::text
       FROM public.wallets WHERE id = $1`,
      [walletId],
    );
    assert.equal(rows.length, 1);
    return rows[0];
  }

  async function readCounts(walletId) {
    const [payouts, entries] = await Promise.all([
      pool.query(
        'SELECT count(*)::int AS count FROM public.payout_requests WHERE wallet_id = $1',
        [walletId],
      ),
      pool.query(
        `SELECT count(DISTINCT je.id)::int AS count
         FROM public.wallet_journal_entries AS je
         JOIN public.wallet_journal_lines AS jl ON jl.entry_id = je.id
         WHERE jl.wallet_id = $1`,
        [walletId],
      ),
    ]);
    return { payouts: payouts.rows[0].count, entries: entries.rows[0].count };
  }

  async function readJournal(entryId) {
    const { rows } = await pool.query(
      `SELECT je.id, je.event_type, je.amount_cents::text, je.operation_key,
              je.actor_id, jl.wallet_id, jl.bucket, jl.side,
              jl.amount_cents::text AS line_amount_cents
       FROM public.wallet_journal_entries AS je
       JOIN public.wallet_journal_lines AS jl ON jl.entry_id = je.id
       WHERE je.id = $1
       ORDER BY jl.bucket, jl.side`,
      [entryId],
    );
    return rows;
  }

  async function assertWallet(walletId, available, pending, held) {
    assert.deepEqual(await readWallet(walletId), {
      available_cents: String(available),
      pending_payout_cents: String(pending),
      held_cents: String(held),
    });
  }

  async function assertJournalBalanced(entryId, amount) {
    const lines = await readJournal(entryId);
    assert.equal(lines.length, 2);
    assert.ok(lines.every((line) => BigInt(line.line_amount_cents) === BigInt(amount)));
    assert.ok(lines.every((line) => line.wallet_id === successfulFixture.walletId));
    assert.deepEqual(
      lines.map(({ bucket, side }) => `${bucket}:${side}`).sort(),
      ['available:debit', 'pending_payout:credit'],
    );
    assert.equal(lines[0].event_type, 'payout_hold');
    assert.equal(BigInt(lines[0].amount_cents), BigInt(amount));
    assert.equal(lines[0].actor_id, successfulFixture.farmerId);
  }

  async function expectRollbackOnCommit(client, entryId) {
    let commitRejected = false;
    try {
      await client.query('COMMIT');
    } catch {
      commitRejected = true;
    }
    if (!commitRejected) throw new Error('Expected deferred journal constraint to reject COMMIT');
    await client.query('ROLLBACK').catch(() => {});
    const { rows } = await pool.query(
      'SELECT count(*)::int AS count FROM public.wallet_journal_entries WHERE id = $1',
      [entryId],
    );
    assert.equal(rows[0].count, 0);
  }

  function createFailingPool(basePool) {
    return {
      query: (...args) => basePool.query(...args),
      async connect() {
        const client = await basePool.connect();
        return {
          query(sql, params) {
            if (sql.includes('INSERT INTO public.payout_requests')) {
              const error = new Error('Injected local integration failure');
              error.code = 'YM27_TEST_FAILURE';
              throw error;
            }
            return client.query(sql, params);
          },
          release(error) {
            client.release(error);
          },
        };
      },
    };
  }

  try {
    await verifyLocalIdentity();
    await assertDatabaseEmpty();
    await createTestSchema();

    simulationSourceWalletId = randomUUID();
    await pool.query(
      `INSERT INTO public.wallets
         (id, owner_id, account_type, currency, available_cents, held_cents,
          pending_payout_cents, simulated)
       VALUES ($1, NULL, 'simulation_source', 'LKR', 0, 0, 0, TRUE)`,
      [simulationSourceWalletId],
    );
    const sourceBefore = await readWallet(simulationSourceWalletId);

    await t.test('pending payout reservation and balanced payout_hold journal', async () => {
      successfulFixture = await createFixture();
      const idempotencyKey = randomUUID();
      const result = await createDatabaseStore(pool).createPayout({
        farmerId: successfulFixture.farmerId,
        amountCents: 250,
        idempotencyKey,
      });
      assert.equal(result.replayed, false);
      assert.equal(result.payout.status, 'pending');
      assert.equal(result.payout.amount, 250);
      assert.equal(result.payout.bankLabel, 'Not stored');
      await assertWallet(successfulFixture.walletId, 750, 300, 8);

      const { rows } = await pool.query(
        `SELECT id, wallet_id, amount_cents::text, status, journal_entry_id,
                operation_key, simulated
         FROM public.payout_requests WHERE id = $1`,
        [result.payout.id],
      );
      assert.equal(rows.length, 1);
      const payout = rows[0];
      assert.equal(payout.status, 'pending');
      assert.equal(payout.simulated, true);
      assert.equal(payout.wallet_id, successfulFixture.walletId);
      assert.equal(BigInt(payout.amount_cents), 250n);
      assert.equal(
        payout.operation_key,
        `ym27:payout:v1:${successfulFixture.farmerId}:${idempotencyKey}`,
      );
      successfulJournal = payout.journal_entry_id;
      await assertJournalBalanced(successfulJournal, 250);

      const history = await createDatabaseStore(pool).getPayouts(successfulFixture.farmerId);
      assert.equal(history.payouts.length, 1);
      assert.equal(history.payouts[0].id, result.payout.id);
      assert.equal(history.payouts[0].amount, 250);
      assert.equal(history.payouts[0].status, 'pending');
      assert.equal(history.remainingRequestable, 750);
    });

    await t.test('same-key idempotent replay persists one reservation', async () => {
      const fixture = await createFixture();
      const input = {
        farmerId: fixture.farmerId,
        amountCents: 125,
        idempotencyKey: randomUUID(),
      };
      const store = createDatabaseStore(pool);
      const first = await store.createPayout(input);
      const firstState = {
        wallet: await readWallet(fixture.walletId),
        counts: await readCounts(fixture.walletId),
      };
      const replay = await store.createPayout(input);
      assert.equal(replay.replayed, true);
      assert.equal(replay.payout.id, first.payout.id);
      assert.deepEqual(await readWallet(fixture.walletId), firstState.wallet);
      assert.deepEqual(await readCounts(fixture.walletId), firstState.counts);
    });

    await t.test('same-key conflicting amount leaves persisted state unchanged', async () => {
      const fixture = await createFixture();
      const idempotencyKey = randomUUID();
      const store = createDatabaseStore(pool);
      await store.createPayout({ farmerId: fixture.farmerId, amountCents: 125, idempotencyKey });
      const before = {
        wallet: await readWallet(fixture.walletId),
        counts: await readCounts(fixture.walletId),
      };
      await assert.rejects(
        store.createPayout({ farmerId: fixture.farmerId, amountCents: 126, idempotencyKey }),
        PayoutIdempotencyConflictError,
      );
      assert.deepEqual(await readWallet(fixture.walletId), before.wallet);
      assert.deepEqual(await readCounts(fixture.walletId), before.counts);
    });

    await t.test('insufficient funds leave wallet, journal, and payout state unchanged', async () => {
      const fixture = await createFixture({ availableCents: 40 });
      await assert.rejects(
        createDatabaseStore(pool).createPayout({
          farmerId: fixture.farmerId,
          amountCents: 41,
          idempotencyKey: randomUUID(),
        }),
        InsufficientWalletBalanceError,
      );
      await assertWallet(fixture.walletId, 40, 50, 8);
      assert.deepEqual(await readCounts(fixture.walletId), { payouts: 0, entries: 0 });
    });

    await t.test('invalid cents are rejected without persisted state changes', async () => {
      const fixture = await createFixture();
      const store = createDatabaseStore(pool);
      for (const amountCents of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        await assert.rejects(
          store.createPayout({
            farmerId: fixture.farmerId,
            amountCents,
            idempotencyKey: randomUUID(),
          }),
          InvalidPayoutRequestError,
        );
      }
      await assertWallet(fixture.walletId, 1000, 50, 8);
      assert.deepEqual(await readCounts(fixture.walletId), { payouts: 0, entries: 0 });
    });

    await t.test('concurrent requests serialize and do not overdraw the wallet', async () => {
      const fixture = await createFixture({ availableCents: 1000, pendingPayoutCents: 0 });
      const store = createDatabaseStore(pool);
      const outcomes = await Promise.allSettled([
        store.createPayout({
          farmerId: fixture.farmerId,
          amountCents: 700,
          idempotencyKey: randomUUID(),
        }),
        store.createPayout({
          farmerId: fixture.farmerId,
          amountCents: 700,
          idempotencyKey: randomUUID(),
        }),
      ]);
      assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = outcomes.find((result) => result.status === 'rejected');
      assert.ok(rejected);
      assert.ok(rejected.reason instanceof InsufficientWalletBalanceError);
      await assertWallet(fixture.walletId, 300, 700, 8);
      assert.deepEqual(await readCounts(fixture.walletId), { payouts: 1, entries: 1 });
      const { rows } = await pool.query(
        `SELECT DISTINCT je.id
         FROM public.wallet_journal_entries AS je
         JOIN public.wallet_journal_lines AS jl ON jl.entry_id = je.id
         WHERE jl.wallet_id = $1`,
        [fixture.walletId],
      );
      assert.equal(rows.length, 1);
      const lines = await readJournal(rows[0].id);
      assert.equal(BigInt(lines[0].amount_cents), 700n);
      assert.equal(BigInt(lines[0].line_amount_cents), 700n);
      assert.equal(BigInt(lines[1].line_amount_cents), 700n);
    });

    await t.test('injected mid-transaction failure rolls back every database change', async () => {
      const fixture = await createFixture();
      const beforeWallet = await readWallet(fixture.walletId);
      const failingStore = createDatabaseStore(createFailingPool(pool));
      await assert.rejects(
        failingStore.createPayout({
          farmerId: fixture.farmerId,
          amountCents: 200,
          idempotencyKey: randomUUID(),
        }),
        /Injected local integration failure/,
      );
      assert.deepEqual(await readWallet(fixture.walletId), beforeWallet);
      assert.deepEqual(await readCounts(fixture.walletId), { payouts: 0, entries: 0 });
    });

    await t.test('payout ownership permits the valid owner and rejects a different farmer', async () => {
      const owner = await createFixture();
      const other = await createFixture();
      const ownerResult = await createDatabaseStore(pool).createPayout({
        farmerId: owner.farmerId,
        amountCents: 10,
        idempotencyKey: randomUUID(),
      });
      assert.equal(ownerResult.replayed, false);
      assert.equal(ownerResult.payout.status, 'pending');
      await assertWallet(owner.walletId, 990, 60, 8);
      assert.deepEqual(await readCounts(owner.walletId), { payouts: 1, entries: 1 });
      await assertWallet(other.walletId, 1000, 50, 8);
      assert.deepEqual(await readCounts(other.walletId), { payouts: 0, entries: 0 });

      const differentFarmerId = randomUUID();
      await pool.query(
        `INSERT INTO public.users (id, name, email, role, approval_status)
         VALUES ($1, 'YM27 Farmer Without Wallet', $2, 'farmer', 'approved')`,
        [differentFarmerId, `${differentFarmerId}@ym27.test`],
      );
      await assert.rejects(
        createDatabaseStore(pool).createPayout({
          farmerId: differentFarmerId,
          amountCents: 10,
          idempotencyKey: randomUUID(),
        }),
        FarmerWalletUnavailableError,
      );
      await assertWallet(owner.walletId, 990, 60, 8);
      assert.deepEqual(await readCounts(owner.walletId), { payouts: 1, entries: 1 });
      await assertWallet(other.walletId, 1000, 50, 8);
      assert.deepEqual(await readCounts(other.walletId), { payouts: 0, entries: 0 });
    });

    await t.test('PostgreSQL journal and payout constraints reject invalid writes', async () => {
      assert.ok(successfulJournal);
      const immutableBefore = await pool.query(
        'SELECT event_reference FROM public.wallet_journal_entries WHERE id = $1',
        [successfulJournal],
      );
      await assert.rejects(
        pool.query(
          'UPDATE public.wallet_journal_entries SET event_reference = $2 WHERE id = $1',
          [successfulJournal, 'should be rejected'],
        ),
      );
      const immutableAfter = await pool.query(
        'SELECT event_reference FROM public.wallet_journal_entries WHERE id = $1',
        [successfulJournal],
      );
      assert.deepEqual(immutableAfter.rows, immutableBefore.rows);

      const unbalancedEntryId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO public.wallet_journal_entries
             (id, event_type, event_reference, operation_key, currency, amount_cents, actor_id)
           VALUES ($1, 'payout_hold', 'unbalanced local test', $2, 'LKR', 10, $3)`,
          [unbalancedEntryId, `ym27:test:unbalanced:${randomUUID()}`, successfulFixture.farmerId],
        );
        await expectRollbackOnCommit(client, unbalancedEntryId);
      } finally {
        client.release();
      }

      const sourceGuardEntryId = randomUUID();
      const guardClient = await pool.connect();
      let guardRejected = false;
      try {
        await guardClient.query('BEGIN');
        await guardClient.query(
          `INSERT INTO public.wallet_journal_entries
             (id, event_type, event_reference, operation_key, currency, amount_cents, actor_id)
           VALUES ($1, 'payout_hold', 'source guard local test', $2, 'LKR', 1, $3)`,
          [sourceGuardEntryId, `ym27:test:source-guard:${randomUUID()}`, successfulFixture.farmerId],
        );
        try {
          await guardClient.query(
            `INSERT INTO public.wallet_journal_lines
               (entry_id, wallet_id, bucket, side, amount_cents)
             VALUES ($1, $2, 'available', 'debit', 1)`,
            [sourceGuardEntryId, simulationSourceWalletId],
          );
        } catch {
          guardRejected = true;
        }
        assert.equal(guardRejected, true);
        await guardClient.query('ROLLBACK');
      } finally {
        guardClient.release();
      }
      const guardRows = await pool.query(
        'SELECT count(*)::int AS count FROM public.wallet_journal_entries WHERE id = $1',
        [sourceGuardEntryId],
      );
      assert.equal(guardRows.rows[0].count, 0);

      const badPayoutId = randomUUID();
      await assert.rejects(
        pool.query(
          `INSERT INTO public.payout_requests
             (id, wallet_id, amount_cents, status, journal_entry_id, operation_key, simulated)
           VALUES ($1, $2, 1, 'pending', $3, $4, FALSE)`,
          [
            badPayoutId,
            successfulFixture.walletId,
            successfulJournal,
            `ym27:test:simulated-check:${randomUUID()}`,
          ],
        ),
      );
      const badPayoutRows = await pool.query(
        'SELECT count(*)::int AS count FROM public.payout_requests WHERE id = $1',
        [badPayoutId],
      );
      assert.equal(badPayoutRows.rows[0].count, 0);

      const firstRequest = await pool.query(
        `SELECT id, amount_cents, journal_entry_id, operation_key
         FROM public.payout_requests WHERE wallet_id = $1 LIMIT 1`,
        [successfulFixture.walletId],
      );
      await assert.rejects(
        pool.query(
          `INSERT INTO public.payout_requests
             (id, wallet_id, amount_cents, status, journal_entry_id, operation_key, simulated)
           VALUES ($1, $2, $3, 'pending', $4, $5, TRUE)`,
          [
            randomUUID(),
            successfulFixture.walletId,
            firstRequest.rows[0].amount_cents,
            firstRequest.rows[0].journal_entry_id,
            firstRequest.rows[0].operation_key,
          ],
        ),
      );
    });

    assert.deepEqual(await readWallet(simulationSourceWalletId), sourceBefore);
    const sourceJournalLines = await pool.query(
      'SELECT count(*)::int AS count FROM public.wallet_journal_lines WHERE wallet_id = $1',
      [simulationSourceWalletId],
    );
    assert.equal(sourceJournalLines.rows[0].count, 0);
  } finally {
    await pool.end();
  }
});
