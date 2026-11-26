import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../server.js';
import pool from '../../config/db.js';
import { acceptAllocation, declineAllocation, getAllocations } from './controller.js';

// YM17 · focused tests for the corrected inbox list logic (Issues 01/02):
// - the response-eligibility filter (pending / expiring / expired),
// - the audit-backed farmer-decision filter (decision=accepted),
// - removal of internal operation keys from the inbox DTO,
// - read-only guarantees (a GET must never issue a write statement).
// The unit tests mock pool.query; the HTTP tests are read-only GETs against
// the shared database and never insert, update or delete anything.

const JWT_SECRET = process.env.JWT_SECRET || 'yieldmatrix_dev_secret_key';

function makeToken(user) {
  return jwt.sign(
    { role: user.role, name: user.name, demo: true },
    JWT_SECRET,
    { subject: user.id, expiresIn: '15m', algorithm: 'HS256', issuer: 'yieldmatrix', audience: 'yieldmatrix-web' },
  );
}

const DEMO_FARMER = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'farmer',
  name: 'Demo Farmer',
};

const WRITE_PATTERN = /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i;

/** One list row shaped like a real PostgreSQL result for the inbox SELECT. */
function listRow(overrides = {}) {
  return {
    id: 'a1111111-1111-4111-8111-111111121011',
    order_id: 'o1111111-1111-4111-8111-111111111111',
    buyer_name: 'Demo Buyer',
    batch_id: 'b1111111-1111-4111-8111-111111111111',
    batch_display_id: 'BM-01',
    crop_name: 'Tomato',
    grade_name: 'Grade A',
    agreed_kg: '400.000',
    agreed_unit_price_cents: '18000',
    agreed_value_cents: '7200000',
    status: 'held',
    created_at: new Date('2026-11-23T04:00:00Z'),
    reservation_status: 'active',
    reservation_expires_at: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

/**
 * Runs getAllocations against a mocked pool. Every executed statement and its
 * parameters are captured so tests can assert on the generated SQL, and any
 * unexpected query fails loudly instead of touching the shared database.
 */
async function runGetAllocations(query, { rows = [] } = {}) {
  const originalQuery = pool.query;
  const executed = [];
  try {
    pool.query = async (sql, params) => {
      executed.push({ sql, params });
      if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
        return { rows: [{ id: DEMO_FARMER.id, name: DEMO_FARMER.name, role: 'farmer' }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT count(*) AS total')) {
        return { rows: [{ total: String(rows.length) }] };
      }
      if (typeof sql === 'string' && sql.includes('OFFSET $')) {
        return { rows };
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    };

    let code = 200;
    let body = null;
    const res = {
      status(next) {
        code = next;
        return this;
      },
      json(data) {
        body = data;
        return this;
      },
    };
    const req = {
      user: DEMO_FARMER,
      query,
      requestId: '00000000-0000-0000-0000-000000000009',
    };
    await getAllocations(req, res, (error) => {
      throw error;
    });
    return { code, body, executed };
  } finally {
    pool.query = originalQuery;
  }
}

describe('YM17 inbox eligibility filter and DTO (Issue 01 + Issue 02)', () => {
  let server;
  let baseUrl;
  let farmerToken;

  before(async () => {
    farmerToken = makeToken(DEMO_FARMER);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}/api/ym17`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  /* ------------------------- unit: generated SQL ------------------------- */

  test('1. eligibility=pending mirrors the summary pending predicate and binds no status', async () => {
    const { code, body, executed } = await runGetAllocations({ eligibility: 'pending' }, { rows: [listRow()] });
    assert.equal(code, 200);
    assert.ok(Array.isArray(body.allocations));

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(listSql.includes(`a.status = 'held'`), 'pending must be restricted to held allocations');
    assert.ok(listSql.includes(`r.status = 'active'`), 'pending must require a live hold');
    assert.ok(listSql.includes('r.expires_at > now()'), 'pending must require an unpassed deadline');

    // The eligibility predicate implies the status, so no status parameter is bound.
    for (const entry of executed) {
      assert.ok(!(entry.params || []).includes('held'), 'status must not be double-bound as a parameter');
    }
  });

  test('2. eligibility=expiring adds the same 10-minute window as the summary card', async () => {
    const { code, executed } = await runGetAllocations({ eligibility: 'expiring' });
    assert.equal(code, 200);

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(listSql.includes('make_interval'), 'expiring must use the database clock window');
    assert.ok(listSql.includes('r.expires_at > now()'));
    assert.ok(listSql.includes('r.expires_at <= now() + make_interval'));

    const bound = executed.flatMap((entry) => entry.params || []);
    assert.ok(bound.includes(10), 'the EXPIRING_SOON_MINUTES window must be bound as a parameter');
  });

  test('3. eligibility=expired covers stored expired and held rows with a dead hold', async () => {
    const { code, executed } = await runGetAllocations({ eligibility: 'expired' });
    assert.equal(code, 200);

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(listSql.includes(`a.status = 'expired'`));
    assert.ok(listSql.includes('IS DISTINCT FROM'), 'held rows without a live hold count as expired');
    assert.ok(listSql.includes('r.expires_at <= now()'), 'held rows past their deadline count as expired');
    assert.ok(listSql.includes(`a.status = 'held'`), 'stored held rows stay in the result set');
  });

  test('4. A plain stored-status filter still behaves exactly as before', async () => {
    const { code, executed } = await runGetAllocations({ status: 'declined' });
    assert.equal(code, 200);

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(listSql.includes('a.status = $2'), 'status must still be a bound parameter');
    const bound = executed.flatMap((entry) => entry.params || []);
    assert.ok(bound.includes('declined'));
    assert.ok(!listSql.includes('eligibility'), 'no eligibility predicate without the parameter');
  });

  test('5. Unknown eligibility values are rejected with 400 before any list query', async () => {
    const { code, body, executed } = await runGetAllocations({ eligibility: 'always' });
    assert.equal(code, 400);
    assert.match(body.error, /eligibility must be one of/);
    assert.equal(
      executed.filter((entry) => entry.sql.includes('OFFSET $')).length,
      0,
      'the list query must not run for a rejected parameter',
    );
  });

  test('6. The inbox DTO carries no operation keys and keeps the stored status untouched', async () => {
    const { code, body, executed } = await runGetAllocations(
      { eligibility: 'expired' },
      { rows: [listRow({ status: 'held', reservation_status: 'active', reservation_expires_at: new Date(Date.now() - 1000) })] },
    );
    assert.equal(code, 200);

    const item = body.allocations[0];
    // Stored state reported as-is: never rewritten to pretend expiry happened.
    assert.equal(item.status, 'held');
    assert.equal(item.reservationStatus, 'active');
    // Internal identifiers stay internal.
    assert.equal(item.allocationReference, undefined);
    assert.equal(item.orderReference, undefined);
    assert.equal(item.operation_key, undefined);
    assert.equal(item.order_operation_key, undefined);
    // The real public identifier that does exist is passed through.
    assert.equal(item.allocationId, 'a1111111-1111-4111-8111-111111121011');
    assert.equal(item.batchDisplayId, 'BM-01');

    // Without a search term the generated SQL must not select operation keys.
    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(!listSql.includes('operation_key'));
  });

  test('7. Every statement issued by these reads is read-only', async () => {
    const queries = [
      { eligibility: 'pending' },
      { eligibility: 'expiring' },
      { eligibility: 'expired' },
      { status: 'held' },
      { search: 'demo' },
    ];
    for (const query of queries) {
      const { executed } = await runGetAllocations(query);
      for (const entry of executed) {
        assert.ok(!WRITE_PATTERN.test(entry.sql), `read endpoint issued a write statement: ${entry.sql}`);
      }
    }
  });

  // Regression test: a held allocation with NO matching reservation must NOT
  // be classified as expired. The eligibility=expired predicate requires a
  // reservation row that IS dead or past deadline. A missing reservation means
  // the allocation simply has no hold — it must stay visible under the
  // unfiltered list and must never be silently transitioned to expired.
  test('7b. Regression: held allocation with no reservation is NOT classified as expired', async () => {
    // A held row whose lateral reservation pick returns NULL (no reservation at all).
    const heldNoReservation = listRow({
      status: 'held',
      reservation_status: null,
      reservation_expires_at: null,
    });

    const { code: codeExpired, body: bodyExpired, executed: execExpired } =
      await runGetAllocations({ eligibility: 'expired' }, { rows: [] });
    // The mock returns no rows, so the count must be 0.
    assert.equal(codeExpired, 200);
    assert.equal(bodyExpired.pagination.total, 0);

    // Now verify the generated SQL does NOT match a row that only has r.status IS NULL:
    // the expired predicate requires "(r.status IS NOT NULL AND ...)". A row with
    // no reservation at all must pass through the predicate unmolested — the SQL
    // condition "(a.status = 'expired' OR (a.status = 'held' AND r.status IS NOT NULL
    // AND (...)))" must never match a held row that simply has r.status = NULL.
    const listSql = execExpired.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(
      listSql.includes('r.status IS NOT NULL'),
      'expired predicate must require a non-null reservation status so a held row with no reservation is not classified as expired',
    );

    // Verify that a held+no-reservation row is returned under the unfiltered list.
    const { code: codeAll, body: bodyAll } =
      await runGetAllocations({}, { rows: [heldNoReservation] });
    assert.equal(codeAll, 200);
    assert.equal(bodyAll.allocations.length, 1);
    assert.equal(bodyAll.allocations[0].status, 'held');
    assert.equal(bodyAll.allocations[0].reservationStatus, null);

    // Verify no write statement was issued.
    const { executed: execAll } = await runGetAllocations({}, { rows: [heldNoReservation] });
    for (const entry of execAll) {
      assert.ok(!WRITE_PATTERN.test(entry.sql), `read endpoint issued a write statement: ${entry.sql}`);
    }
  });

  // Regression test: a held allocation whose reservation EXISTS but is no
  // longer active (status 'released') is a DIFFERENT case from test 7b's
  // missing reservation:
  //   - eligibility=pending must EXCLUDE it: pending requires an ACTIVE
  //     reservation whose deadline is still in the future;
  //   - eligibility=expired must INCLUDE it: expired covers a held row whose
  //     EXISTING reservation is no longer active.
  // The eligibility rules themselves are not changed by this test.
  test('7c. Regression: held allocation with an inactive (released) reservation', async () => {
    const heldWithReleasedReservation = listRow({
      status: 'held',
      reservation_status: 'released',
      reservation_expires_at: new Date(Date.now() - 60_000),
    });

    /* ---------------------- (1) pending: excluded ----------------------- */
    const { code: pendingCode, executed: pendingExec } = await runGetAllocations(
      { eligibility: 'pending' },
      { rows: [] },
    );
    assert.equal(pendingCode, 200);

    const pendingCountSql = pendingExec.find((entry) => entry.sql.includes('SELECT count(*) AS total')).sql;
    const pendingListSql = pendingExec.find((entry) => entry.sql.includes('OFFSET $')).sql;
    for (const sql of [pendingCountSql, pendingListSql]) {
      assert.ok(sql.includes(`a.status = 'held'`), 'pending must be restricted to held allocations');
      assert.ok(sql.includes(`r.status = 'active'`), 'pending must require an ACTIVE reservation');
      assert.ok(sql.includes('r.expires_at > now()'), 'pending must require a FUTURE expiry');
    }
    // Evaluated against the row: a released reservation can satisfy neither
    // condition, so this allocation cannot appear under eligibility=pending.
    assert.equal(
      heldWithReleasedReservation.status === 'held' &&
        heldWithReleasedReservation.reservation_status === 'active' &&
        heldWithReleasedReservation.reservation_expires_at.getTime() > Date.now(),
      false,
      'a held row with a released reservation must be excluded from eligibility=pending',
    );

    /* ---------------------- (2) expired: included ----------------------- */
    const { code: expiredCode, body: expiredBody, executed: expiredExec } = await runGetAllocations(
      { eligibility: 'expired' },
      { rows: [heldWithReleasedReservation] },
    );
    assert.equal(expiredCode, 200);
    // The existing predicate accepts the row, so it is returned as-is:
    // stored status untouched, reservation status reported truthfully.
    assert.equal(expiredBody.allocations.length, 1);
    assert.equal(expiredBody.allocations[0].status, 'held');
    assert.equal(expiredBody.allocations[0].reservationStatus, 'released');

    const expiredCountSql = expiredExec.find((entry) => entry.sql.includes('SELECT count(*) AS total')).sql;
    const expiredListSql = expiredExec.find((entry) => entry.sql.includes('OFFSET $')).sql;
    for (const sql of [expiredCountSql, expiredListSql]) {
      assert.ok(sql.includes(`a.status = 'held'`), 'stored held rows stay in the expired result set');
      assert.ok(
        sql.includes('r.status IS NOT NULL'),
        'expired requires an EXISTING reservation (a missing reservation is not an inactive one)',
      );
      assert.ok(
        sql.includes(`r.status IS DISTINCT FROM 'active'`),
        'expired includes an existing reservation whose status is not active',
      );
    }
    // Evaluated against the row: an existing, non-active reservation is
    // exactly what the expired predicate is meant to catch.
    assert.equal(
      heldWithReleasedReservation.status === 'held' &&
        heldWithReleasedReservation.reservation_status !== null &&
        (heldWithReleasedReservation.reservation_status !== 'active' ||
          heldWithReleasedReservation.reservation_expires_at.getTime() <= Date.now()),
      true,
      'a held row with an existing released reservation must satisfy eligibility=expired',
    );

    // Reads only: this regression test must never issue a write statement.
    for (const entry of [...pendingExec, ...expiredExec]) {
      assert.ok(!WRITE_PATTERN.test(entry.sql), `read endpoint issued a write statement: ${entry.sql}`);
    }
  });

  /* ------------------------- HTTP: contract checks ------------------------ */

  test('8. HTTP: an invalid eligibility value is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/allocations?eligibility=not-a-filter`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /eligibility must be one of/);
  });

  test('9. HTTP: pending list and Pending Responses card use the same predicate', async () => {
    const [summaryRes, listRes] = await Promise.all([
      fetch(`${baseUrl}/summary`, { headers: { Authorization: `Bearer ${farmerToken}` } }),
      fetch(`${baseUrl}/allocations?eligibility=pending&limit=100`, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      }),
    ]);
    assert.equal(summaryRes.status, 200);
    assert.equal(listRes.status, 200);

    const summary = (await summaryRes.json()).summary;
    const list = await listRes.json();
    assert.equal(
      list.pagination.total,
      summary.pendingResponses,
      'the Awaiting Response list total must equal the dashboard pending count',
    );
    for (const allocation of list.allocations) {
      assert.equal(allocation.status, 'held');
      assert.equal(allocation.reservationStatus, 'active');
      assert.ok(new Date(allocation.reservationExpiresAt).getTime() > Date.now(), 'pending rows must have a future deadline');
      assert.equal(allocation.allocationReference, undefined);
      assert.equal(allocation.orderReference, undefined);
    }

    // The Expiring Soon card must be reachable as a list with the same total.
    const expiringRes = await fetch(`${baseUrl}/allocations?eligibility=expiring&limit=100`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(expiringRes.status, 200);
    const expiringBody = await expiringRes.json();
    assert.equal(
      expiringBody.pagination.total,
      summary.expiringSoon,
      'the Expiring Soon list total must equal the dashboard expiring count',
    );
    assert.ok(expiringBody.pagination.total <= summary.pendingResponses, 'expiring is a subset of pending');
  });

  test('10. HTTP: expired view only returns stored-expired or effectively-expired rows', async () => {
    const res = await fetch(`${baseUrl}/allocations?eligibility=expired&limit=100`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    const now = Date.now();
    for (const allocation of body.allocations) {
      const effectivelyExpired =
        allocation.status === 'expired' ||
        (allocation.status === 'held' &&
          allocation.reservationStatus !== undefined &&
          (allocation.reservationStatus !== 'active' ||
            (allocation.reservationExpiresAt !== null && new Date(allocation.reservationExpiresAt).getTime() <= now)));
      assert.ok(effectivelyExpired, `row ${allocation.allocationId} is not expired but was returned`);
      assert.equal(allocation.allocationReference, undefined);
      assert.equal(allocation.orderReference, undefined);
    }
  });

  test('11. HTTP: the legacy stored-status filters still work (status=held, status=declined)', async () => {
    const heldRes = await fetch(`${baseUrl}/allocations?status=held`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(heldRes.status, 200);
    const heldBody = await heldRes.json();
    for (const allocation of heldBody.allocations) assert.equal(allocation.status, 'held');

    const declinedRes = await fetch(`${baseUrl}/allocations?status=declined`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(declinedRes.status, 200);
    const declinedBody = await declinedRes.json();
    for (const allocation of declinedBody.allocations) assert.equal(allocation.status, 'declined');
  });

  /* ------------------- decision guards (mocked writes) ------------------- */

  /**
   * Runs a decision handler against a fully mocked transaction so no real
   * write can happen. Returns the HTTP code/message plus every statement the
   * fake client was asked to run.
   */
  async function runDecision(handler, { allocationRows, reservationRows, detailRow = null }) {
    const originalConnect = pool.connect;
    const originalQuery = pool.query;
    const executed = [];
    try {
      pool.query = async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return { rows: [{ id: DEMO_FARMER.id, name: DEMO_FARMER.name, role: 'farmer' }] };
        }
        // Post-commit detail read (loadAllocationDetail): only a successful
        // decision reaches it, so tests can drive the 200 response shape.
        if (typeof sql === 'string' && sql.includes('AS can_respond')) {
          return { rows: detailRow ? [detailRow] : [] };
        }
        throw new Error(`Unexpected pool.query in decision test: ${sql}`);
      };
      pool.connect = async () => ({
        async query(sql) {
          executed.push(sql);
          if (typeof sql === 'string' && sql.trim().startsWith('SELECT') && sql.includes('FROM allocations')) {
            return { rows: allocationRows, rowCount: allocationRows.length };
          }
          if (typeof sql === 'string' && sql.includes('FROM reservations')) {
            return { rows: reservationRows, rowCount: reservationRows.length };
          }
          // Simulate a matched row for the transactional writes, so a
          // well-formed decision can commit; every statement is still pushed
          // to `executed` and asserted on by the tests themselves.
          if (typeof sql === 'string' && /^\s*(UPDATE|DELETE|INSERT)\b/i.test(sql)) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release() {},
      });

      let code = 200;
      let body = null;
      const res = {
        status(next) {
          code = next;
          return this;
        },
        json(data) {
          body = data;
          return this;
        },
      };
      const req = {
        user: DEMO_FARMER,
        params: { allocationId: 'a1111111-1111-4111-8111-111111121011' },
        body: { reason: 'Cannot supply within the window' },
        requestId: '00000000-0000-0000-0000-000000000010',
      };
      await handler(req, res, (error) => {
        throw error;
      });
      return { code, body, executed };
    } finally {
      pool.connect = originalConnect;
      pool.query = originalQuery;
    }
  }

  const heldAllocationRow = { id: 'a1111111-1111-4111-8111-111111121011', status: 'held' };
  const expiredReservationRows = [
    { id: 'r1111111-1111-4111-8111-111111111111', status: 'active', expires_at: new Date(Date.now() - 1000), unexpired: false },
  ];

  test('12. An expired hold cannot be accepted: 409, rollback, no UPDATE issued', async () => {
    const { code, body, executed } = await runDecision(acceptAllocation, {
      allocationRows: [heldAllocationRow],
      reservationRows: expiredReservationRows,
    });
    assert.equal(code, 409);
    assert.match(body.error, /expired/i);
    assert.ok(executed.some((sql) => sql.includes('ROLLBACK')), 'the transaction must be rolled back');
    assert.ok(
      !executed.some((sql) => /^\s*UPDATE/i.test(sql)),
      'no allocation or reservation row may be updated for an expired hold',
    );
  });

  test('13. An expired hold cannot be declined: 409, rollback, no UPDATE issued', async () => {
    const { code, body, executed } = await runDecision(declineAllocation, {
      allocationRows: [heldAllocationRow],
      reservationRows: expiredReservationRows,
    });
    assert.equal(code, 409);
    assert.match(body.error, /expired/i);
    assert.ok(executed.some((sql) => sql.includes('ROLLBACK')));
    assert.ok(
      !executed.some((sql) => /^\s*UPDATE/i.test(sql)),
      'declining an expired hold must not release or rewrite anything',
    );
  });

  /* ------------- decision=accepted: genuine audit-backed decisions -------- */

  /**
   * Mirrors the backend's FARMER_ACCEPTED_PREDICATE exactly: the EARLIEST
   * recorded farmer decision (accepted or declined; occurred_at ASC then id
   * ASC, the same interpretation Allocation History uses) must be
   * `allocation.accepted`. No decision event at all -> never accepted
   * (SRS FR-RES-04: a missing farmer response is never acceptance).
   */
  function earliestDecisionIsAccepted(auditEvents) {
    const decisions = auditEvents.filter(
      (event) => event.action === 'allocation.accepted' || event.action === 'allocation.declined',
    );
    if (decisions.length === 0) return false;
    decisions.sort((a, b) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : 1));
    return decisions[0].action === 'allocation.accepted';
  }

  const acceptedEvent = (id, iso) => ({ id, action: 'allocation.accepted', occurredAt: new Date(iso) });
  const declinedEvent = (id, iso) => ({ id, action: 'allocation.declined', occurredAt: new Date(iso) });

  // Controlled fixtures: `expected` is what the decision filter must admit.
  const DECISION_CASES = [
    // 1. genuine acceptance event -> included
    { name: 'supplier_accepted WITH acceptance event', status: 'supplier_accepted', expected: true,
      events: [acceptedEvent('ev-1', '2026-11-01T08:00:00Z')] },
    // 2. declined -> excluded
    { name: 'declined allocation', status: 'declined', expected: false,
      events: [declinedEvent('ev-2', '2026-11-02T08:00:00Z')] },
    // 3. held without a farmer decision -> excluded
    { name: 'held without a farmer decision', status: 'held', expected: false, events: [] },
    // 4. committed without an acceptance event -> excluded
    { name: 'committed without an acceptance event', status: 'committed', expected: false, events: [] },
    // 5. picked_up without an acceptance event -> excluded
    { name: 'picked_up without an acceptance event', status: 'picked_up', expected: false, events: [] },
    // 6. no audit event at all -> excluded, even under an "accepted"-looking status
    { name: 'operational status accepted but NO audit event', status: 'accepted', expected: false, events: [] },
    { name: 'resolved without any decision event', status: 'resolved', expected: false, events: [] },
    // The event, not the status, is what counts: committed WITH acceptance.
    { name: 'committed WITH acceptance event', status: 'committed', expected: true,
      events: [acceptedEvent('ev-3', '2026-11-03T08:00:00Z')] },
    // Earliest-event-wins (same as Allocation History): declined first stays excluded.
    { name: 'declined first, accepted later', status: 'declined', expected: false,
      events: [declinedEvent('ev-4', '2026-11-04T08:00:00Z'), acceptedEvent('ev-5', '2026-11-05T08:00:00Z')] },
    // Duplicate acceptance events still admit the row exactly once (see test 16).
    { name: 'duplicate acceptance events', status: 'supplier_accepted', expected: true,
      events: [acceptedEvent('ev-6', '2026-11-06T08:00:00Z'), acceptedEvent('ev-7', '2026-11-06T09:00:00Z')] },
  ];

  test('14. decision=accepted filters on the genuine audit event, never on operational status', async () => {
    const { code, executed } = await runGetAllocations({ decision: 'accepted' }, { rows: [] });
    assert.equal(code, 200);

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    const countSql = executed.find((entry) => entry.sql.includes('SELECT count(*) AS total')).sql;

    // The count and the page share the same WHERE, so both carry the predicate.
    for (const sql of [listSql, countSql]) {
      assert.ok(sql.includes('FROM audit_logs al'), 'must read the append-only audit trail');
      assert.ok(sql.includes(`al.target_type = 'allocation'`), 'audit rows must be scoped to allocations');
      assert.ok(
        sql.includes(`al.action IN ('allocation.accepted', 'allocation.declined')`),
        'must reuse the exact audit-event identification Allocation History uses',
      );
      assert.ok(
        sql.includes('ORDER BY al.occurred_at ASC, al.id ASC'),
        'must keep the earliest-genuine-decision-wins semantics',
      );
      assert.ok(sql.includes('LIMIT 1'), 'the decision lookup must stay single-row (duplicate-safe)');
      assert.ok(sql.includes(`) = 'allocation.accepted'`), 'must require the genuine acceptance decision');
      assert.ok(sql.includes('WHERE a.farmer_id = $1'), 'farmer scoping must be preserved');
      assert.ok(!sql.includes('supplier_accepted'), 'no operational status group may stand in for the decision');
    }
    // decision=accepted alone must not fabricate any stored-status condition
    // (the DTO SELECT still reads `a.status`, but never with an '=' after it).
    assert.ok(!listSql.includes('a.status ='), 'decision=accepted must not add a status filter');
    assert.ok(!countSql.includes('a.status ='), 'decision=accepted must not add a status filter');

    // Fixture evaluation of the very same rule the SQL implements.
    for (const item of DECISION_CASES) {
      assert.equal(
        earliestDecisionIsAccepted(item.events),
        item.expected,
        `${item.name}: must be ${item.expected ? 'included in' : 'excluded from'} decision=accepted`,
      );
      if (item.expected) {
        assert.ok(
          item.events.some((event) => event.action === 'allocation.accepted'),
          `${item.name}: inclusion requires a genuine acceptance audit event`,
        );
      }
    }
  });

  test('15. Unknown decision values are rejected with 400 before any list query', async () => {
    const { code, body, executed } = await runGetAllocations({ decision: 'maybe' });
    assert.equal(code, 400);
    assert.match(body.error, /decision must be one of/);
    assert.equal(
      executed.filter((entry) => entry.sql.includes('OFFSET $')).length,
      0,
      'the list query must not run for a rejected parameter',
    );

    // An empty value behaves exactly like an omitted filter (readOptionalString).
    const { code: emptyCode } = await runGetAllocations({ decision: '' });
    assert.equal(emptyCode, 200, 'an empty decision parameter behaves like an omitted one');
  });

  test('16. Duplicate audit records cannot duplicate rows or distort counts and pagination', async () => {
    const { code, executed } = await runGetAllocations({ decision: 'accepted' }, { rows: [listRow()] });
    assert.equal(code, 200);

    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    const countSql = executed.find((entry) => entry.sql.includes('SELECT count(*) AS total')).sql;

    // No join to audit_logs anywhere: a scalar subquery (LIMIT 1) keeps the
    // row cardinality exactly one no matter how many audit rows exist.
    assert.ok(!/JOIN\s+audit_logs/i.test(listSql), 'the decision filter must not join audit rows');
    assert.ok(!/JOIN\s+audit_logs/i.test(countSql), 'the decision filter must not join audit rows');

    // Count and page must carry the byte-identical decision predicate, so a
    // filtered list total can never disagree with the rows actually returned.
    const extract = (sql) => (sql.match(/AND \([\s\S]*?\) = 'allocation\.accepted'/) || [])[0];
    const listPredicate = extract(listSql);
    assert.ok(listPredicate, 'the decision predicate must be present in the list query');
    assert.equal(listPredicate, extract(countSql), 'count and page must share the identical predicate');

    // Pagination still binds limit/offset as parameters after the farmer id.
    const listEntry = executed.find((entry) => entry.sql.includes('OFFSET $'));
    assert.deepEqual(listEntry.params, [DEMO_FARMER.id, 10, 0]);
  });

  test('17. decision=accepted composes with search, sorting and pagination', async () => {
    const { code, body, executed } = await runGetAllocations(
      { decision: 'accepted', search: 'demo', sort: 'oldest', page: '2', limit: '5' },
      { rows: [listRow()] },
    );
    assert.equal(code, 200);

    const listEntry = executed.find((entry) => entry.sql.includes('OFFSET $'));
    const countEntry = executed.find((entry) => entry.sql.includes('SELECT count(*) AS total'));
    for (const entry of [listEntry, countEntry]) {
      assert.ok(entry.sql.includes(`) = 'allocation.accepted'`), 'decision predicate must survive composition');
      assert.ok(entry.sql.includes('a.operation_key ILIKE $2'), 'search predicate must survive composition');
    }
    // Sorting preserved (oldest) and pagination still correct.
    assert.ok(listEntry.sql.includes('a.created_at ASC, a.id ASC'), 'the oldest sort must be preserved');
    assert.equal(body.pagination.page, 2);
    assert.equal(body.pagination.limit, 5);
    // [farmer id, search pattern, limit, offset] — no decision parameter needed.
    assert.deepEqual(listEntry.params, [DEMO_FARMER.id, '%demo%', 5, 5]);
  });

  test('18. decision=accepted does not break existing status and eligibility filters', async () => {
    // Plain stored-status filter: unchanged, and it never consults the audit trail.
    const statusRun = await runGetAllocations({ status: 'declined' }, { rows: [listRow({ status: 'declined' })] });
    assert.equal(statusRun.code, 200);
    const statusSql = statusRun.executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(statusSql.includes('a.status = $2'), 'the legacy status filter must still bind its parameter');
    assert.ok(!statusSql.includes('audit_logs'), 'the legacy status filter must not consult the audit trail');

    // Eligibility filter: unchanged, and it never consults the audit trail.
    const eligibilityRun = await runGetAllocations({ eligibility: 'pending' });
    assert.equal(eligibilityRun.code, 200);
    const eligibilitySql = eligibilityRun.executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(eligibilitySql.includes(`r.status = 'active'`));
    assert.ok(eligibilitySql.includes('r.expires_at > now()'));
    assert.ok(!eligibilitySql.includes('audit_logs'), 'the eligibility filter must not consult the audit trail');

    // decision + status compose with AND.
    const combined = await runGetAllocations({ decision: 'accepted', status: 'declined' });
    assert.equal(combined.code, 200);
    const combinedSql = combined.executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(combinedSql.includes('a.status = $2'));
    assert.ok(combinedSql.includes(`) = 'allocation.accepted'`));

    // decision + eligibility compose with AND as well.
    const both = await runGetAllocations({ decision: 'accepted', eligibility: 'expired' });
    assert.equal(both.code, 200);
    const bothSql = both.executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(bothSql.includes('r.status IS NOT NULL'), 'the expired eligibility predicate must survive');
    assert.ok(bothSql.includes(`) = 'allocation.accepted'`));
  });

  test('19. decision=accepted stays scoped to the authenticated farmer (Farmer A vs B)', async () => {
    const injectedFarmerId = '99999999-9999-9999-9999-999999999999';
    const { code, executed } = await runGetAllocations(
      { decision: 'accepted', farmerId: injectedFarmerId, farmer_id: injectedFarmerId },
      { rows: [] },
    );
    assert.equal(code, 200);

    const dataQueries = executed.filter(
      (entry) =>
        entry.sql.includes('SELECT count(*) AS total') ||
        entry.sql.includes('OFFSET $') ||
        entry.sql.includes('FROM users WHERE id = $1'),
    );
    assert.ok(dataQueries.length >= 3, 'lookup, count and page queries must all run');
    for (const entry of dataQueries) {
      assert.equal(entry.params[0], DEMO_FARMER.id, 'every query must bind the authenticated farmer id');
      assert.ok(!entry.params.includes(injectedFarmerId), 'an injected farmer id must never be bound');
    }
    const listSql = executed.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(listSql.includes('WHERE a.farmer_id = $1'), 'ownership scope must remain in the WHERE clause');
    // The audit subquery is tied to the allocation row itself, never to a
    // caller-supplied user id.
    assert.ok(listSql.includes('AND al.target_id = a.id'), 'the audit lookup must follow the allocation row');
  });

  test('20. HTTP: decision validation and unchanged inbox/summary behaviour', async () => {
    const auth = { Authorization: `Bearer ${farmerToken}` };

    // Unknown decision value -> 400 with the allowlist message.
    const invalid = await fetch(`${baseUrl}/allocations?decision=whatever`, { headers: auth });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /decision must be one of/);

    // decision=accepted is accepted by the API and returns a plain DTO list.
    const acceptedRes = await fetch(`${baseUrl}/allocations?decision=accepted&limit=100`, { headers: auth });
    assert.equal(acceptedRes.status, 200);
    const acceptedBody = await acceptedRes.json();
    assert.ok(Array.isArray(acceptedBody.allocations));
    assert.ok(Number.isFinite(acceptedBody.pagination.total));
    for (const row of acceptedBody.allocations) {
      assert.equal(row.allocationReference, undefined);
      assert.equal(row.operation_key, undefined);
      assert.equal(row.orderReference, undefined);
    }

    // Plain inbox list unchanged (no decision filter -> identical behaviour).
    const plain = await fetch(`${baseUrl}/allocations`, { headers: auth });
    assert.equal(plain.status, 200);

    // Legacy status filter unchanged.
    const declined = await fetch(`${baseUrl}/allocations?status=declined`, { headers: auth });
    assert.equal(declined.status, 200);

    // Summary unchanged: the dashboard cards keep their existing predicates.
    const summaryRes = await fetch(`${baseUrl}/summary`, { headers: auth });
    assert.equal(summaryRes.status, 200);
    const summaryBody = await summaryRes.json();
    assert.ok('pendingResponses' in summaryBody.summary);
    assert.ok('acceptedAllocations' in summaryBody.summary);
    assert.ok('expiringSoon' in summaryBody.summary);
  });

  /* ------------- farmer acceptance: hold preserved, decided once --------- */

  // A live hold (still inside its 30 minute window) — the state Accept must
  // leave completely alone.
  const liveReservationRows = [
    {
      id: 'r11111111-1111-4111-8111-111111111111',
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      unexpired: true,
    },
  ];

  /** Post-decision detail row as loadAllocationDetail would return it. */
  function acceptedDetailRow(overrides = {}) {
    return {
      id: 'a1111111-1111-4111-8111-111111121011',
      order_id: 'o11111111-1111-4111-8111-111111111111',
      batch_id: 'b1111111-1111-4111-8111-111111111111',
      batch_display_id: 'BM-01',
      buyer_name: 'Demo Buyer',
      crop_name: 'Tomato',
      grade_name: 'Grade A',
      farm_name: 'Green Valley Farm',
      farm_district: 'Nuwara Eliya',
      agreed_kg: '400.000',
      agreed_unit_price_cents: '18000',
      agreed_value_cents: '7200000',
      status: 'supplier_accepted',
      decision_reason: null,
      created_at: new Date('2026-11-23T04:00:00Z'),
      order_status: 'awaiting_suppliers',
      order_delivery_date: new Date('2026-11-26'),
      order_destination_district: 'Gampaha',
      reservation_status: 'active',
      reservation_expires_at: liveReservationRows[0].expires_at,
      reservation_held_kg: '400.000',
      can_respond: false,
      response_unavailable_reason: 'This allocation is no longer awaiting your response (status: supplier_accepted).',
      ...overrides,
    };
  }

  // SRS rule: Accept moves ONLY the allocation. The hold stays active with its
  // ORIGINAL expires_at — accept performs no release, consume, extend or reset
  // — so the stock stays protected for the buyer confirmation process. The
  // deadline itself still stands (SRS §16/§24): if the buyer never confirms,
  // the background expiry worker (not YM17) expires that hold at its original
  // expires_at.
  test('21. Successful accept: held -> supplier_accepted, hold untouched, exactly one audit event', async () => {
    const { code, body, executed } = await runDecision(acceptAllocation, {
      allocationRows: [heldAllocationRow],
      reservationRows: liveReservationRows,
      detailRow: acceptedDetailRow(),
    });
    assert.equal(code, 200);

    // 1. Exactly one allocation write, and it is the required transition,
    //    still guarded so a concurrent decision can never be overwritten.
    const allocationWrites = executed.filter((sql) => /^\s*UPDATE\s+allocations\b/i.test(sql));
    assert.equal(allocationWrites.length, 1, 'accept must issue exactly one allocation UPDATE');
    assert.ok(
      allocationWrites[0].includes(`SET status = 'supplier_accepted'`),
      'held must transition to supplier_accepted',
    );
    assert.ok(
      allocationWrites[0].includes(`status = 'held'`),
      'the UPDATE must stay guarded on the expected held state',
    );

    // 2. The reservation is READ-LOCKED and never written: no release, no
    //    consume, no extension, no reset of the hold or its expires_at.
    const reservationStatements = executed.filter((sql) => /reservations\b/i.test(sql));
    assert.equal(reservationStatements.length, 1, 'accept reads the hold once and only once');
    const reservationSql = reservationStatements[0];
    assert.ok(/^\s*SELECT\b/i.test(reservationSql), 'the hold may only be read during accept');
    assert.ok(reservationSql.includes('FOR UPDATE'), 'the live hold must be locked for the decision');
    assert.equal(
      executed.some((sql) => /^\s*(UPDATE|DELETE|INSERT)\s+reservations\b/i.test(sql)),
      false,
      'accept must not release, consume, extend or reset the reservation',
    );
    assert.equal(
      executed.filter((sql) => /^\s*UPDATE\b/i.test(sql) && /expires_at\s*=/i.test(sql)).length,
      0,
      'no statement may rewrite an expires_at value',
    );

    // 3. The decision is audited exactly once and nothing else is fabricated.
    const auditInserts = executed.filter((sql) => /INSERT\s+INTO\s+audit_logs\b/i.test(sql));
    assert.equal(auditInserts.length, 1, 'accept records exactly one audit event');
    assert.ok(auditInserts[0].includes(`'allocation.accepted'`), 'the event must be allocation.accepted');
    assert.equal(
      executed.filter((sql) => sql.includes('ROLLBACK')).length,
      0,
      'a successful decision must commit, not roll back',
    );

    // 4. The response reports the new allocation state and the ORIGINAL hold.
    assert.equal(body.allocation.status, 'supplier_accepted');
    assert.equal(body.allocation.reservationStatus, 'active');
    assert.equal(
      body.allocation.reservationExpiresAt,
      liveReservationRows[0].expires_at.toISOString(),
      'the original expires_at must be echoed back unchanged',
    );
  });

  // Idempotency: the same decision issued twice must never duplicate the
  // transition or the audit event (409 + rollback, zero writes).
  test('22. Accept is idempotent: a second decision is 409 with no further writes or audit events', async () => {
    const { code, body, executed } = await runDecision(acceptAllocation, {
      allocationRows: [{ id: 'a1111111-1111-4111-8111-111111121011', status: 'supplier_accepted' }],
      reservationRows: liveReservationRows,
    });
    assert.equal(code, 409);
    assert.match(body.error, /already been decided/i);
    assert.ok(executed.some((sql) => sql.includes('ROLLBACK')), 'the transaction must be rolled back');
    assert.equal(
      executed.filter((sql) => /^\s*(UPDATE|DELETE|INSERT)\b/i.test(sql)).length,
      0,
      'a repeated decision must not write anything at all',
    );
    assert.equal(
      executed.filter((sql) => /INSERT\s+INTO\s+audit_logs\b/i.test(sql)).length,
      0,
      'the audit event must never be duplicated',
    );
  });

  // Read-side eligibility rule (YM17 scope only): the GET eligibility filter
  // is guarded on a.status = 'held', so a supplier_accepted row will never
  // appear under eligibility=pending or the held branch of eligibility=expired.
  //
  // IMPORTANT — what this test does NOT assert:
  //   The read-side guard does NOT mean the background expiry worker should
  //   skip supplier_accepted allocations. SRS §16/§24 makes the worker rule
  //   independent: it must expire ANY active reservation whose expires_at has
  //   passed and whose allocation is still uncommitted (held OR supplier_accepted).
  //   That is a write-side concern owned by YM16 (pending team-lead confirmation;
  //   see PROPOSALS.md). YM17 owns only the read-side classifiers tested here.
  test('23. Read-side eligibility classifiers never flag a supplier_accepted row as pending or expired', async () => {
    // A supplier_accepted allocation whose original reservation is still stored
    // as active but whose deadline has already passed. This is the transitional
    // state that exists before the expiry worker runs. The read-side classifier
    // must NOT flag it as pending or expired — it is simply not held.
    // The expiry worker (YM16, unimplemented) must separately expire its hold.
    const acceptedPastDeadline = listRow({
      status: 'supplier_accepted',
      reservation_status: 'active',
      reservation_expires_at: new Date(Date.now() - 60_000),
    });

    // --- (A) pending: guarded on a.status = 'held' ---
    const { code: pendingCode, executed: pendingExec } = await runGetAllocations(
      { eligibility: 'pending' },
      { rows: [] },
    );
    assert.equal(pendingCode, 200);
    const pendingSql = pendingExec.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(pendingSql.includes(`a.status = 'held'`), 'pending must be restricted to held allocations');
    assert.ok(pendingSql.includes(`r.status = 'active'`), 'pending must require a live hold');

    // --- (B) expired: the held branch is also guarded on a.status = 'held' ---
    const { code: expiredCode, executed: expiredExec } = await runGetAllocations(
      { eligibility: 'expired' },
      { rows: [] },
    );
    assert.equal(expiredCode, 200);
    const expiredSql = expiredExec.find((entry) => entry.sql.includes('OFFSET $')).sql;
    assert.ok(expiredSql.includes(`a.status = 'expired'`), 'stored expired rows stay eligible');
    // The read-side "held but hold dead" branch requires a.status = 'held',
    // so a supplier_accepted row can never be returned by this branch.
    // Note: the expiry WORKER (write-side, YM16) must separately handle
    // supplier_accepted allocations whose reservations are overdue — that is
    // outside the scope of this read-side assertion.
    assert.ok(
      expiredSql.includes(`a.status = 'held' AND r.status IS NOT NULL`),
      'the expired held-branch must be guarded on held so a supplier_accepted row is never matched by the read classifier',
    );

    // Evaluate both read-side predicates against the supplier_accepted row,
    // exactly as the SQL would (JavaScript mirror of the WHERE clauses).
    // Expected result: neither predicate matches — this is a read-side property
    // only. The expiry worker's write-side decision is a separate concern.
    const matchesPending =
      acceptedPastDeadline.status === 'held' &&
      acceptedPastDeadline.reservation_status === 'active' &&
      acceptedPastDeadline.reservation_expires_at.getTime() > Date.now();
    const matchesExpiredReadSide =
      acceptedPastDeadline.status === 'expired' ||
      (acceptedPastDeadline.status === 'held' &&
        acceptedPastDeadline.reservation_status !== null &&
        (acceptedPastDeadline.reservation_status !== 'active' ||
          acceptedPastDeadline.reservation_expires_at.getTime() <= Date.now()));

    assert.equal(matchesPending, false, 'read classifier: a supplier_accepted row must never appear under eligibility=pending');
    assert.equal(
      matchesExpiredReadSide,
      false,
      // The read-side classifier does not flag this row — but that is NOT a
      // guarantee that the expiry worker can skip it. The worker must still
      // expire its active, overdue reservation independently (SRS §24).
      'read classifier: a supplier_accepted row is not matched by the held branch of eligibility=expired',
    );

    // Reads only: no classifier may ever write.
    for (const entry of [...pendingExec, ...expiredExec]) {
      assert.ok(!WRITE_PATTERN.test(entry.sql), `read endpoint issued a write statement: ${entry.sql}`);
    }
  });
});
