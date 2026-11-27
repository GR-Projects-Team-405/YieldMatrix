-- =============================================================================
-- YM17 QA SEED · Sri Lankan local test data — Farmer Allocation Inbox
-- =============================================================================
-- FILE: backend/database/ym17_test_seed.sql
--
-- DISPOSABLE LOCAL / TEST DATABASE ONLY.
--   * NEVER run this against shared Neon or any shared environment.
--   * Run it manually, once, in this order, on a local database that was
--     created from schema.sql and then seed.sql:
--         1) backend/database/schema.sql
--         2) backend/database/seed.sql
--         3) backend/database/ym17_test_seed.sql   (this file)
--     Example (local only):  psql "$LOCAL_DATABASE_URL" -f backend/database/ym17_test_seed.sql
--   * Never wire this script into application code, CI or a migration runner.
--   * It does NOT modify schema.sql, seed.sql, application source,
--     allocations.test.js, history.test.js, or any existing record other than
--     the two optional demo display names in section 1.
--
-- WHAT IT CREATES
--   users           : optional name-only relabel (Saman Perera / Nimali
--                     Fernando). IDs, emails, roles, approval_status,
--                     password_hash, phone, district, session_version,
--                     preferences and timestamps are all untouched.
--   farms           : reuses Green Valley Farm (f1111111-...); nothing created.
--   crops / grades  : reuses the seeded Tomato, Carrot, Cabbage, Potato,
--                     Beans and Grade A; nothing created.
--   harvest_batches : 5 new batches — planned/actual/sellable = 50 kg,
--                     status 'harvested', dates CURRENT_DATE - 1.
--   orders          : 5 new orders — demo buyer, Sri Lankan destination,
--                     delivery_date CURRENT_DATE + 2, demand_id NULL.
--   allocations     : 5 new rows, EVERY ONE inserted as status = 'held'.
--   reservations    : 4 new rows, EVERY ONE inserted as status = 'active'
--                     (QA-NO-RESERVATION deliberately has NO reservation row).
--   audit_logs      : NEVER written here. Acceptance and decline are produced
--                     only through the real APIs
--                     (POST /api/ym17/allocations/:id/accept and /decline).
--   wallets / journal / trace / notifications : untouched.
--
-- MONEY: LKR -> integer cents (LKR 250 = 25000 cents). allocations.agreed_value_cents
-- is GENERATED ALWAYS AS (round(agreed_kg * agreed_unit_price_cents)) — it is
-- deliberately absent from the INSERT list and is never supplied by hand.
--
-- IDEMPOTENT: every row uses a fixed UUID plus ON CONFLICT (id) DO NOTHING, so
-- re-running the script never clobbers a record that has already been exercised
-- through the APIs (e.g. an allocation already moved to supplier_accepted).
-- =============================================================================

BEGIN;
SET TIME ZONE 'UTC';

-- -----------------------------------------------------------------------------
-- 0 (prerequisites). Fail loudly if schema.sql / seed.sql were not run first.
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_missing TEXT := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
     WHERE id = '11111111-1111-1111-1111-111111111111'
       AND role = 'farmer' AND approval_status = 'approved'
  ) THEN v_missing := v_missing || ' demo-farmer'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users
     WHERE id = '22222222-2222-2222-2222-222222222222'
       AND role = 'buyer' AND approval_status = 'approved'
  ) THEN v_missing := v_missing || ' demo-buyer'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM farms
     WHERE id = 'f1111111-1111-1111-1111-111111111111'
       AND farmer_id = '11111111-1111-1111-1111-111111111111'
  ) THEN v_missing := v_missing || ' green-valley-farm'; END IF;

  IF (SELECT count(*) FROM crops
       WHERE name IN ('Tomato','Carrot','Cabbage','Potato','Beans')) <> 5
  THEN v_missing := v_missing || ' seeded-crops'; END IF;

  IF NOT EXISTS (SELECT 1 FROM grades WHERE name = 'Grade A')
  THEN v_missing := v_missing || ' grade-a'; END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'YM17 QA seed prerequisites missing:% — run schema.sql then seed.sql first (disposable local database only).', v_missing;
  END IF;

  RAISE NOTICE 'YM17 QA prerequisites OK: demo farmer, demo buyer, Green Valley Farm, 5 crops, Grade A.';
END $$;

-- -----------------------------------------------------------------------------
-- 1 (test identities). OPTIONAL local relabel: ONLY users.name is written.
--    IDs, emails, roles, approval_status, password_hash, phone, district,
--    session_version, preferences and created/updated timestamps are untouched,
--    and no user, wallet or credential is created.
--    NOTE: re-running seed.sql afterwards resets these two labels.
-- -----------------------------------------------------------------------------
UPDATE users
   SET name = 'Saman Perera'
 WHERE id = '11111111-1111-1111-1111-111111111111'
   AND role = 'farmer' AND approval_status = 'approved';

UPDATE users
   SET name = 'Nimali Fernando'
 WHERE id = '22222222-2222-2222-2222-222222222222'
   AND role = 'buyer' AND approval_status = 'approved';

-- -----------------------------------------------------------------------------
-- 2 (exact test data). One row per QA scenario. The batch/order/allocation/
--    reservation UUIDs are fixed so the script is re-runnable and so the
--    verification queries at the bottom can address each scenario precisely.
--    created_offset        = how far back allocations.created_at is backdated
--                            (QA-EXPIRED only).
--    hold_expires_offset   = reservation.expires_at relative to now();
--                            NULL means "no reservation row at all".
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE ym17_qa_scenarios (
  test_key             TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL,     -- operation-key fragment: pending, accept, ...
  batch_id             UUID NOT NULL,
  order_id             UUID NOT NULL,
  allocation_id        UUID NOT NULL,
  reservation_id       UUID,             -- NULL => QA-NO-RESERVATION
  crop_name            TEXT NOT NULL,
  agreed_kg            NUMERIC(12,3) NOT NULL CHECK (agreed_kg > 0),
  unit_price_cents     BIGINT NOT NULL CHECK (unit_price_cents > 0),
  destination          TEXT NOT NULL,
  district             TEXT NOT NULL,
  created_offset       INTERVAL NOT NULL DEFAULT INTERVAL '0',
  hold_expires_offset  INTERVAL          -- NULL => no reservation row
) ON COMMIT DROP;

INSERT INTO ym17_qa_scenarios
  (test_key, slug, batch_id, order_id, allocation_id, reservation_id,
   crop_name, agreed_kg, unit_price_cents, destination, district,
   created_offset, hold_expires_offset)
VALUES
  ('QA-PENDING', 'pending',
   'e1700000-0000-4000-a000-000000000001',
   'e1700000-0000-4000-a000-000000000101',
   'e1700000-0000-4000-a000-000000000201',
   'e1700000-0000-4000-a000-000000000301',
   'Tomato', 10, 25000, 'Negombo Central Market', 'Gampaha',
   INTERVAL '0', INTERVAL '30 minutes'),

  ('QA-ACCEPT', 'accept',
   'e1700000-0000-4000-a000-000000000002',
   'e1700000-0000-4000-a000-000000000102',
   'e1700000-0000-4000-a000-000000000202',
   'e1700000-0000-4000-a000-000000000302',
   'Carrot', 8, 32000, 'Colombo Manning Market', 'Colombo',
   INTERVAL '0', INTERVAL '30 minutes'),

  ('QA-DECLINE', 'decline',
   'e1700000-0000-4000-a000-000000000003',
   'e1700000-0000-4000-a000-000000000103',
   'e1700000-0000-4000-a000-000000000203',
   'e1700000-0000-4000-a000-000000000303',
   'Cabbage', 12, 18000, 'Ja-Ela Town Market', 'Gampaha',
   INTERVAL '0', INTERVAL '30 minutes'),

  ('QA-EXPIRED', 'expired',
   'e1700000-0000-4000-a000-000000000004',
   'e1700000-0000-4000-a000-000000000104',
   'e1700000-0000-4000-a000-000000000204',
   'e1700000-0000-4000-a000-000000000304',
   'Potato', 10, 22000, 'Wattala Market', 'Gampaha',
   INTERVAL '30 minutes', INTERVAL '-10 minutes'),

  ('QA-NO-RESERVATION', 'no-reservation',
   'e1700000-0000-4000-a000-000000000005',
   'e1700000-0000-4000-a000-000000000105',
   'e1700000-0000-4000-a000-000000000205',
   NULL,                                     -- no reservation is created
   'Beans', 5, 40000, 'Gampaha Market', 'Gampaha',
   INTERVAL '0', NULL);

-- -----------------------------------------------------------------------------
-- 3 (harvest batches). One per scenario: existing crop + Grade A, existing
--    demo farmer + Green Valley Farm, 50/50/50 kg, harvested yesterday.
--    Schema notes verified:
--      * FOREIGN KEY (farm_id, farmer_id) REFERENCES farms(id, farmer_id)
--      * CHECK (sellable_kg <= COALESCE(actual_kg, 0))  -> 50 <= 50 OK
--      * status 'harvested' is allowed by the CHECK, and harvest_batches has
--        no workflow_transition trigger (only the deferred stock_available one)
--      * public_trace_token / revision / created_at take their defaults
-- -----------------------------------------------------------------------------
INSERT INTO harvest_batches
  (id, farm_id, farmer_id, crop_id, grade_id,
   planned_kg, actual_kg, sellable_kg,
   planned_harvest_date, actual_harvest_date, status)
SELECT s.batch_id,
       'f1111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       c.id,
       g.id,
       50, 50, 50,
       CURRENT_DATE - 1, CURRENT_DATE - 1, 'harvested'
  FROM ym17_qa_scenarios s
  JOIN crops  c ON c.name  = s.crop_name
  JOIN grades g ON g.name  = 'Grade A'
 ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4 (orders). One per scenario. demand_id stays NULL (the column is nullable
--    and no demand is invented). agreed_total_cents keeps its DEFAULT 0 — YM17
--    never reads it. STATUS: the workflow_transition trigger allows only
--    'draft' on INSERT, so every order is inserted as 'draft' and then promoted
--    to 'awaiting_suppliers' (a legal draft -> awaiting_suppliers transition in
--    schema.sql) to reflect allocations that are genuinely awaiting the
--    supplier's response.
-- -----------------------------------------------------------------------------
INSERT INTO orders
  (id, buyer_id, demand_id, destination, destination_district,
   delivery_date, status, operation_key)
SELECT s.order_id,
       '22222222-2222-2222-2222-222222222222',
       NULL,
       s.destination,
       s.district,
       CURRENT_DATE + 2,
       'draft',
       'ym17-qa-order-' || s.slug || ':v1'
  FROM ym17_qa_scenarios s
 ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5 (allocations). EVERY row starts as status = 'held' (the workflow trigger
--    rejects any other initial state). committed/picked_up/handed_over/
--    accepted kg and funded/settled/refunded/held cents all keep their 0
--    defaults, so the CHECK (funded = settled + refunded + held) holds and
--    funded (0) <= agreed_value_cents holds.
--    agreed_value_cents is a GENERATED column and is never listed here:
--      Tomato  10 x 25000 = 250000 | Carrot  8 x 32000 = 256000
--      Cabbage 12 x 18000 = 216000 | Potato 10 x 22000 = 220000
--      Beans    5 x 40000 = 200000   (LKR 2,500 / 2,560 / 2,160 / 2,200 / 2,000)
--    QA-EXPIRED gets created_at = now() - 30 minutes; all others use now().
--    No audit event is written (audit_logs is append-only and API-owned).
-- -----------------------------------------------------------------------------
INSERT INTO allocations
  (id, order_id, batch_id, farmer_id,
   agreed_kg, agreed_unit_price_cents,
   status, operation_key, created_at)
SELECT s.allocation_id,
       s.order_id,
       s.batch_id,
       '11111111-1111-1111-1111-111111111111',
       s.agreed_kg,
       s.unit_price_cents,
       'held',
       'ym17-qa-alloc-' || s.slug || ':v1',
       now() - s.created_offset
  FROM ym17_qa_scenarios s
 ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6 (reservations). EVERY reservation is inserted status = 'active' with
--    terminal_at NULL — the schema CHECK requires exactly that pairing, and
--    the workflow trigger rejects any other initial state.
--    held_kg = the allocation's agreed_kg, so stock stays covered.
--
--    IMPORTANT: reservations CHECK (expires_at > created_at). QA-EXPIRED
--    therefore backdates created_at by 30 minutes as well, otherwise
--    expires_at (now() - 10 minutes) would violate the CHECK.
--
--    QA-NO-RESERVATION is intentionally skipped: it must have NO reservation
--    row at all, and must never be dressed up as an 'expired' hold.
-- -----------------------------------------------------------------------------
INSERT INTO reservations
  (id, allocation_id, held_kg, status, operation_key,
   created_at, expires_at, terminal_at)
SELECT s.reservation_id,
       s.allocation_id,
       s.agreed_kg,
       'active',
       'ym17-qa-resv-' || s.slug || ':v1',
       now() - s.created_offset,
       now() + s.hold_expires_offset,
       NULL
  FROM ym17_qa_scenarios s
 WHERE s.reservation_id IS NOT NULL
 ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7 (order promotion). draft -> awaiting_suppliers, legal per the workflow
--    transition map. Deferred order_has_allocations is satisfied at COMMIT
--    because every order already has exactly one allocation.
-- -----------------------------------------------------------------------------
UPDATE orders o
   SET status = 'awaiting_suppliers', updated_at = now()
  FROM ym17_qa_scenarios s
 WHERE o.id = s.order_id
   AND o.status = 'draft';

-- -----------------------------------------------------------------------------
-- 8 (self-check). Raises -> ROLLBACK, so a broken seed never half-commits.
--    Counts are unconditional; the pristine-state checks only run while no QA
--    allocation has been exercised through the APIs yet, which keeps a second
--    run a harmless no-op instead of a false alarm.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_bad       TEXT := '';
  v_exercised INT := 0;
BEGIN
  IF (SELECT count(*) FROM harvest_batches
       WHERE id::text LIKE 'e1700000-0000-4000-a000-%') <> 5
  THEN v_bad := v_bad || ' batches(5)'; END IF;

  IF (SELECT count(*) FROM orders
       WHERE operation_key LIKE 'ym17-qa-order-%') <> 5
  THEN v_bad := v_bad || ' orders(5)'; END IF;

  IF (SELECT count(*) FROM allocations
       WHERE operation_key LIKE 'ym17-qa-alloc-%') <> 5
  THEN v_bad := v_bad || ' allocations(5)'; END IF;

  IF (SELECT count(*) FROM reservations
       WHERE operation_key LIKE 'ym17-qa-resv-%') <> 4
  THEN v_bad := v_bad || ' reservations(4)'; END IF;

  IF EXISTS (
    SELECT 1 FROM batch_availability
     WHERE batch_id::text LIKE 'e1700000-0000-4000-a000-%'
       AND available_kg < 0
  ) THEN v_bad := v_bad || ' negative-availability'; END IF;

  SELECT count(*) INTO v_exercised
    FROM allocations
   WHERE operation_key LIKE 'ym17-qa-alloc-%'
     AND status <> 'held';

  IF v_exercised = 0 THEN
    -- Fresh seed: everything must still be untouched by the APIs.
    IF EXISTS (
      SELECT 1 FROM allocations
       WHERE operation_key LIKE 'ym17-qa-alloc-%'
         AND decision_reason IS NOT NULL
    ) THEN v_bad := v_bad || ' stale-decision-reason'; END IF;

    IF (SELECT count(*) FROM orders
         WHERE operation_key LIKE 'ym17-qa-order-%'
           AND status = 'awaiting_suppliers') <> 5
    THEN v_bad := v_bad || ' orders-not-awaiting-suppliers'; END IF;

    IF (SELECT count(*) FROM reservations
         WHERE operation_key LIKE 'ym17-qa-resv-%'
           AND status = 'active'
           AND terminal_at IS NULL) <> 4
    THEN v_bad := v_bad || ' reservations-not-active'; END IF;

    IF (SELECT count(*) FROM allocations
         WHERE operation_key LIKE 'ym17-qa-alloc-%'
           AND status = 'held') <> 5
    THEN v_bad := v_bad || ' allocations-not-held'; END IF;
  ELSE
    RAISE NOTICE 'YM17 QA seed re-run: % QA allocation(s) already exercised through the APIs; pristine-state checks skipped.', v_exercised;
  END IF;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'YM17 QA seed self-check failed:% — nothing was committed.', v_bad;
  END IF;

  RAISE NOTICE 'YM17 QA seed self-check OK: 5 QA allocations, 4 active reservations, availability >= 0.';
END $$;

COMMIT;
-- The temp staging table is dropped automatically (ON COMMIT DROP).


-- =============================================================================
-- VERIFICATION QUERIES (read-only; run after COMMIT)
-- =============================================================================
-- Time window: QA-PENDING / QA-ACCEPT / QA-DECLINE holds expire 30 minutes
-- after the seed runs. Exercise the Accept / Decline APIs inside that window,
-- otherwise they answer 409 "The reservation for this allocation has expired".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- V1 · Scenario state: actual vs expected, one row per scenario.
--      Every "ok_*" column must be true.
--      ok_allocation_status / ok_can_respond describe the PRISTINE state (right
--      after seeding); they only turn false once the Accept / Decline APIs have
--      legitimately moved those rows — re-check them against the table above.
--      Expected canRespond (a.status='held' AND r.status='active' AND
--      r.expires_at > now()) straight after seeding:
--        QA-PENDING         true   reason NULL
--        QA-ACCEPT          true   reason NULL   (false once Accept API ran)
--        QA-DECLINE         true   reason NULL   (false once Decline API ran)
--        QA-EXPIRED         false  'The reservation for this allocation has expired.'
--        QA-NO-RESERVATION  false  'No reservation is attached to this allocation.'
-- -----------------------------------------------------------------------------
WITH expected (test_key, allocation_id, crop_name, agreed_kg, unit_price_cents,
               agreed_value_cents, destination, district,
               allocation_status, reservation_status, can_respond) AS (
  VALUES
    ('QA-PENDING',        'e1700000-0000-4000-a000-000000000201'::uuid, 'Tomato',  10, 25000, 250000, 'Negombo Central Market', 'Gampaha', 'held', 'active',  true),
    ('QA-ACCEPT',         'e1700000-0000-4000-a000-000000000202'::uuid, 'Carrot',   8, 32000, 256000, 'Colombo Manning Market', 'Colombo', 'held', 'active',  true),
    ('QA-DECLINE',        'e1700000-0000-4000-a000-000000000203'::uuid, 'Cabbage', 12, 18000, 216000, 'Ja-Ela Town Market',     'Gampaha', 'held', 'active',  true),
    ('QA-EXPIRED',        'e1700000-0000-4000-a000-000000000204'::uuid, 'Potato',  10, 22000, 220000, 'Wattala Market',         'Gampaha', 'held', 'active',  false),
    ('QA-NO-RESERVATION', 'e1700000-0000-4000-a000-000000000205'::uuid, 'Beans',    5, 40000, 200000, 'Gampaha Market',         'Gampaha', 'held', NULL,     false)
)
SELECT e.test_key,
       c.name                                   AS crop,
       a.agreed_kg,
       a.agreed_unit_price_cents                AS unit_price_cents,
       a.agreed_value_cents                     AS agreed_value_cents,   -- generated, never inserted
       o.destination,
       o.destination_district,
       o.status                                 AS order_status,
       a.status                                 AS allocation_status,
       r.status                                 AS reservation_status,
       r.expires_at                             AS reservation_expires_at,
       r.terminal_at                            AS reservation_terminal_at,
       (a.status = 'held' AND r.status = 'active' AND r.expires_at > now()) AS can_respond,
       CASE
         WHEN a.status <> 'held'
           THEN 'This allocation is no longer awaiting your response (status: ' || a.status || ').'
         WHEN r.status IS NULL OR r.expires_at IS NULL
           THEN 'No reservation is attached to this allocation.'
         WHEN r.status <> 'active'
           THEN 'The reservation for this allocation is ' || r.status || '.'
         WHEN r.expires_at <= now()
           THEN 'The reservation for this allocation has expired.'
         ELSE NULL
       END                                      AS response_unavailable_reason,
       (c.name = e.crop_name)                   AS ok_crop,
       (g.name = 'Grade A')                     AS ok_grade,
       (a.agreed_kg = e.agreed_kg
         AND a.agreed_unit_price_cents = e.unit_price_cents
         AND a.agreed_value_cents = e.agreed_value_cents) AS ok_money,
       (o.destination = e.destination
         AND o.destination_district = e.district)          AS ok_destination,
       (a.status = e.allocation_status)         AS ok_allocation_status,
       (r.status IS NOT DISTINCT FROM e.reservation_status) AS ok_reservation_status,
       ((a.status = 'held' AND r.status = 'active' AND r.expires_at > now()) = e.can_respond) AS ok_can_respond
  FROM expected e
  LEFT JOIN allocations a ON a.id = e.allocation_id
  LEFT JOIN orders      o ON o.id = a.order_id
  LEFT JOIN harvest_batches hb ON hb.id = a.batch_id
  LEFT JOIN crops          c ON c.id  = hb.crop_id
  LEFT JOIN grades         g ON g.id  = hb.grade_id
  LEFT JOIN LATERAL (
        SELECT rr.status, rr.expires_at, rr.terminal_at
          FROM reservations rr
         WHERE rr.allocation_id = a.id
         ORDER BY (rr.status = 'active') DESC, rr.created_at DESC
         LIMIT 1
      ) r ON true
 ORDER BY e.test_key;

-- Expected right after seeding (fresh database):
--   QA-PENDING         held   active  +30 min  can_respond=true
--   QA-ACCEPT          held   active  +30 min  can_respond=true
--   QA-DECLINE         held   active  +30 min  can_respond=true
--   QA-EXPIRED         held   active  -10 min  can_respond=false  (reason: expired)
--   QA-NO-RESERVATION  held   NULL             can_respond=false  (reason: no reservation)
--   All ok_* columns true.


-- -----------------------------------------------------------------------------
-- V2 · Expected batch availability (batch_availability view).
--      Every QA batch carries 50 kg sellable; an active hold deducts its kg.
--      Expected immediately after seeding:
--        Beans    sellable 50  held  0  available 50
--        Cabbage  sellable 50  held 12  available 38   (50 after Decline API)
--        Carrot   sellable 50  held  8  available 42
--        Potato   sellable 50  held 10  available 40
--        Tomato   sellable 50  held 10  available 40
--      Accept API does not change availability (the hold is preserved);
--      Decline API releases the hold, so that batch returns to 50 available.
-- -----------------------------------------------------------------------------
SELECT c.name                       AS crop,
       b.status                     AS batch_status,
       b.planned_kg, b.actual_kg, b.sellable_kg,
       v.held_kg,
       v.uncollected_kg,
       v.available_kg
  FROM batch_availability v
  JOIN harvest_batches b ON b.id = v.batch_id
  JOIN crops          c ON c.id  = b.crop_id
 WHERE b.id::text LIKE 'e1700000-0000-4000-a000-%'
 ORDER BY c.name;


-- -----------------------------------------------------------------------------
-- V3 · Inbox tab + summary-card expectations for the five QA rows only.
--      (Mirrors GET /api/ym17/allocations filters and GET /summary exactly.)
--      Expected straight after seeding:
--        tab_all 5 | tab_awaiting_response 3 | tab_expired 1
--        tab_declined 0 | tab_accepted_audit_backed 0
--        summary: pending_responses 3, expiring_soon 0,
--                 accepted_allocations 0, declined_allocations 0
--      After POST .../accept on QA-ACCEPT:
--        tab_awaiting_response 2 | tab_accepted_audit_backed 1
--        summary: pending_responses 2, accepted_allocations 1
--      After POST .../decline on QA-DECLINE (with a valid reason):
--        tab_awaiting_response 1 | tab_declined 1
--        summary: pending_responses 1, declined_allocations 1
--      QA-NO-RESERVATION is counted in All only: it is neither pending
--      (no hold) nor expired (no hold was ever invented for it).
-- -----------------------------------------------------------------------------
WITH qa AS (
  SELECT a.id,
         a.status,
         (SELECT al.action
            FROM audit_logs al
           WHERE al.target_type = 'allocation'
             AND al.target_id = a.id
             AND al.action IN ('allocation.accepted', 'allocation.declined')
           ORDER BY al.occurred_at ASC, al.id ASC
           LIMIT 1) AS first_decision_action
    FROM allocations a
   WHERE a.operation_key LIKE 'ym17-qa-alloc-%'
)
SELECT (SELECT count(*) FROM qa) AS tab_all,
       count(*) FILTER (WHERE qa.status = 'held'
                          AND r.expires_at IS NOT NULL
                          AND r.expires_at > now())            AS tab_awaiting_response,
       count(*) FILTER (WHERE qa.status = 'expired'
                          OR (qa.status = 'held'
                              AND r.status IS NOT NULL
                              AND (r.status IS DISTINCT FROM 'active'
                                   OR r.expires_at <= now()))) AS tab_expired,
       count(*) FILTER (WHERE qa.status = 'declined')          AS tab_declined,
       count(*) FILTER (WHERE qa.first_decision_action = 'allocation.accepted') AS tab_accepted_audit_backed,
       count(*) FILTER (WHERE qa.status = 'held'
                          AND r.expires_at IS NOT NULL
                          AND r.expires_at > now())            AS summary_pending_responses,
       count(*) FILTER (WHERE qa.status = 'held'
                          AND r.expires_at IS NOT NULL
                          AND r.expires_at > now()
                          AND r.expires_at <= now() + make_interval(mins => 10)) AS summary_expiring_soon,
       count(*) FILTER (WHERE qa.status IN ('supplier_accepted','committed','picked_up',
                                            'handed_over','accepted','partially_accepted')) AS summary_accepted_allocations,
       count(*) FILTER (WHERE qa.status = 'declined')          AS summary_declined_allocations
  FROM qa
  LEFT JOIN LATERAL (
        SELECT rr.status, rr.expires_at
          FROM reservations rr
         WHERE rr.allocation_id = qa.id
         ORDER BY (rr.status = 'active') DESC, rr.created_at DESC
         LIMIT 1
      ) r ON true;


-- -----------------------------------------------------------------------------
-- V4 · No fabricated decisions. audit_logs is append-only and API-owned, so
--      this must be 0 immediately after seeding and only grow when the real
--      Accept / Decline endpoints are called.
-- -----------------------------------------------------------------------------
SELECT count(*) AS qa_audit_events
  FROM audit_logs al
  JOIN allocations a ON a.id = al.target_id
 WHERE a.operation_key LIKE 'ym17-qa-alloc-%';
-- Expected after seeding: 0


-- -----------------------------------------------------------------------------
-- V5 · Run AFTER exercising the APIs on QA-ACCEPT and QA-DECLINE.
--      Expected:
--        ym17-qa-alloc-accept:v1   supplier_accepted  decision_reason NULL
--                                  reservation active, terminal_at NULL
--                                  first event 'allocation.accepted'
--        ym17-qa-alloc-decline:v1  declined           decision_reason = your text
--                                  reservation released, terminal_at NOT NULL
--                                  first event 'allocation.declined'
-- -----------------------------------------------------------------------------
SELECT a.operation_key,
       a.status              AS allocation_status,
       a.decision_reason,
       r.status              AS reservation_status,
       r.terminal_at         AS reservation_terminal_at,
       (SELECT al.action
          FROM audit_logs al
         WHERE al.target_type = 'allocation'
           AND al.target_id = a.id
         ORDER BY al.occurred_at ASC, al.id ASC
         LIMIT 1)            AS first_decision_event
  FROM allocations a
  LEFT JOIN reservations r ON r.allocation_id = a.id
 WHERE a.operation_key IN ('ym17-qa-alloc-accept:v1', 'ym17-qa-alloc-decline:v1')
 ORDER BY a.operation_key;


-- =============================================================================
-- MANUAL QA FLOW (Allocation Inbox, logged in as the demo farmer)
-- =============================================================================
--  1. /farmer/allocations  -> All tab lists exactly 5 rows.
--  2. Awaiting Response     -> 3 rows (QA-PENDING, QA-ACCEPT, QA-DECLINE).
--  3. Accepted              -> empty state "No accepted allocations found."
--  4. Declined              -> empty state (0 rows).
--  5. Expired               -> 1 row (QA-EXPIRED): status still "held", hold
--                              shown as expired, canRespond false.
--  6. Beans (QA-NO-RESERVATION) appears ONLY under All: no hold, not pending,
--     not expired.
--  7. Summary cards: 3 pending responses, 0 expiring soon, 0 accepted,
--     0 declined (fresh database).
--  8. Open QA-ACCEPT  -> Accept (real API) -> supplier_accepted, hold stays
--                        active, row moves to the Accepted tab.
--  9. Open QA-DECLINE -> Decline (real API) with a 1..500 character reason ->
--                        declined, hold released, row moves to Declined tab.
-- 10. Search tip: the inbox search also matches operation keys, so typing
--     "ym17-qa" returns all five QA rows (operation keys are never displayed).
-- 11. Do all of this within 30 minutes of running the script, before the
--     live holds expire.
-- =============================================================================


-- =============================================================================
-- CLEANUP (disposable local/test database only — never Neon)
-- =============================================================================
-- PREFERRED: recreate the database instead of deleting anything.
--
--   psql -c "DROP DATABASE yieldmatrix_qa;" 
--   psql -c "CREATE DATABASE yieldmatrix_qa;"
--   psql -f backend/database/schema.sql
--   psql -f backend/database/seed.sql
--   psql -f backend/database/ym17_test_seed.sql
--
-- Recreating also clears the audit_logs rows written by the Accept/Decline
-- APIs: audit_logs is append-only (prevent_record_mutation trigger), so those
-- rows can never be UPDATEd or DELETEd by hand — and they must not be, they
-- are the evidence behind the audit-backed Accepted tab.
--
-- ---------------------------------------------------------------------------
-- FALLBACK: scoped removal of ONLY the rows this script created. Uncomment and
-- run as a single transaction. Nothing outside the ym17-qa- / e1700000- prefixes
-- is touched, and no existing record is deleted.
-- ---------------------------------------------------------------------------
-- BEGIN;
--   -- 1. order_has_allocations forbids a non-draft order from losing its last
--   --    allocation, and awaiting_suppliers -> expired is a legal transition
--   --    (awaiting_suppliers -> draft is NOT, so do not "reset" it to draft).
--   UPDATE orders
--      SET status = 'expired', updated_at = now()
--    WHERE operation_key LIKE 'ym17-qa-order-%'
--      AND status <> 'draft';
--
--   DELETE FROM reservations     WHERE operation_key LIKE 'ym17-qa-resv-%';   -- 4 rows
--   DELETE FROM allocations      WHERE operation_key LIKE 'ym17-qa-alloc-%';  -- 5 rows
--   DELETE FROM orders           WHERE operation_key LIKE 'ym17-qa-order-%';  -- 5 rows
--   DELETE FROM harvest_batches  WHERE id::text LIKE 'e1700000-0000-4000-a000-%'; -- 5 rows
--
--   -- 2. Optional: restore the original demo display names (name only).
--   UPDATE users SET name = 'Demo Farmer'
--    WHERE id = '11111111-1111-1111-1111-111111111111' AND role = 'farmer';
--   UPDATE users SET name = 'Demo Buyer'
--    WHERE id = '22222222-2222-2222-2222-222222222222' AND role = 'buyer';
-- COMMIT;
--
-- NOT removable by design (recreate the database instead):
--   * audit_logs rows written by the Accept / Decline APIs (append-only).
--     Harmless once the allocations are gone (target_id has no foreign key
--     and no allocation can match them any more), but they justify preferring
--     database recreation.
--   * Nothing else: this script writes no wallets, journal entries, trace
--     events, notifications, listings, demands or offers.
-- =============================================================================
