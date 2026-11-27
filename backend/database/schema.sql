-- YieldMatrix: SRS sections 16, 17, 21 and 24. Execute manually in Neon SQL Editor.
-- Money: BIGINT LKR cents. Weights: NUMERIC(12,3) kg. Timestamps: UTC instants.
-- PostgreSQL rounds NUMERIC(12,3) on assignment: API writers MUST validate raw
-- precision before casting, using require_kg(raw_numeric) below or equivalent.
-- Module owners implement authorised atomic operations, expiry workers (at least
-- once/minute), session revocation and district serviceability; this is schema only.
BEGIN;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SET TIME ZONE 'UTC';

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  role TEXT NOT NULL CHECK (role IN ('farmer','buyer','driver','admin')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  password_hash TEXT, -- Nullable for demo identities only; never plaintext passwords.
  phone TEXT,
  district TEXT,
  approval_reason TEXT,
  approved_by UUID REFERENCES users(id),
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  market_advisory_preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (used_at IS NULL OR used_at >= created_at)
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx
  ON password_reset_tokens(user_id, created_at);

CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  pickup_address TEXT NOT NULL, -- Private, never public trace data.
  latitude NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, farmer_id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS harvest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL,
  farmer_id UUID NOT NULL,
  crop_id UUID NOT NULL REFERENCES crops(id),
  grade_id UUID NOT NULL REFERENCES grades(id),
  planned_kg NUMERIC(12,3) NOT NULL CHECK (planned_kg >= 0),
  actual_kg NUMERIC(12,3) CHECK (actual_kg >= 0),
  sellable_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (sellable_kg >= 0),
  planned_harvest_date DATE NOT NULL,
  actual_harvest_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ready','harvested','depleted','cancelled')),
  public_trace_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, farmer_id),
  FOREIGN KEY (farm_id, farmer_id) REFERENCES farms(id, farmer_id),
  CHECK (sellable_kg <= COALESCE(actual_kg, 0))
);
CREATE SEQUENCE IF NOT EXISTS harvest_batch_display_id_seq;
ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE harvest_batches
  ALTER COLUMN display_id SET DEFAULT (
    'BM-' || lpad(nextval('harvest_batch_display_id_seq')::text, 2, '0')
  );
CREATE UNIQUE INDEX IF NOT EXISTS harvest_batches_display_id_idx ON harvest_batches(display_id);
UPDATE harvest_batches
SET display_id = 'BM-' || lpad(substring(display_id FROM '^BM-25-([0-9]+)$')::BIGINT::text, 2, '0')
WHERE display_id ~ '^BM-25-[0-9]+$';
WITH numbered_batches AS (
  SELECT
    id,
    COALESCE((SELECT MAX(substring(display_id FROM '^BM-([0-9]+)$')::BIGINT) FROM harvest_batches), 0)
      + row_number() OVER (ORDER BY created_at, id) AS sequence_number
  FROM harvest_batches
  WHERE display_id IS NULL
)
UPDATE harvest_batches AS batch
SET display_id = 'BM-' || lpad(numbered_batches.sequence_number::text, 2, '0')
FROM numbered_batches
WHERE batch.id = numbered_batches.id;
SELECT setval(
  'harvest_batch_display_id_seq',
  GREATEST(COALESCE(MAX(substring(display_id FROM '^BM-([0-9]+)$')::BIGINT), 1), 1),
  COALESCE(MAX(substring(display_id FROM '^BM-([0-9]+)$')::BIGINT) IS NOT NULL, false)
)
FROM harvest_batches;
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES harvest_batches(id),
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents > 0),
  offered_kg NUMERIC(12,3) NOT NULL CHECK (offered_kg > 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','expired','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_listing_per_batch ON listings(batch_id) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  crop_id UUID NOT NULL REFERENCES crops(id),
  grade_id UUID NOT NULL REFERENCES grades(id),
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  destination TEXT NOT NULL,
  destination_district TEXT NOT NULL,
  delivery_from DATE NOT NULL,
  delivery_until DATE NOT NULL,
  budget_cents BIGINT CHECK (budget_cents >= 0),
  allow_partial BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','matched','fulfilled','cancelled','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (delivery_until >= delivery_from),
  CHECK (expires_at > created_at)
);
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id),
  farmer_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn','expired')),
  notes TEXT,
  quality_specs JSONB NOT NULL DEFAULT '{}',
  decline_reason TEXT,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, farmer_id) REFERENCES harvest_batches(id, farmer_id),
  CHECK (expires_at > created_at)
);
CREATE TABLE IF NOT EXISTS future_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  farmer_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  offer_id UUID REFERENCES offers(id),
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg > 0),
  agreed_unit_price_cents BIGINT NOT NULL CHECK (agreed_unit_price_cents > 0),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  cancellation_terms TEXT NOT NULL,
  original_terms JSONB NOT NULL,
  revisions JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(revisions) = 'array'),
  decisions JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(decisions) = 'array'),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','change_pending','ready_to_fulfil','fulfilled','rejected','cancelled')),
  decision_reason TEXT,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (batch_id, farmer_id) REFERENCES harvest_batches(id, farmer_id),
  CHECK (window_end >= window_start)
);
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  demand_id UUID REFERENCES demands(id),
  destination TEXT NOT NULL,
  destination_district TEXT NOT NULL,
  destination_latitude NUMERIC(9,6) CHECK (destination_latitude BETWEEN -90 AND 90),
  destination_longitude NUMERIC(9,6) CHECK (destination_longitude BETWEEN -180 AND 180),
  delivery_date DATE NOT NULL,
  agreed_total_cents BIGINT NOT NULL DEFAULT 0 CHECK (agreed_total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_suppliers','ready_to_confirm','confirmed','in_fulfilment','delivered','closed','expired','cancelled')),
  cancellation_reason TEXT,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((destination_latitude IS NULL) = (destination_longitude IS NULL)),
  CHECK (status <> 'cancelled' OR COALESCE(length(trim(cancellation_reason)), 0) > 0)
);
CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  batch_id UUID NOT NULL,
  farmer_id UUID NOT NULL,
  future_commitment_id UUID REFERENCES future_commitments(id),
  agreed_kg NUMERIC(12,3) NOT NULL CHECK (agreed_kg > 0),
  agreed_unit_price_cents BIGINT NOT NULL CHECK (agreed_unit_price_cents > 0),
  agreed_value_cents BIGINT GENERATED ALWAYS AS (round(agreed_kg * agreed_unit_price_cents)::BIGINT) STORED,
  committed_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (committed_kg >= 0),
  picked_up_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (picked_up_kg >= 0),
  handed_over_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (handed_over_kg >= 0),
  accepted_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (accepted_kg >= 0),
  funded_cents BIGINT NOT NULL DEFAULT 0 CHECK (funded_cents >= 0),
  settled_cents BIGINT NOT NULL DEFAULT 0 CHECK (settled_cents >= 0),
  refunded_cents BIGINT NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  held_cents BIGINT NOT NULL DEFAULT 0 CHECK (held_cents >= 0),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','supplier_accepted','committed','picked_up','handed_over','accepted','partially_accepted','disputed','resolved','declined','expired','cancelled')),
  decision_reason TEXT,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, order_id),
  FOREIGN KEY (batch_id, farmer_id) REFERENCES harvest_batches(id, farmer_id),
  CHECK (accepted_kg <= handed_over_kg AND handed_over_kg <= picked_up_kg AND picked_up_kg <= committed_kg AND committed_kg <= agreed_kg),
  CHECK (funded_cents::NUMERIC = settled_cents::NUMERIC + refunded_cents + held_cents),
  CHECK (funded_cents <= agreed_value_cents),
  CHECK (status <> 'resolved' OR held_cents = 0)
);
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id),
  held_kg NUMERIC(12,3) NOT NULL CHECK (held_kg > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','released','expired')),
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  terminal_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK ((status = 'active' AND terminal_at IS NULL) OR (status <> 'active' AND terminal_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_hold_per_allocation ON reservations(allocation_id) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id),
  registration TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL,
  capacity_kg NUMERIC(12,3) NOT NULL CHECK (capacity_kg > 0),
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','unavailable','on_trip')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, driver_id)
);
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  driver_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  capacity_kg NUMERIC(12,3) NOT NULL CHECK (capacity_kg > 0),
  planned_load_kg NUMERIC(12,3) NOT NULL CHECK (planned_load_kg > 0 AND planned_load_kg <= capacity_kg),
  routing_method TEXT NOT NULL CHECK (routing_method IN ('nearest_next_stop','manual')),
  route_notes TEXT,
  reassignment_history JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','handed_over','completed','cancelled')),
  cancellation_reason TEXT,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, order_id),
  FOREIGN KEY (vehicle_id, driver_id) REFERENCES vehicles(id, driver_id),
  CHECK (scheduled_end > scheduled_start),
  CHECK (status <> 'cancelled' OR COALESCE(length(trim(cancellation_reason)), 0) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_order ON trips(order_id) WHERE status IN ('assigned','in_progress','handed_over');
CREATE TABLE IF NOT EXISTS trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  order_id UUID NOT NULL,
  allocation_id UUID NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','picked_up','exception')),
  UNIQUE (trip_id, sequence),
  UNIQUE (trip_id, allocation_id),
  FOREIGN KEY (trip_id, order_id) REFERENCES trips(id, order_id),
  FOREIGN KEY (allocation_id, order_id) REFERENCES allocations(id, order_id)
);
CREATE TABLE IF NOT EXISTS custody_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL,
  trip_id UUID NOT NULL,
  order_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('pickup','handover','custody_transfer')),
  quantity_kg NUMERIC(12,3) NOT NULL CHECK (quantity_kg >= 0),
  actor_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  acknowledgement TEXT,
  evidence JSONB NOT NULL DEFAULT '[]', -- Private validated file references; maximum 5 MB each.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation_key TEXT NOT NULL UNIQUE,
  FOREIGN KEY (allocation_id, order_id) REFERENCES allocations(id, order_id),
  FOREIGN KEY (trip_id, order_id) REFERENCES trips(id, order_id)
);
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  allocation_id UUID REFERENCES allocations(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  shortage_kg NUMERIC(12,3) CHECK (shortage_kg >= 0),
  evidence JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'resolved' OR (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id),
  raised_by UUID NOT NULL REFERENCES users(id),
  disputed_kg NUMERIC(12,3) NOT NULL CHECK (disputed_kg > 0),
  disputed_cents BIGINT NOT NULL CHECK (disputed_cents >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  evidence JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  resolved_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (resolved_kg >= 0 AND resolved_kg <= disputed_kg),
  settlement_cents BIGINT NOT NULL DEFAULT 0 CHECK (settlement_cents >= 0),
  refund_cents BIGINT NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  operation_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (settlement_cents::NUMERIC + refund_cents <= disputed_cents),
  CHECK (status <> 'resolved' OR (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID UNIQUE REFERENCES users(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('farmer','buyer','driver','admin','simulation_source')),
  currency TEXT NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
  available_cents BIGINT NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
  held_cents BIGINT NOT NULL DEFAULT 0 CHECK (held_cents >= 0),
  pending_payout_cents BIGINT NOT NULL DEFAULT 0 CHECK (pending_payout_cents >= 0),
  simulated BOOLEAN NOT NULL DEFAULT true CHECK (simulated),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((account_type = 'simulation_source' AND owner_id IS NULL) OR (account_type <> 'simulation_source' AND owner_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_simulation_source_wallet ON wallets(account_type) WHERE account_type = 'simulation_source';
CREATE TABLE IF NOT EXISTS wallet_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('funding','hold','settlement','refund','payout_hold','payout','payout_release','reversal')),
  event_reference TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  order_id UUID REFERENCES orders(id),
  allocation_id UUID REFERENCES allocations(id),
  reversal_of UUID UNIQUE REFERENCES wallet_journal_entries(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  created_transaction BIGINT NOT NULL DEFAULT txid_current(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((event_type = 'reversal') = (reversal_of IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS wallet_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES wallet_journal_entries(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  bucket TEXT NOT NULL CHECK (bucket IN ('available','held','pending_payout','simulation_equity')),
  side TEXT NOT NULL CHECK (side IN ('debit','credit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  decision_reason TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES wallet_journal_entries(id),
  operation_key TEXT NOT NULL UNIQUE,
  simulated BOOLEAN NOT NULL DEFAULT true CHECK (simulated),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'pending' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND COALESCE(length(trim(decision_reason)), 0) > 0))
);
CREATE TABLE IF NOT EXISTS market_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES crops(id),
  grade_id UUID NOT NULL REFERENCES grades(id),
  district TEXT NOT NULL,
  observation_date DATE NOT NULL,
  source TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_id UUID REFERENCES market_observations(id),
  is_current BOOLEAN NOT NULL DEFAULT true,
  demand_kg NUMERIC(12,3) NOT NULL CHECK (demand_kg >= 0),
  price_per_kg_cents BIGINT NOT NULL CHECK (price_per_kg_cents >= 0),
  weather_context JSONB,
  weather_observed_at TIMESTAMPTZ,
  sample_data BOOLEAN NOT NULL DEFAULT false,
  imported_by UUID NOT NULL REFERENCES users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crop_id, grade_id, district, observation_date, source, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS market_current_key ON market_observations(crop_id, grade_id, district, observation_date, source) WHERE is_current;
CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES crops(id),
  district TEXT NOT NULL,
  method TEXT NOT NULL,
  model_version TEXT NOT NULL,
  input_from DATE NOT NULL,
  input_until DATE NOT NULL,
  training_from DATE NOT NULL,
  training_until DATE NOT NULL,
  evaluation_from DATE NOT NULL,
  evaluation_until DATE NOT NULL,
  horizon_days INTEGER NOT NULL DEFAULT 7 CHECK (horizon_days = 7),
  input_version_references JSONB NOT NULL DEFAULT '[]',
  series JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(series) = 'array'),
  model_mae_kg NUMERIC(12,3) CHECK (model_mae_kg >= 0),
  baseline_mae_kg NUMERIC(12,3) CHECK (baseline_mae_kg >= 0),
  explanation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','insufficient_data','stale','failed')),
  sample_data BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (input_until >= input_from),
  CHECK (training_from >= input_from AND training_until >= training_from),
  CHECK (evaluation_from > training_until AND evaluation_until >= evaluation_from AND evaluation_until <= input_until),
  CHECK (status <> 'available' OR (input_until - input_from >= 55 AND evaluation_until - evaluation_from = 13 AND jsonb_array_length(series) = 7)),
  CHECK (status <> 'available' OR input_until >= (generated_at AT TIME ZONE 'UTC')::DATE - 7)
);
CREATE TABLE IF NOT EXISTS trace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES harvest_batches(id),
  allocation_id UUID REFERENCES allocations(id),
  custody_event_id UUID REFERENCES custody_events(id),
  actor_id UUID NOT NULL REFERENCES users(id), -- Private metadata, not public payload.
  event_type TEXT NOT NULL CHECK (event_type IN ('harvest_registered','allocation_confirmed','pickup','handover','acceptance','resolution')),
  canonical_version INTEGER NOT NULL CHECK (canonical_version > 0),
  public_payload JSONB NOT NULL, -- Allowlisted locality/crop/grade/event fields only.
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  anchor_status TEXT NOT NULL DEFAULT 'unanchored' CHECK (anchor_status IN ('unanchored','pending','verified','failed')),
  chain_id TEXT,
  contract_reference TEXT,
  transaction_hash TEXT,
  anchor_receipt JSONB,
  anchor_attempts JSONB NOT NULL DEFAULT '[]',
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  failure_reason TEXT,
  local_demo BOOLEAN NOT NULL DEFAULT true CHECK (local_demo),
  operation_key TEXT NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, payload_hash),
  CHECK (anchor_status <> 'verified' OR (chain_id IS NOT NULL AND contract_reference IS NOT NULL AND transaction_hash IS NOT NULL AND anchor_receipt IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  target_path TEXT,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','local_mail_sink')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','read')),
  operation_key TEXT NOT NULL UNIQUE,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farmer_market_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id),
  crop_id UUID NOT NULL REFERENCES crops(id),
  grade_id UUID NOT NULL REFERENCES grades(id),
  district TEXT NOT NULL,
  lower_price_cents BIGINT NOT NULL CHECK (lower_price_cents >= 0),
  upper_price_cents BIGINT NOT NULL CHECK (upper_price_cents > lower_price_cents),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','replaced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_farmer_market_price_alert
  ON farmer_market_price_alerts(farmer_id, crop_id, grade_id, district)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS farmer_market_price_alert_history_idx
  ON farmer_market_price_alerts(farmer_id, crop_id, grade_id, district, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  request_id UUID,
  reason TEXT,
  safe_changes JSONB NOT NULL DEFAULT '{}', -- Never include credentials, tokens or secrets.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHECKs constrain status values; triggers additionally validate OLD -> NEW.
CREATE OR REPLACE FUNCTION enforce_workflow_transition() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed JSONB; initial_state TEXT;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'orders' THEN
      initial_state := 'draft';
      allowed := '{"draft":["awaiting_suppliers","cancelled","expired"],"awaiting_suppliers":["ready_to_confirm","cancelled","expired"],"ready_to_confirm":["confirmed","cancelled","expired"],"confirmed":["in_fulfilment"],"in_fulfilment":["delivered"],"delivered":["closed"]}';
    WHEN 'allocations' THEN
      initial_state := 'held';
      allowed := '{"held":["supplier_accepted","declined","expired","cancelled"],"supplier_accepted":["committed","expired","cancelled"],"committed":["picked_up","disputed"],"picked_up":["handed_over","disputed"],"handed_over":["accepted","partially_accepted","disputed"],"accepted":["resolved"],"partially_accepted":["disputed","resolved"],"disputed":["resolved"]}';
    WHEN 'reservations' THEN
      initial_state := 'active';
      allowed := '{"active":["consumed","released","expired"]}';
    WHEN 'trips' THEN
      initial_state := 'assigned';
      allowed := '{"assigned":["in_progress","cancelled"],"in_progress":["handed_over"],"handed_over":["completed"]}';
    WHEN 'disputes', 'incidents' THEN
      initial_state := 'open';
      allowed := '{"open":["under_review"],"under_review":["resolved"]}';
    WHEN 'future_commitments' THEN
      initial_state := 'proposed';
      allowed := '{"proposed":["accepted","rejected","cancelled"],"accepted":["change_pending","ready_to_fulfil","cancelled"],"change_pending":["accepted","ready_to_fulfil","cancelled"],"ready_to_fulfil":["fulfilled","change_pending","cancelled"]}';
    WHEN 'payout_requests' THEN
      initial_state := 'pending';
      allowed := '{"pending":["completed","rejected"]}';
    ELSE RAISE EXCEPTION 'Unknown workflow table';
  END CASE;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> initial_state THEN RAISE EXCEPTION 'Invalid initial state for %: %', TG_TABLE_NAME, NEW.status; END IF;
  ELSIF NEW.status <> OLD.status AND NOT COALESCE((allowed -> OLD.status) ? NEW.status, false) THEN
    RAISE EXCEPTION 'Invalid % transition: % -> %', TG_TABLE_NAME, OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['orders','allocations','reservations','trips','disputes','incidents','future_commitments','payout_requests'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workflow_transition ON %I', tab);
    EXECUTE format('CREATE TRIGGER workflow_transition BEFORE INSERT OR UPDATE OF status ON %I FOR EACH ROW EXECUTE FUNCTION enforce_workflow_transition()', tab);
  END LOOP;
END $$;

-- Validate raw input before a NUMERIC(12,3) cast to avoid silent precision loss.
CREATE OR REPLACE FUNCTION require_kg(value NUMERIC) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF value IS NULL OR value < 0 OR value >= 1000000000 OR value <> trunc(value, 3) THEN
    RAISE EXCEPTION 'Quantity requires non-negative kg with at most three fractional digits';
  END IF;
  RETURN value;
END $$;

-- DR-01: availability is derived, never independently editable. Expired holds stay
-- deducted until the expiry worker atomically records their terminal state.
CREATE OR REPLACE VIEW batch_availability AS
SELECT b.id AS batch_id, b.sellable_kg,
  COALESCE(h.held_kg, 0)::NUMERIC(12,3) AS held_kg,
  COALESCE(c.uncollected_kg, 0)::NUMERIC(12,3) AS uncollected_kg,
  (b.sellable_kg - COALESCE(h.held_kg, 0) - COALESCE(c.uncollected_kg, 0))::NUMERIC(12,3) AS available_kg
FROM harvest_batches b
LEFT JOIN (SELECT a.batch_id, sum(r.held_kg) AS held_kg FROM reservations r JOIN allocations a ON a.id = r.allocation_id WHERE r.status = 'active' GROUP BY a.batch_id) h ON h.batch_id = b.id
LEFT JOIN (SELECT batch_id, sum(committed_kg - picked_up_kg) AS uncollected_kg FROM allocations GROUP BY batch_id) c ON c.batch_id = b.id;

-- Serialize stock-affecting writers on their batch before checking availability.
CREATE OR REPLACE FUNCTION lock_stock_batch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE batch UUID;
BEGIN
  IF TG_TABLE_NAME = 'reservations' THEN
    IF TG_OP = 'UPDATE' AND NEW.allocation_id <> OLD.allocation_id THEN RAISE EXCEPTION 'Reservation allocation is immutable'; END IF;
    SELECT batch_id INTO batch FROM allocations WHERE id = NEW.allocation_id;
  ELSE batch := NEW.batch_id;
  END IF;
  PERFORM 1 FROM harvest_batches WHERE id = batch FOR UPDATE;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stock_lock ON allocations;
CREATE TRIGGER stock_lock BEFORE INSERT OR UPDATE ON allocations FOR EACH ROW EXECUTE FUNCTION lock_stock_batch();
DROP TRIGGER IF EXISTS stock_lock ON reservations;
CREATE TRIGGER stock_lock BEFORE INSERT OR UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION lock_stock_batch();
CREATE OR REPLACE FUNCTION check_stock_availability() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE batch UUID;
BEGIN
  IF TG_TABLE_NAME = 'harvest_batches' THEN batch := NEW.id;
  ELSIF TG_TABLE_NAME = 'allocations' THEN batch := NEW.batch_id;
  ELSE SELECT batch_id INTO batch FROM allocations WHERE id = NEW.allocation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM batch_availability WHERE batch_id = batch AND available_kg < 0) THEN
    RAISE EXCEPTION 'Insufficient sellable stock for batch %', batch;
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['harvest_batches','allocations','reservations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS stock_available ON %I', tab);
    EXECUTE format('CREATE CONSTRAINT TRIGGER stock_available AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_stock_availability()', tab);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION check_order_allocations() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE order_key UUID; order_state TEXT;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN order_key := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN order_key := OLD.order_id;
  ELSE order_key := NEW.order_id;
  END IF;
  SELECT status INTO order_state FROM orders WHERE id = order_key;
  IF order_state NOT IN ('draft','cancelled','expired') AND NOT EXISTS (SELECT 1 FROM allocations WHERE order_id = order_key) THEN
    RAISE EXCEPTION 'Trading order requires at least one allocation';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS order_has_allocations ON orders;
CREATE CONSTRAINT TRIGGER order_has_allocations AFTER INSERT OR UPDATE ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_order_allocations();
DROP TRIGGER IF EXISTS order_has_allocations ON allocations;
CREATE CONSTRAINT TRIGGER order_has_allocations AFTER INSERT OR UPDATE OR DELETE ON allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_order_allocations();
CREATE OR REPLACE FUNCTION protect_allocation_terms() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.order_id, NEW.batch_id, NEW.farmer_id, NEW.agreed_kg, NEW.agreed_unit_price_cents) IS DISTINCT FROM
     (OLD.order_id, OLD.batch_id, OLD.farmer_id, OLD.agreed_kg, OLD.agreed_unit_price_cents) THEN
    RAISE EXCEPTION 'Allocation links and agreed terms are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS allocation_terms_immutable ON allocations;
CREATE TRIGGER allocation_terms_immutable BEFORE UPDATE ON allocations FOR EACH ROW EXECUTE FUNCTION protect_allocation_terms();

-- Post each journal header and ALL lines in one transaction, alongside wallet
-- cache changes. Posted journals cannot be edited; use linked reversal entries.
CREATE OR REPLACE FUNCTION prevent_record_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME; END $$;
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['wallet_journal_entries','wallet_journal_lines','audit_logs','custody_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS immutable_record ON %I', tab);
    EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_record_mutation()', tab);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION guard_journal_line() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE transaction_id BIGINT; kind TEXT;
BEGIN
  SELECT created_transaction INTO transaction_id FROM wallet_journal_entries WHERE id = NEW.entry_id;
  IF transaction_id IS DISTINCT FROM txid_current() THEN RAISE EXCEPTION 'Cannot append to a posted journal'; END IF;
  SELECT account_type INTO kind FROM wallets WHERE id = NEW.wallet_id;
  IF (kind = 'simulation_source') <> (NEW.bucket = 'simulation_equity') THEN RAISE EXCEPTION 'Invalid wallet bucket'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS journal_line_guard ON wallet_journal_lines;
CREATE TRIGGER journal_line_guard BEFORE INSERT ON wallet_journal_lines FOR EACH ROW EXECUTE FUNCTION guard_journal_line();
CREATE OR REPLACE FUNCTION check_balanced_journal() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE entry_key UUID; debit_total NUMERIC; credit_total NUMERIC; expected BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'wallet_journal_entries' THEN entry_key := NEW.id; ELSE entry_key := NEW.entry_id; END IF;
  SELECT amount_cents INTO expected FROM wallet_journal_entries WHERE id = entry_key;
  SELECT COALESCE(sum(amount_cents) FILTER (WHERE side = 'debit'),0), COALESCE(sum(amount_cents) FILTER (WHERE side = 'credit'),0)
    INTO debit_total, credit_total FROM wallet_journal_lines WHERE entry_id = entry_key;
  IF debit_total <> credit_total OR debit_total <> expected OR debit_total = 0 THEN
    RAISE EXCEPTION 'Journal % must balance with debits = credits = amount', entry_key;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS journal_balanced ON wallet_journal_entries;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON wallet_journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_balanced_journal();
DROP TRIGGER IF EXISTS journal_balanced ON wallet_journal_lines;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON wallet_journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_balanced_journal();

CREATE INDEX IF NOT EXISTS farms_farmer_idx ON farms(farmer_id);
CREATE INDEX IF NOT EXISTS batches_farm_idx ON harvest_batches(farm_id);
CREATE INDEX IF NOT EXISTS demands_buyer_idx ON demands(buyer_id);
CREATE INDEX IF NOT EXISTS offers_demand_idx ON offers(demand_id);
CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);
CREATE INDEX IF NOT EXISTS future_commitments_buyer_status_idx ON future_commitments(buyer_id, status);
CREATE INDEX IF NOT EXISTS future_commitments_farmer_status_idx ON future_commitments(farmer_id, status);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS allocations_order_idx ON allocations(order_id);
CREATE INDEX IF NOT EXISTS allocations_batch_idx ON allocations(batch_id);
CREATE INDEX IF NOT EXISTS allocations_farmer_idx ON allocations(farmer_id);
CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS trips_driver_idx ON trips(driver_id, scheduled_start);
CREATE INDEX IF NOT EXISTS custody_allocation_idx ON custody_events(allocation_id, occurred_at);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON wallet_journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_wallet_idx ON wallet_journal_lines(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS trace_batch_idx ON trace_events(batch_id, occurred_at);
CREATE INDEX IF NOT EXISTS trace_retry_idx ON trace_events(next_retry_at) WHERE anchor_status IN ('unanchored','pending','failed');
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_logs(target_type, target_id, occurred_at);
COMMIT;
