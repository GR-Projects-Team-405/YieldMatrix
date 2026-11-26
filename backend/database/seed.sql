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

INSERT INTO crops (name) VALUES
  ('Tomato'),('Carrot'),('Cabbage'),('Potato'),('Beans'),
  ('Brinjal'),('Bell Pepper'),('Green Chilli'),('Pumpkin'),('Bitter Gourd'),
  ('Okra'),('Snake Gourd'),('Cucumber'),('Spinach'),('Lettuce'),
  ('Radish'),('Beetroot'),('Onion'),('Cauliflower'),('Sweet Potato'),('Corn')
ON CONFLICT (name) DO NOTHING;
INSERT INTO grades (name, description) VALUES ('Grade A','Grade A produce'),('Grade B','Grade B produce'),('Grade C','Grade C produce') ON CONFLICT (name) DO NOTHING;
INSERT INTO farms (id, farmer_id, name, district, pickup_address, latitude, longitude)
VALUES ('f1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Green Valley Farm','Nuwara Eliya','Demo pickup location, Nuwara Eliya',6.949700,80.789100)
ON CONFLICT (id) DO NOTHING;
COMMIT;
