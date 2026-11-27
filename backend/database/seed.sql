-- Run after schema.sql manually in Neon SQL Editor. Safe to rerun: no balance reset.
-- These demo identities have no password login; the development endpoint issues JWTs.
-- All wallet funds are SIMULATED; no payment provider is contacted.
BEGIN;
SET TIME ZONE 'UTC';
INSERT INTO users (id, name, email, role, approval_status, district) VALUES
('11111111-1111-1111-1111-111111111111','Demo Farmer','demo.farmer@yieldmatrix.example','farmer','approved','Nuwara Eliya'),
('22222222-2222-2222-2222-222222222222','Demo Buyer','demo.buyer@yieldmatrix.example','buyer','approved','Colombo'),
('33333333-3333-3333-3333-333333333333','Demo Driver','demo.driver@yieldmatrix.example','driver','approved','Kandy'),
('44444444-4444-4444-4444-444444444444','Demo Admin','demo.admin@yieldmatrix.example','admin','approved','Colombo')
-- Refresh only demo identity labels on reruns; preserve roles, approval states and balances.
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

INSERT INTO wallets (id, owner_id, account_type) VALUES
('a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','farmer'),
('a2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','buyer'),
('a3333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','driver'),
('a4444444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','admin'),
('a0000000-0000-0000-0000-000000000000',NULL,'simulation_source')
ON CONFLICT DO NOTHING;

-- The source wallet is the balancing account for simulated funding, not another user.
-- Serialize reruns so the opening entry can never double-fund the demo buyer wallet.
DO $$
DECLARE new_entry UUID; buyer_wallet UUID; source_wallet UUID;
BEGIN
  SELECT id INTO STRICT buyer_wallet FROM wallets WHERE owner_id = '22222222-2222-2222-2222-222222222222' FOR UPDATE;
  SELECT id INTO STRICT source_wallet FROM wallets WHERE account_type = 'simulation_source';
  INSERT INTO wallet_journal_entries (id, event_type, event_reference, operation_key, amount_cents, actor_id)
  VALUES ('b2222222-2222-2222-2222-222222222222','funding','Demo opening funding - LKR 500,000.00','seed:buyer-opening-funding:v1',50000000,'44444444-4444-4444-4444-444444444444')
  ON CONFLICT (operation_key) DO NOTHING RETURNING id INTO new_entry;
  IF new_entry IS NOT NULL THEN
    INSERT INTO wallet_journal_lines (entry_id, wallet_id, bucket, side, amount_cents) VALUES
      (new_entry,source_wallet,'simulation_equity','debit',50000000),
      (new_entry,buyer_wallet,'available','credit',50000000);
    UPDATE wallets SET available_cents = available_cents + 50000000 WHERE id = buyer_wallet;
  END IF;
END $$;

INSERT INTO crops (name) VALUES ('Tomato'),('Carrot'),('Cabbage'),('Potato'),('Beans') ON CONFLICT (name) DO NOTHING;
INSERT INTO grades (name, description) VALUES ('Grade A','Grade A produce'),('Grade B','Grade B produce'),('Grade C','Grade C produce') ON CONFLICT (name) DO NOTHING;
INSERT INTO farms (id, farmer_id, name, district, pickup_address, latitude, longitude)
VALUES ('f1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Green Valley Farm','Nuwara Eliya','Demo pickup location, Nuwara Eliya',6.949700,80.789100)
ON CONFLICT (id) DO NOTHING;

-- YM25 demo traceability records. All identifiers and trace events are local demo data.
INSERT INTO crops (name) VALUES ('Lettuce'),('Spinach') ON CONFLICT (name) DO NOTHING;
INSERT INTO farms (id, farmer_id, name, district, pickup_address, latitude, longitude) VALUES
('f2222222-2222-4222-8222-222222222222','11111111-1111-1111-1111-111111111111','Highland Harvest','Kandy','Demo pickup location, Kandy',7.290600,80.633700),
('f3333333-3333-4333-8333-333333333333','11111111-1111-1111-1111-111111111111','Sunrise Organics','Colombo','Demo pickup location, Colombo',6.927100,79.861200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO harvest_batches (
  id, farm_id, farmer_id, crop_id, grade_id, planned_kg, actual_kg, sellable_kg,
  planned_harvest_date, actual_harvest_date, status
) VALUES
(
  'b0010000-0000-4000-8000-000000000001',
  'f1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM crops WHERE name = 'Tomato'),
  (SELECT id FROM grades WHERE name = 'Grade A'),
  500, 500, 500, '2026-10-28', '2026-10-28', 'harvested'
),
(
  'b0020000-0000-4000-8000-000000000002',
  'f2222222-2222-4222-8222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM crops WHERE name = 'Carrot'),
  (SELECT id FROM grades WHERE name = 'Grade A'),
  350, 350, 350, '2026-10-27', '2026-10-27', 'harvested'
),
(
  'b0030000-0000-4000-8000-000000000003',
  'f3333333-3333-4333-8333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM crops WHERE name = 'Lettuce'),
  (SELECT id FROM grades WHERE name = 'Grade A'),
  200, 200, 200, '2026-10-26', '2026-10-26', 'harvested'
),
(
  'b0040000-0000-4000-8000-000000000004',
  'f1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM crops WHERE name = 'Potato'),
  (SELECT id FROM grades WHERE name = 'Grade B'),
  150, NULL, 0, '2026-10-25', NULL, 'ready'
),
(
  'b0050000-0000-4000-8000-000000000005',
  'f2222222-2222-4222-8222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM crops WHERE name = 'Spinach'),
  (SELECT id FROM grades WHERE name = 'Grade A'),
  500, 500, 500, '2026-10-24', '2026-10-24', 'harvested'
)
ON CONFLICT (id) DO UPDATE SET
  planned_kg = EXCLUDED.planned_kg,
  actual_kg = EXCLUDED.actual_kg,
  sellable_kg = EXCLUDED.sellable_kg,
  planned_harvest_date = EXCLUDED.planned_harvest_date,
  actual_harvest_date = EXCLUDED.actual_harvest_date,
  status = EXCLUDED.status;

INSERT INTO orders (
  id, buyer_id, destination, destination_district, delivery_date,
  agreed_total_cents, status, operation_key
) VALUES
('81111111-1111-4111-8111-111111111111','22222222-2222-2222-2222-222222222222','Demo buyer distribution centre','Colombo','2026-10-29',10000000,'draft','seed:ym25:order:tomato:v1'),
('82222222-2222-4222-8222-222222222222','22222222-2222-2222-2222-222222222222','Demo buyer distribution centre','Colombo','2026-10-29',6300000,'draft','seed:ym25:order:carrot:v1'),
('83333333-3333-4333-8333-333333333333','22222222-2222-2222-2222-222222222222','Demo buyer distribution centre','Colombo','2026-10-29',5000000,'draft','seed:ym25:order:lettuce:v1')
ON CONFLICT (id) DO NOTHING;

-- Advance seeded orders through the same transitions used by the application.
UPDATE orders SET status = 'awaiting_suppliers' WHERE id IN ('81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333') AND status = 'draft';
UPDATE orders SET status = 'ready_to_confirm' WHERE id IN ('81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333') AND status = 'awaiting_suppliers';
UPDATE orders SET status = 'confirmed' WHERE id IN ('81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333') AND status = 'ready_to_confirm';
UPDATE orders SET status = 'in_fulfilment' WHERE id IN ('81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222') AND status = 'confirmed';
UPDATE orders SET status = 'delivered' WHERE id = '81111111-1111-4111-8111-111111111111' AND status = 'in_fulfilment';

INSERT INTO allocations (
  id, order_id, batch_id, farmer_id, agreed_kg, agreed_unit_price_cents,
  committed_kg, picked_up_kg, handed_over_kg, accepted_kg,
  status, operation_key
) VALUES
('91111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','b0010000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',500,20000,500,500,500,500,'held','seed:ym25:allocation:tomato:v1'),
('92222222-2222-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','b0020000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',350,18000,350,350,0,0,'held','seed:ym25:allocation:carrot:v1'),
('93333333-3333-4333-8333-333333333333','83333333-3333-4333-8333-333333333333','b0030000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111',200,25000,200,200,200,200,'held','seed:ym25:allocation:lettuce:v1')
ON CONFLICT (id) DO UPDATE SET
  committed_kg = EXCLUDED.committed_kg,
  picked_up_kg = EXCLUDED.picked_up_kg,
  handed_over_kg = EXCLUDED.handed_over_kg,
  accepted_kg = EXCLUDED.accepted_kg;

-- Advance seeded allocations through valid workflow transitions.
UPDATE allocations SET status = 'supplier_accepted' WHERE id IN ('91111111-1111-4111-8111-111111111111','92222222-2222-4222-8222-222222222222','93333333-3333-4333-8333-333333333333') AND status = 'held';
UPDATE allocations SET status = 'committed' WHERE id IN ('91111111-1111-4111-8111-111111111111','92222222-2222-4222-8222-222222222222','93333333-3333-4333-8333-333333333333') AND status = 'supplier_accepted';
UPDATE allocations SET status = 'picked_up' WHERE id IN ('91111111-1111-4111-8111-111111111111','92222222-2222-4222-8222-222222222222','93333333-3333-4333-8333-333333333333') AND status = 'committed';
UPDATE allocations SET status = 'handed_over' WHERE id IN ('91111111-1111-4111-8111-111111111111','93333333-3333-4333-8333-333333333333') AND status = 'picked_up';
UPDATE allocations SET status = 'accepted' WHERE id IN ('91111111-1111-4111-8111-111111111111','93333333-3333-4333-8333-333333333333') AND status = 'handed_over';

INSERT INTO vehicles (id, driver_id, registration, vehicle_type, capacity_kg, availability) VALUES
('c1111111-1111-4111-8111-111111111111','33333333-3333-3333-3333-333333333333','YM25-DEMO-01','Refrigerated truck',1200,'on_trip')
ON CONFLICT (id) DO UPDATE SET availability = EXCLUDED.availability;

INSERT INTO trips (
  id, order_id, driver_id, vehicle_id, assigned_by, scheduled_start, scheduled_end,
  capacity_kg, planned_load_kg, routing_method, status, operation_key
) VALUES
('d1111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','33333333-3333-3333-3333-333333333333','c1111111-1111-4111-8111-111111111111','44444444-4444-4444-4444-444444444444','2026-10-29 06:00:00+00','2026-10-29 18:00:00+00',1200,500,'manual','assigned','seed:ym25:trip:tomato:v1'),
('d2222222-2222-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','33333333-3333-3333-3333-333333333333','c1111111-1111-4111-8111-111111111111','44444444-4444-4444-4444-444444444444','2026-10-29 07:00:00+00','2026-10-29 19:00:00+00',1200,350,'manual','assigned','seed:ym25:trip:carrot:v1')
ON CONFLICT (id) DO NOTHING;

UPDATE trips SET status = 'in_progress' WHERE id IN ('d1111111-1111-4111-8111-111111111111','d2222222-2222-4222-8222-222222222222') AND status = 'assigned';
UPDATE trips SET status = 'handed_over' WHERE id = 'd1111111-1111-4111-8111-111111111111' AND status = 'in_progress';
UPDATE trips SET status = 'completed' WHERE id = 'd1111111-1111-4111-8111-111111111111' AND status = 'handed_over';

INSERT INTO trip_stops (id, trip_id, order_id, allocation_id, sequence, completed_at, status) VALUES
('e1111111-1111-4111-8111-111111111111','d1111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','91111111-1111-4111-8111-111111111111',1,'2026-10-29 10:15:00+00','picked_up'),
('e2222222-2222-4222-8222-222222222222','d2222222-2222-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','92222222-2222-4222-8222-222222222222',1,'2026-10-29 11:00:00+00','picked_up')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at;

INSERT INTO custody_events (
  id, allocation_id, trip_id, order_id, event_type, quantity_kg, actor_id,
  acknowledgement, occurred_at, operation_key
) VALUES
('a1111111-aaaa-4111-8111-111111111111','91111111-1111-4111-8111-111111111111','d1111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','pickup',500,'33333333-3333-3333-3333-333333333333','Demo pickup acknowledged','2026-10-29 08:30:00+00','seed:ym25:custody:tomato:pickup:v1'),
('a2222222-aaaa-4222-8222-222222222222','91111111-1111-4111-8111-111111111111','d1111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111','handover',500,'33333333-3333-3333-3333-333333333333','Demo handover acknowledged','2026-10-29 10:15:00+00','seed:ym25:custody:tomato:handover:v1'),
('a3333333-aaaa-4333-8333-333333333333','92222222-2222-4222-8222-222222222222','d2222222-2222-4222-8222-222222222222','82222222-2222-4222-8222-222222222222','pickup',350,'33333333-3333-3333-3333-333333333333','Demo pickup acknowledged','2026-10-29 11:00:00+00','seed:ym25:custody:carrot:pickup:v1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trace_events (
  id, batch_id, allocation_id, custody_event_id, actor_id, event_type,
  canonical_version, public_payload, payload_hash, anchor_status, local_demo,
  operation_key, occurred_at
) VALUES
(
  'a4111111-aaaa-4111-8111-111111111111','b0010000-0000-4000-8000-000000000001',NULL,NULL,
  '11111111-1111-1111-1111-111111111111','harvest_registered',1,
  '{"crop":"Tomato","grade":"Grade A","district":"Nuwara Eliya","quantity_kg":"500","event":"Harvest registered"}',
  md5('seed:ym25:tomato:harvest:v1') || md5('seed:ym25:tomato:harvest:hash:v1'),
  'unanchored',true,'seed:ym25:trace:tomato:harvest:v1','2026-10-28 08:30:00+00'
),
(
  'a4222222-aaaa-4222-8222-222222222222','b0010000-0000-4000-8000-000000000001','91111111-1111-4111-8111-111111111111',NULL,
  '11111111-1111-1111-1111-111111111111','allocation_confirmed',1,
  '{"crop":"Tomato","grade":"Grade A","district":"Nuwara Eliya","quantity_kg":"500","event":"Allocation confirmed"}',
  md5('seed:ym25:tomato:allocation:v1') || md5('seed:ym25:tomato:allocation:hash:v1'),
  'unanchored',true,'seed:ym25:trace:tomato:allocation:v1','2026-10-28 09:00:00+00'
),
(
  'a4333333-aaaa-4333-8333-333333333333','b0010000-0000-4000-8000-000000000001','91111111-1111-4111-8111-111111111111','a1111111-aaaa-4111-8111-111111111111',
  '33333333-3333-3333-3333-333333333333','pickup',1,
  '{"crop":"Tomato","grade":"Grade A","district":"Nuwara Eliya","quantity_kg":"500","event":"Produce picked up"}',
  md5('seed:ym25:tomato:pickup:v1') || md5('seed:ym25:tomato:pickup:hash:v1'),
  'unanchored',true,'seed:ym25:trace:tomato:pickup:v1','2026-10-29 08:30:00+00'
),
(
  'a4444444-aaaa-4444-8444-444444444444','b0010000-0000-4000-8000-000000000001','91111111-1111-4111-8111-111111111111','a2222222-aaaa-4222-8222-222222222222',
  '33333333-3333-3333-3333-333333333333','handover',1,
  '{"crop":"Tomato","grade":"Grade A","district":"Colombo","quantity_kg":"500","event":"Delivery handed over"}',
  md5('seed:ym25:tomato:handover:v1') || md5('seed:ym25:tomato:handover:hash:v1'),
  'unanchored',true,'seed:ym25:trace:tomato:handover:v1','2026-10-29 10:15:00+00'
),
(
  'a4555555-aaaa-4555-8555-555555555555','b0020000-0000-4000-8000-000000000002',NULL,NULL,
  '11111111-1111-1111-1111-111111111111','harvest_registered',1,
  '{"crop":"Carrot","grade":"Grade A","district":"Kandy","quantity_kg":"350","event":"Harvest registered"}',
  md5('seed:ym25:carrot:harvest:v1') || md5('seed:ym25:carrot:harvest:hash:v1'),
  'unanchored',true,'seed:ym25:trace:carrot:harvest:v1','2026-10-27 08:30:00+00'
),
(
  'a4666666-aaaa-4666-8666-666666666666','b0020000-0000-4000-8000-000000000002','92222222-2222-4222-8222-222222222222',NULL,
  '11111111-1111-1111-1111-111111111111','allocation_confirmed',1,
  '{"crop":"Carrot","grade":"Grade A","district":"Kandy","quantity_kg":"350","event":"Allocation confirmed"}',
  md5('seed:ym25:carrot:allocation:v1') || md5('seed:ym25:carrot:allocation:hash:v1'),
  'unanchored',true,'seed:ym25:trace:carrot:allocation:v1','2026-10-28 09:00:00+00'
),
(
  'a4777777-aaaa-4777-8777-777777777777','b0020000-0000-4000-8000-000000000002','92222222-2222-4222-8222-222222222222','a3333333-aaaa-4333-8333-333333333333',
  '33333333-3333-3333-3333-333333333333','pickup',1,
  '{"crop":"Carrot","grade":"Grade A","district":"Kandy","quantity_kg":"350","event":"Produce picked up"}',
  md5('seed:ym25:carrot:pickup:v1') || md5('seed:ym25:carrot:pickup:hash:v1'),
  'unanchored',true,'seed:ym25:trace:carrot:pickup:v1','2026-10-29 11:00:00+00'
),
(
  'a4888888-aaaa-4888-8888-888888888888','b0030000-0000-4000-8000-000000000003',NULL,NULL,
  '11111111-1111-1111-1111-111111111111','harvest_registered',1,
  '{"crop":"Lettuce","grade":"Grade A","district":"Colombo","quantity_kg":"200","event":"Harvest registered"}',
  md5('seed:ym25:lettuce:harvest:v1') || md5('seed:ym25:lettuce:harvest:hash:v1'),
  'unanchored',true,'seed:ym25:trace:lettuce:harvest:v1','2026-10-26 08:30:00+00'
),
(
  'a4999999-aaaa-4999-8999-999999999999','b0030000-0000-4000-8000-000000000003','93333333-3333-4333-8333-333333333333',NULL,
  '11111111-1111-1111-1111-111111111111','acceptance',1,
  '{"crop":"Lettuce","grade":"Grade A","district":"Colombo","quantity_kg":"200","event":"Buyer accepted delivery"}',
  md5('seed:ym25:lettuce:acceptance:v1') || md5('seed:ym25:lettuce:acceptance:hash:v1'),
  'unanchored',true,'seed:ym25:trace:lettuce:acceptance:v1','2026-10-29 15:10:00+00'
)
ON CONFLICT (operation_key) DO NOTHING;
COMMIT;
