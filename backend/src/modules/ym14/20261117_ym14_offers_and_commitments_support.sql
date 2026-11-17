-- YieldMatrix Schema Proposal
-- Module: YM14 (Offers and Commitments)
-- Feature: Quality specifications, offer rejection reasons, and commitment index optimization
-- File: 20261117_ym14_offers_and_commitments_support.sql
-- Author: Mohomad Mushrif (YM14)
-- Date: 17 November 2026
-- Shared database status: PROPOSED (Not applied - awaiting Team Lead review)

-- ============================================================================
-- REASON & CONTEXT
-- ============================================================================
-- 1. YM14 Received Offer Details (Figma screen YM14_01) requires storing
--    farmer quality notes, quality checklist verification data (grading, color,
--    firmness, sizing), and structured decline reasons when a buyer rejects an offer.
-- 2. YM14 Commitments List (Figma screen YM14_03) queries commitments heavily
--    by buyer_id, farmer_id, and status. Indexes ensure fast filtering under 200ms.
-- 3. Pre-harvest modification proposals (Figma screen YM14_05) will leverage the
--    existing 'revisions' JSONB and 'decisions' JSONB columns in 'future_commitments'
--    to preserve immutable append-only audit trails without changing table structure.

-- ============================================================================
-- SQL CHANGES
-- ============================================================================

BEGIN;

-- 1. Add notes, quality verification specifications, and decline reason to offers
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS quality_specs JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- 2. Performance indexes for commitments dashboard filtering
CREATE INDEX IF NOT EXISTS future_commitments_buyer_status_idx 
  ON future_commitments(buyer_id, status);

CREATE INDEX IF NOT EXISTS future_commitments_farmer_status_idx 
  ON future_commitments(farmer_id, status);

CREATE INDEX IF NOT EXISTS offers_status_idx 
  ON offers(status);

COMMIT;

-- ============================================================================
-- IMPACT ASSESSMENT
-- ============================================================================
-- Existing data: Safe. ADD COLUMN IF NOT EXISTS with defaults preserves existing rows.
-- Affected modules:
--   - YM10 (Farmer Offers): Can optionally populate 'notes' and 'quality_specs' on creation.
--   - YM14 (Offers & Commitments): Consumes notes, sets decline_reason on reject.
-- Recovery / Rollback:
--   ALTER TABLE offers DROP COLUMN IF EXISTS notes;
--   ALTER TABLE offers DROP COLUMN IF EXISTS quality_specs;
--   ALTER TABLE offers DROP COLUMN IF EXISTS decline_reason;
--   DROP INDEX IF EXISTS future_commitments_buyer_status_idx;
--   DROP INDEX IF EXISTS future_commitments_farmer_status_idx;
--   DROP INDEX IF EXISTS offers_status_idx;
