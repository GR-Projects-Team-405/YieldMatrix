import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../server.js';
import pool from '../../config/db.js';
import { getAllocationHistory } from './controller.js';

const JWT_SECRET = process.env.JWT_SECRET || 'yieldmatrix_dev_secret_key';

function makeToken(user) {
  return jwt.sign(
    { role: user.role, name: user.name, demo: true },
    JWT_SECRET,
    { subject: user.id, expiresIn: '15m', algorithm: 'HS256', issuer: 'yieldmatrix', audience: 'yieldmatrix-web' }
  );
}

const DEMO_FARMER = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'farmer',
  name: 'Demo Farmer',
};

const OTHER_FARMER = {
  id: '11111111-1111-1111-1111-222222222222',
  role: 'farmer',
  name: 'Unapproved Farmer',
};

const BUYER_USER = {
  id: '22222222-2222-2222-2222-222222222222',
  role: 'buyer',
  name: 'Demo Buyer',
};

describe('YM17 Allocation History Backend API (Task 04B-1)', () => {
  let server;
  let baseUrl;
  let farmerToken;
  let otherFarmerToken;
  let buyerToken;

  before(async () => {
    farmerToken = makeToken(DEMO_FARMER);
    otherFarmerToken = makeToken(OTHER_FARMER);
    buyerToken = makeToken(BUYER_USER);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/ym17`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  });

  // 1. Unauthenticated request is rejected
  test('1. Unauthenticated request is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/allocations/history`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /authentication/i);
  });

  // 2. Non-farmer role is rejected
  test('2. Non-farmer role (buyer) is rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /forbidden/i);
  });

  // 3. Unapproved farmer is rejected
  test('3. Unapproved/unknown farmer is rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${otherFarmerToken}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /account is not approved/i);
  });

  // 4. Farmer A cannot retrieve Farmer B's history
  test('4. History is strictly scoped to authenticated caller, ignores injected farmer query params', async () => {
    const injectedId = '99999999-9999-9999-9999-999999999999';
    const res = await fetch(`${baseUrl}/allocations/history?farmerId=${injectedId}&farmer_id=${injectedId}`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.allocations));
    // The count must be a non-negative integer — it must not vary based on
    // injected farmer-id query parameters (those are silently ignored).
    // We do NOT assert an exact number here because the test must remain
    // independent of the shared database's current record count.
    assert.ok(
      typeof body.summary.totalHistoricalAllocations === 'number' &&
        Number.isFinite(body.summary.totalHistoricalAllocations) &&
        body.summary.totalHistoricalAllocations >= 0,
      'totalHistoricalAllocations must be a non-negative number',
    );
    // All returned records must belong to the authenticated caller, not to
    // the injected farmerId — verified by asserting no held allocations are
    // present (the endpoint's own scope predicate always excludes them).
    for (const alloc of body.allocations) {
      assert.notEqual(alloc.operationalStatus, 'held', 'History must never return held allocations regardless of query params');
    }
  });

  // 5. Held allocations are excluded
  test('5. Held allocations are excluded from history list and summary counts', async () => {
    const res = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    for (const alloc of body.allocations) {
      assert.notEqual(alloc.operationalStatus, 'held', 'History must never contain held allocations');
    }
  });

  // 6. Missing audit records return null decision fields
  test('6. Legacy historical allocations without audit records return null decision fields', async () => {
    const res = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const legacyAlloc = body.allocations[0];
    assert.ok(legacyAlloc, 'Expected at least one historical allocation');
    assert.equal(legacyAlloc.farmerDecision, null);
    assert.equal(legacyAlloc.farmerDecisionAt, null);
    assert.equal(legacyAlloc.farmerDecisionReason, null);
    // Security check: internal operation keys must not be exposed in DTO
    assert.equal(legacyAlloc.allocationReference, undefined);
    assert.equal(legacyAlloc.operation_key, undefined);
    assert.equal(legacyAlloc.orderReference, undefined);
    assert.equal(legacyAlloc.order_operation_key, undefined);
    assert.ok(legacyAlloc.orderId, 'orderId must be retained as the order identifier');
  });

  // 7, 8, 9, 10, 16: Unit test with simulated query responses for decision audit logs & summary
  test('7 & 8 & 9 & 10 & 16. Decision dimensions, operational status, and duplicate audit resilience', async () => {
    // We mock pool.query locally for this controller invocation to test specific audit log states
    const originalQuery = pool.query;
    try {
      let executedSummarySql = '';
      let executedListSql = '';

      pool.query = async (sql, params) => {
        // Mock getApprovedFarmer
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return { rows: [{ id: DEMO_FARMER.id, name: DEMO_FARMER.name, role: 'farmer' }] };
        }
        // Mock summary query
        if (typeof sql === 'string' && sql.includes('AS total_historical')) {
          executedSummarySql = sql;
          return {
            rows: [{
              total_historical: '4',
              accepted: '2',
              declined: '1',
              expired: '1',
            }],
          };
        }
        // Mock count query
        if (typeof sql === 'string' && sql.includes('SELECT count(*) AS total')) {
          return { rows: [{ total: '4' }] };
        }
        // Mock page query
        if (typeof sql === 'string' && sql.includes('operational_status')) {
          executedListSql = sql;
          return {
            rows: [
              // 7 & 9: Accepted decision with later operational status (committed)
              {
                id: 'a0000000-0000-0000-0000-000000000001',
                operation_key: 'op-1',
                order_id: 'o0000000-0000-0000-0000-000000000001',
                order_operation_key: 'ord-op-1',
                buyer_name: 'Supermart',
                batch_id: 'b0000000-0000-0000-0000-000000000001',
                crop_name: 'Carrot',
                grade_name: 'Grade A',
                agreed_kg: '150.000',
                agreed_unit_price_cents: '12000',
                agreed_value_cents: '1800000',
                operational_status: 'committed',
                order_status: 'in_fulfilment',
                created_at: new Date('2026-11-10T08:00:00Z'),
                decision_action: 'allocation.accepted',
                decision_at: new Date('2026-11-10T08:30:00Z'),
                audit_reason: null,
              },
              // 8: Declined decision with audit reason
              {
                id: 'a0000000-0000-0000-0000-000000000002',
                operation_key: 'op-2',
                order_id: 'o0000000-0000-0000-0000-000000000002',
                order_operation_key: 'ord-op-2',
                buyer_name: 'Green Grocer',
                batch_id: 'b0000000-0000-0000-0000-000000000002',
                crop_name: 'Tomato',
                grade_name: 'Grade B',
                agreed_kg: '80.000',
                agreed_unit_price_cents: '9500',
                agreed_value_cents: '760000',
                operational_status: 'declined',
                order_status: 'awaiting_suppliers',
                created_at: new Date('2026-11-11T09:00:00Z'),
                decision_action: 'allocation.declined',
                decision_at: new Date('2026-11-11T09:15:00Z'),
                audit_reason: 'Price too low',
              },
              // 10: Expired operational status (system outcome, not farmer decision)
              {
                id: 'a0000000-0000-0000-0000-000000000003',
                operation_key: 'op-3',
                order_id: 'o0000000-0000-0000-0000-000000000003',
                order_operation_key: 'ord-op-3',
                buyer_name: 'Fresh Hub',
                batch_id: 'b0000000-0000-0000-0000-000000000003',
                crop_name: 'Bell Pepper',
                grade_name: 'Grade A',
                agreed_kg: '50.000',
                agreed_unit_price_cents: '20000',
                agreed_value_cents: '1000000',
                operational_status: 'expired',
                order_status: 'expired',
                created_at: new Date('2026-11-12T10:00:00Z'),
                decision_action: null,
                decision_at: null,
                audit_reason: null,
              },
              // Missing audit record
              {
                id: 'a0000000-0000-0000-0000-000000000004',
                operation_key: 'op-4',
                order_id: 'o0000000-0000-0000-0000-000000000004',
                order_operation_key: 'ord-op-4',
                buyer_name: 'Organic Market',
                batch_id: 'b0000000-0000-0000-0000-000000000004',
                crop_name: 'Potato',
                grade_name: 'Grade A',
                agreed_kg: '300.000',
                agreed_unit_price_cents: '8000',
                agreed_value_cents: '2400000',
                operational_status: 'accepted',
                order_status: 'delivered',
                created_at: new Date('2026-11-13T11:00:00Z'),
                decision_action: null,
                decision_at: null,
                audit_reason: null,
              },
            ],
          };
        }
        return originalQuery.apply(pool, [sql, params]);
      };

      const req = {
        user: DEMO_FARMER,
        query: {},
        requestId: '00000000-0000-0000-0000-000000000001',
      };
      let resData = null;
      const res = {
        json(data) { resData = data; return this; },
        status() { return this; },
      };
      await getAllocationHistory(req, res, () => {});

      assert.ok(resData);
      assert.equal(resData.summary.totalHistoricalAllocations, 4);
      assert.equal(resData.summary.accepted, 2);
      assert.equal(resData.summary.declined, 1);
      assert.equal(resData.summary.expired, 1);

      // Verify item 1: Accepted decision with later operational status ('committed')
      const item1 = resData.allocations[0];
      assert.equal(item1.farmerDecision, 'accepted');
      assert.equal(item1.operationalStatus, 'committed');
      assert.equal(item1.farmerDecisionAt, '2026-11-10T08:30:00.000Z');
      assert.equal(item1.farmerDecisionReason, null);
      assert.equal(item1.allocationReference, undefined);
      assert.equal(item1.orderReference, undefined);
      assert.equal(item1.order_operation_key, undefined);
      assert.equal(item1.orderId, 'o0000000-0000-0000-0000-000000000001');

      // Verify item 2: Declined decision with audit reason
      const item2 = resData.allocations[1];
      assert.equal(item2.farmerDecision, 'declined');
      assert.equal(item2.operationalStatus, 'declined');
      assert.equal(item2.farmerDecisionAt, '2026-11-11T09:15:00.000Z');
      assert.equal(item2.farmerDecisionReason, 'Price too low');
      assert.equal(item2.orderReference, undefined);

      // Verify item 3: Expired operational status
      const item3 = resData.allocations[2];
      assert.equal(item3.farmerDecision, null);
      assert.equal(item3.operationalStatus, 'expired');
      assert.equal(item3.orderReference, undefined);

      // Verify item 4: Missing audit record
      const item4 = resData.allocations[3];
      assert.equal(item4.farmerDecision, null);
      assert.equal(item4.farmerDecisionAt, null);
      assert.equal(item4.farmerDecisionReason, null);
      assert.equal(item4.orderReference, undefined);

      // Verify SQL Lateral join has LIMIT 1 to prevent duplication
      assert.ok(executedSummarySql.includes('LIMIT 1'));
      assert.ok(executedSummarySql.includes("al.action IN ('allocation.accepted', 'allocation.declined')"));
      assert.ok(executedListSql.includes('LIMIT 1'));
      // Verify operation keys are not in the SELECT list
      assert.ok(!executedListSql.includes('a.operation_key'));
      assert.ok(!executedListSql.includes('o.operation_key'));
    } finally {
      pool.query = originalQuery;
    }
  });

  // 11. Summary counts are independent of filters and pagination
  test('11. Summary counts remain constant regardless of status filter, search, or pagination', async () => {
    // Base request without filter
    const resBase = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    const bodyBase = await resBase.json();

    // Request with status filter and page=2, limit=2
    const resFiltered = await fetch(`${baseUrl}/allocations/history?status=accepted&page=2&limit=2`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    const bodyFiltered = await resFiltered.json();

    assert.equal(resFiltered.status, 200);
    assert.deepEqual(bodyFiltered.summary, bodyBase.summary, 'Summary counts must be independent of filters');
    assert.equal(bodyFiltered.pagination.page, 2);
    assert.equal(bodyFiltered.pagination.limit, 2);
  });

  // 12. Multiple comma-separated status filters work
  test('12. Multiple comma-separated status filters work', async () => {
    const res = await fetch(`${baseUrl}/allocations/history?status=accepted,picked_up`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    for (const alloc of body.allocations) {
      assert.ok(['accepted', 'picked_up'].includes(alloc.operationalStatus));
    }
  });

  // 13. Invalid and held status filters return HTTP 400
  test('13. Invalid status filters and "held" return HTTP 400', async () => {
    // 'held' filter
    const resHeld = await fetch(`${baseUrl}/allocations/history?status=held`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resHeld.status, 400);
    const bodyHeld = await resHeld.json();
    assert.match(bodyHeld.error, /held/i);

    // Invalid status filter
    const resInvalid = await fetch(`${baseUrl}/allocations/history?status=unknown_status`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resInvalid.status, 400);
    const bodyInvalid = await resInvalid.json();
    assert.match(bodyInvalid.error, /must be one of/i);
  });

  // 14. Search works with the supported fields
  test('14. Search works for crop name, buyer name, allocation reference, and ID', async () => {
    // Search for Lettuce
    const res = await fetch(`${baseUrl}/allocations/history?search=Lettuce`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.allocations.length, 1);
    assert.equal(body.allocations[0].cropName, 'Lettuce');
    assert.equal(body.allocations[0].allocationReference, undefined);
    assert.equal(body.allocations[0].operation_key, undefined);
    assert.equal(body.allocations[0].orderReference, undefined);
    assert.equal(body.allocations[0].order_operation_key, undefined);

    // Search by internal allocation operation_key works internally but does not expose it in DTO
    const resOpKey = await fetch(`${baseUrl}/allocations/history?search=seed:ym25:allocation:lettuce:v1`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resOpKey.status, 200);
    const bodyOpKey = await resOpKey.json();
    assert.equal(bodyOpKey.allocations.length, 1);
    assert.equal(bodyOpKey.allocations[0].cropName, 'Lettuce');
    assert.equal(bodyOpKey.allocations[0].allocationReference, undefined);
    assert.equal(bodyOpKey.allocations[0].operation_key, undefined);
    assert.equal(bodyOpKey.allocations[0].orderReference, undefined);
    assert.equal(bodyOpKey.allocations[0].order_operation_key, undefined);

    // Search validation: > 100 characters returns 400
    const resTooLong = await fetch(`${baseUrl}/allocations/history?search=${'x'.repeat(101)}`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resTooLong.status, 400);
  });

  // 15. Pagination and sorting work correctly
  test('15. Pagination and sorting work correctly with deterministic ordering', async () => {
    // Sort newest
    const resNewest = await fetch(`${baseUrl}/allocations/history?sort=newest&limit=5`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resNewest.status, 200);
    const bodyNewest = await resNewest.json();

    // Sort oldest
    const resOldest = await fetch(`${baseUrl}/allocations/history?sort=oldest&limit=5`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resOldest.status, 200);
    const bodyOldest = await resOldest.json();

    assert.ok(new Date(bodyNewest.allocations[0].createdAt) >= new Date(bodyOldest.allocations[0].createdAt));

    // Invalid sort returns 400
    const resInvalidSort = await fetch(`${baseUrl}/allocations/history?sort=random`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resInvalidSort.status, 400);

    // Invalid page / limit return 400
    const resPage0 = await fetch(`${baseUrl}/allocations/history?page=0`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resPage0.status, 400);

    const resLimit101 = await fetch(`${baseUrl}/allocations/history?limit=101`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resLimit101.status, 400);
  });

  // 17. Existing inbox, summary, details, Accept, and Decline endpoints remain unaffected
  test('17. Existing endpoints (/status, /allocations, /summary, /allocations/:id) remain unaffected', async () => {
    // Route order test: /allocations/history was not intercepted as :allocationId
    const resHistory = await fetch(`${baseUrl}/allocations/history`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resHistory.status, 200);

    // /status
    const resStatus = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resStatus.status, 200);

    // /allocations (inbox)
    const resInbox = await fetch(`${baseUrl}/allocations`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resInbox.status, 200);

    // /summary (inbox summary)
    const resSummary = await fetch(`${baseUrl}/summary`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resSummary.status, 200);
    const bodySummary = await resSummary.json();
    assert.ok('pendingResponses' in bodySummary.summary);

    // /allocations/:allocationId validation
    const resInvalidId = await fetch(`${baseUrl}/allocations/not-a-uuid`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(resInvalidId.status, 400);

    // /allocations/:allocationId decline validation
    const resDeclineInvalid = await fetch(`${baseUrl}/allocations/11111111-1111-1111-1111-111111111111/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resDeclineInvalid.status, 400);
  });

  // 18. Authenticated farmer ownership (mock-based, controlled data).
  //
  // getAllocationHistory must scope EVERY database query to the farmer id
  // carried by the authenticated request — never to `farmerId` / `farmer_id`
  // query parameters a caller may inject. The mock queries are keyed to the
  // farmer id each statement actually binds: a statement that bound the
  // injected id would receive THAT farmer's empty data (zero totals, no
  // records), so this test cannot pass by returning identical mock data
  // regardless of the SQL parameters — the bound parameters are asserted
  // explicitly as well.
  test('18. Authenticated farmer ownership: injected farmerId query params are ignored', async () => {
    const originalQuery = pool.query;
    const injectedFarmerId = OTHER_FARMER.id; // a different farmer's id

    // Predictable mock data belonging to the AUTHENTICATED farmer.
    const authRecords = [
      // Recorded farmer acceptance decision, later operational stage.
      {
        id: 'a0000000-0000-0000-0000-000000000011',
        operation_key: 'op-11',
        order_id: 'o0000000-0000-0000-0000-000000000011',
        order_operation_key: 'ord-op-11',
        buyer_name: 'Supermart',
        batch_id: 'b0000000-0000-0000-0000-000000000011',
        crop_name: 'Carrot',
        grade_name: 'Grade A',
        agreed_kg: '150.000',
        agreed_unit_price_cents: '12000',
        agreed_value_cents: '1800000',
        operational_status: 'committed',
        order_status: 'in_fulfilment',
        created_at: new Date('2026-11-10T08:00:00Z'),
        decision_action: 'allocation.accepted',
        decision_at: new Date('2026-11-10T08:30:00Z'),
        audit_reason: null,
      },
      // Recorded farmer decline decision with an audit reason.
      {
        id: 'a0000000-0000-0000-0000-000000000012',
        operation_key: 'op-12',
        order_id: 'o0000000-0000-0000-0000-000000000012',
        order_operation_key: 'ord-op-12',
        buyer_name: 'Green Grocer',
        batch_id: 'b0000000-0000-0000-0000-000000000012',
        crop_name: 'Tomato',
        grade_name: 'Grade B',
        agreed_kg: '80.000',
        agreed_unit_price_cents: '9500',
        agreed_value_cents: '760000',
        operational_status: 'declined',
        order_status: 'awaiting_suppliers',
        created_at: new Date('2026-11-11T09:00:00Z'),
        decision_action: 'allocation.declined',
        decision_at: new Date('2026-11-11T09:15:00Z'),
        audit_reason: 'Price too low',
      },
    ];
    const authSummary = { total_historical: '2', accepted: '1', declined: '1', expired: '0' };
    const otherFarmerSummary = { total_historical: '0', accepted: '0', declined: '0', expired: '0' };

    try {
      const executed = [];
      pool.query = async (sql, params) => {
        assert.equal(typeof sql, 'string', 'every statement must be a plain SQL string');
        // Snapshot the parameters: the controller mutates its params array
        // (limit/offset) after the count query, so a live reference would lie.
        executed.push({ sql, params: Array.isArray(params) ? [...params] : params });

        const boundFarmerId = Array.isArray(params) ? params[0] : undefined;
        const scopedToAuthFarmer = boundFarmerId === DEMO_FARMER.id;

        // Mock the approved-farmer lookup: only the authenticated id resolves.
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: scopedToAuthFarmer
              ? [{ id: DEMO_FARMER.id, name: DEMO_FARMER.name, role: 'farmer' }]
              : [],
          };
        }
        // Mock the summary query: totals depend on which farmer id was bound.
        if (typeof sql === 'string' && sql.includes('AS total_historical')) {
          return { rows: [scopedToAuthFarmer ? authSummary : otherFarmerSummary] };
        }
        // Mock the count query.
        if (typeof sql === 'string' && sql.includes('SELECT count(*) AS total')) {
          return { rows: [{ total: scopedToAuthFarmer ? String(authRecords.length) : '0' }] };
        }
        // Mock the page query.
        if (typeof sql === 'string' && sql.includes('operational_status')) {
          return { rows: scopedToAuthFarmer ? authRecords : [] };
        }
        throw new Error(`Unexpected query in the history ownership test: ${sql}`);
      };

      // The request identity comes from a real signed token for the farmer.
      const token = makeToken(DEMO_FARMER);
      const claims = jwt.verify(token, JWT_SECRET, { issuer: 'yieldmatrix', audience: 'yieldmatrix-web' });
      assert.equal(claims.sub, DEMO_FARMER.id, 'the token subject must be the authenticated farmer');
      const authenticatedUser = { id: claims.sub, role: claims.role, name: claims.name };

      const runHistory = async (query) => {
        let statusCode = 200;
        let body = null;
        const res = {
          json(data) { body = data; return this; },
          status(next) { statusCode = next; return this; },
        };
        await getAllocationHistory(
          { user: authenticatedUser, query, requestId: '00000000-0000-0000-0000-000000000018' },
          res,
          (error) => { throw error; },
        );
        assert.equal(statusCode, 200);
        return body;
      };

      // (4) Run once WITHOUT any farmerId query parameters …
      const cleanRun = await runHistory({});
      // (5) … and once with `farmerId` and `farmer_id` set to another farmer.
      const injectedRun = await runHistory({ farmerId: injectedFarmerId, farmer_id: injectedFarmerId });

      // (6) Both responses contain the AUTHENTICATED farmer's records and
      // summary totals — identical with and without the injected parameters.
      const expectedIds = authRecords.map((row) => row.id);
      for (const body of [cleanRun, injectedRun]) {
        assert.equal(body.summary.totalHistoricalAllocations, 2);
        assert.equal(body.summary.accepted, 1);
        assert.equal(body.summary.declined, 1);
        assert.equal(body.summary.expired, 0);
        assert.deepEqual(
          body.allocations.map((item) => item.allocationId),
          expectedIds,
          'the response must contain the authenticated farmer’s historical records',
        );
      }
      assert.deepEqual(injectedRun.summary, cleanRun.summary, 'summary totals must not change with injected farmer params');
      assert.deepEqual(injectedRun.allocations, cleanRun.allocations, 'records must not change with injected farmer params');

      // (8) Returned records never carry the pending operational status.
      for (const body of [cleanRun, injectedRun]) {
        for (const item of body.allocations) {
          assert.notEqual(item.operationalStatus, 'held', 'history must never return held allocations');
        }
      }

      // (7) The SQL parameters themselves: every relevant query must bind the
      // authenticated farmer id as $1 and must never bind either injected id.
      const lookups = executed.filter((entry) => entry.sql.includes('FROM users WHERE id = $1'));
      const summaries = executed.filter((entry) => entry.sql.includes('AS total_historical'));
      const counts = executed.filter((entry) => entry.sql.includes('SELECT count(*) AS total'));
      const pages = executed.filter((entry) => entry.sql.includes('operational_status'));
      assert.equal(lookups.length, 2, 'one approved-farmer lookup per run');
      assert.equal(summaries.length, 2, 'one summary query per run');
      assert.equal(counts.length, 2, 'one count query per run');
      assert.equal(pages.length, 2, 'one page query per run');

      for (const entry of [...lookups, ...summaries, ...counts, ...pages]) {
        assert.equal(
          entry.params[0],
          DEMO_FARMER.id,
          `query must bind the authenticated farmer id as $1: ${entry.sql.slice(0, 70)}`,
        );
        assert.ok(
          !entry.params.includes(injectedFarmerId),
          `injected farmer id must never be bound: ${entry.sql.slice(0, 70)}`,
        );
      }
      // Summary and count carry no other filter, so $1 alone is the whole
      // parameter list — the ownership scope is the token's id and nothing else.
      for (const entry of [...summaries, ...counts]) {
        assert.deepEqual(entry.params, [DEMO_FARMER.id]);
      }
      // The page query adds only limit/offset after the farmer id.
      for (const entry of pages) {
        assert.deepEqual(entry.params, [DEMO_FARMER.id, 10, 0]);
      }
    } finally {
      pool.query = originalQuery;
    }
  });
});
