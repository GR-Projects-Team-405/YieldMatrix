-- REVIEW ONLY. Not applied to the shared database.
-- Uses the Demo Farmer, Demo Buyer, Green Valley Farm, seeded crops and grades.
-- Values are illustrative. No private contact/pickup data is added to YM12 APIs.
BEGIN;

INSERT INTO harvest_batches (
  id, farm_id, farmer_id, crop_id, grade_id, planned_kg, actual_kg, sellable_kg,
  planned_harvest_date, actual_harvest_date, status
)
SELECT 'c12b0000-0000-4000-8000-000000000259',
       'f1111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       c.id, g.id, 2400, 2400, 2400, DATE '2026-11-08', DATE '2026-11-08', 'harvested'
  FROM crops c CROSS JOIN grades g
 WHERE c.name = 'Tomato' AND g.name = 'Grade A'
ON CONFLICT DO NOTHING;

INSERT INTO harvest_batches (
  id, farm_id, farmer_id, crop_id, grade_id, planned_kg, actual_kg, sellable_kg,
  planned_harvest_date, actual_harvest_date, status
)
SELECT 'c12b0000-0000-4000-8000-000000000260',
       'f1111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       c.id, g.id, 1200, 1200, 1200, DATE '2026-11-09', DATE '2026-11-09', 'harvested'
  FROM crops c CROSS JOIN grades g
 WHERE c.name = 'Carrot' AND g.name = 'Grade A'
ON CONFLICT DO NOTHING;

INSERT INTO harvest_batches (
  id, farm_id, farmer_id, crop_id, grade_id, planned_kg, actual_kg, sellable_kg,
  planned_harvest_date, actual_harvest_date, status
)
SELECT 'c12b0000-0000-4000-8000-000000000261',
       'f1111111-1111-1111-1111-111111111111',
       '11111111-1111-1111-1111-111111111111',
       c.id, g.id, 1800, 1800, 1800, DATE '2026-11-10', DATE '2026-11-10', 'harvested'
  FROM crops c CROSS JOIN grades g
 WHERE c.name = 'Cabbage' AND g.name = 'Grade B'
ON CONFLICT DO NOTHING;

INSERT INTO listings (id, batch_id, unit_price_cents, offered_kg, valid_from, valid_until, status)
VALUES
  ('a12b0000-0000-4000-8000-000000000259','c12b0000-0000-4000-8000-000000000259',28000,2400,'2026-11-01T00:00:00Z','2027-01-01T00:00:00Z','active'),
  ('a12b0000-0000-4000-8000-000000000260','c12b0000-0000-4000-8000-000000000260',32000,1200,'2026-11-01T00:00:00Z','2027-01-01T00:00:00Z','active'),
  ('a12b0000-0000-4000-8000-000000000261','c12b0000-0000-4000-8000-000000000261',18000,1800,'2026-11-01T00:00:00Z','2027-01-01T00:00:00Z','active')
ON CONFLICT DO NOTHING;

INSERT INTO orders (
  id, buyer_id, destination, destination_district, delivery_date,
  agreed_total_cents, status, operation_key
)
VALUES (
  'd12b0000-0000-4000-8000-000000000259',
  '22222222-2222-2222-2222-222222222222',
  'Illustrative demo destination', 'Colombo', DATE '2026-12-01',
  1400000, 'draft', 'ym12:proposal:order:0259'
)
ON CONFLICT DO NOTHING;

INSERT INTO allocations (
  id, order_id, batch_id, farmer_id, agreed_kg, agreed_unit_price_cents,
  status, operation_key
)
VALUES (
  'e12b0000-0000-4000-8000-000000000259',
  'd12b0000-0000-4000-8000-000000000259',
  'c12b0000-0000-4000-8000-000000000259',
  '11111111-1111-1111-1111-111111111111',
  50, 28000, 'held', 'ym12:proposal:allocation:0259'
)
ON CONFLICT DO NOTHING;

COMMIT;
