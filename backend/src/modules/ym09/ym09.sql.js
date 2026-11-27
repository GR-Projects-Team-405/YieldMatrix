import {
  AUDIT_TARGET_TYPE_LISTING,
  COMMITTED_ALLOCATION_STATUSES,
  ENCUMBERED_ALLOCATION_STATUSES,
  LISTING_STATUS,
} from './ym09.constants.js';

const formatSqlList = (values) => values.map((v) => `'${v}'`).join(', ');

const ENCUMBERED_STATUS_LIST_SQL = formatSqlList(ENCUMBERED_ALLOCATION_STATUSES);
const COMMITTED_STATUS_LIST_SQL = formatSqlList(COMMITTED_ALLOCATION_STATUSES);

/**
 * Builds the canonical SQL expression calculating active encumbered stock (DR-01):
 * - held & supplier_accepted lock agreed_kg
 * - committed & disputed lock uncollected (committed_kg - picked_up_kg)
 */
export function buildEncumberedKgCaseSql(alias = 'a') {
  return `SUM(
    CASE
      WHEN ${alias}.status IN ('held', 'supplier_accepted') THEN ${alias}.agreed_kg
      WHEN ${alias}.status IN ('committed', 'disputed') THEN GREATEST(0, ${alias}.committed_kg - ${alias}.picked_up_kg)
      ELSE 0
    END
  )`;
}

/**
 * Builds the canonical SQL subquery calculating active encumbered stock (DR-01):
 * Reserved kg = active holds (held, supplier_accepted) + uncollected commitments/disputes.
 * Cancelled, declined, expired, and already picked-up quantities contribute 0.
 */
function buildListingReservedSubquery() {
  return `COALESCE((
    SELECT ${buildEncumberedKgCaseSql('a')}
    FROM allocations a
    WHERE a.batch_id = l.batch_id
      AND a.status IN (${ENCUMBERED_STATUS_LIST_SQL})
  ), 0)`;
}

/**
 * Builds the canonical SQL subquery calculating uncollected committed stock (DR-01):
 * Always subtracts picked_up_kg so collected quantities are never counted twice.
 */
function buildListingCommittedSubquery() {
  return `COALESCE((
    SELECT SUM(GREATEST(0, a.committed_kg - a.picked_up_kg))
    FROM allocations a
    WHERE a.batch_id = l.batch_id
      AND a.status IN (${COMMITTED_STATUS_LIST_SQL})
  ), 0)`;
}

export const SQL_FIND_APPROVED_USER = `
  SELECT id, name, role, approval_status
  FROM users
  WHERE id = $1 AND role = $2 AND approval_status = $3
`;

export function buildFindListingsByFarmerSql(includeImageKey = true) {
  const imageSelect = includeImageKey ? `\n         l.image_key AS "imageKey",` : '';
  return `
  SELECT l.id,
         l.batch_id AS "batchId",
         l.offered_kg AS "offeredKg",
         l.unit_price_cents AS "unitPriceCents",
         l.valid_from AS "validFrom",
         l.valid_until AS "validUntil",
         l.status,${imageSelect}
         l.created_at AS "createdAt",
         c.name AS "cropName",
         g.name AS "gradeName",
         f.name AS "farmName",
         f.id AS "farmId",
         f.district,
         ${buildListingReservedSubquery(false)} AS "reservedKg",
         ${buildListingCommittedSubquery(false)} AS "committedKg"
  FROM listings l
  JOIN harvest_batches hb ON l.batch_id = hb.id
  JOIN crops c ON hb.crop_id = c.id
  JOIN grades g ON hb.grade_id = g.id
  JOIN farms f ON hb.farm_id = f.id
  WHERE hb.farmer_id = $1
  ORDER BY l.created_at DESC
`;
}

export const SQL_FIND_LISTINGS_BY_FARMER = buildFindListingsByFarmerSql(true);
export const SQL_FIND_LISTINGS_BY_FARMER_NO_IMAGE = buildFindListingsByFarmerSql(false);

export function buildFindListingByIdSql(includeImageKey = true) {
  const imageSelect = includeImageKey ? `\n         l.image_key AS "imageKey",` : '';
  return `
  SELECT l.id,
         l.batch_id AS "batchId",
         l.offered_kg AS "offeredKg",
         l.unit_price_cents AS "unitPriceCents",
         l.valid_from AS "validFrom",
         l.valid_until AS "validUntil",
         l.status,${imageSelect}
         l.created_at AS "createdAt",
         c.name AS "cropName",
         g.name AS "gradeName",
         f.name AS "farmName",
         f.id AS "farmId",
         f.district,
         hb.farmer_id AS "farmerId",
         COALESCE('HB-' || UPPER(SUBSTRING(hb.id::text, 1, 8)), 'HB-UNKNOWN') AS "batchNumber",
         hb.actual_kg AS "actualKg",
         hb.sellable_kg AS "sellableKg",
         ${buildListingReservedSubquery(false)} AS "reservedKg",
         ${buildListingCommittedSubquery(false)} AS "committedKg"
  FROM listings l
  JOIN harvest_batches hb ON l.batch_id = hb.id
  JOIN crops c ON hb.crop_id = c.id
  JOIN grades g ON hb.grade_id = g.id
  JOIN farms f ON hb.farm_id = f.id
  WHERE l.id = $1 AND hb.farmer_id = $2
`;
}

export const SQL_FIND_LISTING_BY_ID = buildFindListingByIdSql(true);
export const SQL_FIND_LISTING_BY_ID_NO_IMAGE = buildFindListingByIdSql(false);

export function buildFindListingDetailsHeaderSql(includeImageKey = true) {
  const imageSelect = includeImageKey ? `\n         l.image_key AS "imageKey",` : '';
  return `
  SELECT l.id,
         l.batch_id AS "batchId",
         l.offered_kg AS "offeredKg",
         l.unit_price_cents AS "unitPriceCents",
         l.valid_from AS "validFrom",
         l.valid_until AS "validUntil",
         l.status,${imageSelect}
         l.created_at AS "createdAt",
         c.name AS "cropName",
         g.name AS "gradeName",
         f.name AS "farmName",
         f.id AS "farmId",
         f.district,
         hb.farmer_id AS "farmerId",
         COALESCE('HB-' || UPPER(SUBSTRING(hb.id::text, 1, 8)), 'HB-UNKNOWN') AS "batchNumber",
         hb.actual_kg AS "actualKg",
         hb.sellable_kg AS "sellableKg",
         ${buildListingReservedSubquery()} AS "reservedKg",
         ${buildListingCommittedSubquery()} AS "committedKg"
  FROM listings l
  JOIN harvest_batches hb ON l.batch_id = hb.id
  JOIN crops c ON hb.crop_id = c.id
  JOIN grades g ON hb.grade_id = g.id
  JOIN farms f ON hb.farm_id = f.id
  WHERE l.id = $1 AND hb.farmer_id = $2
`;
}

export const SQL_FIND_LISTING_DETAILS_HEADER = buildFindListingDetailsHeaderSql(true);
export const SQL_FIND_LISTING_DETAILS_HEADER_NO_IMAGE = buildFindListingDetailsHeaderSql(false);

export const SQL_FIND_LISTING_ALLOCATIONS = `
  SELECT a.id,
         a.order_id AS "orderId",
         a.agreed_kg AS "allocatedKg",
         a.agreed_unit_price_cents AS "agreedUnitPriceCents",
         a.agreed_value_cents AS "agreedValueCents",
         a.status,
         a.created_at AS "allocatedOn",
         u.name AS "buyerName"
  FROM allocations a
  JOIN orders o ON a.order_id = o.id
  JOIN users u ON o.buyer_id = u.id
  WHERE a.batch_id = $1
    AND a.farmer_id = $2
    AND a.created_at >= $3
    AND a.created_at <= $4
  ORDER BY a.created_at DESC
`;

export const SQL_FIND_LISTING_ORDERS = `
  SELECT DISTINCT o.id,
         o.created_at AS "orderDate",
         o.status,
         a.agreed_value_cents AS "allocationValueCents",
         a.agreed_kg AS "orderKg",
         u.name AS "buyerName"
  FROM orders o
  JOIN allocations a ON a.order_id = o.id
  JOIN users u ON o.buyer_id = u.id
  WHERE a.batch_id = $1
    AND a.farmer_id = $2
    AND a.created_at >= $3
    AND a.created_at <= $4
  ORDER BY o.created_at DESC
`;

export const SQL_FIND_LISTING_AUDIT_LOGS = `
  SELECT al.id,
         al.action,
         al.safe_changes AS "safeChanges",
         al.occurred_at AS "timestamp",
         al.reason,
         u.name AS "actorName"
  FROM audit_logs al
  LEFT JOIN users u ON al.actor_id = u.id
  WHERE al.target_type = '${AUDIT_TARGET_TYPE_LISTING}' AND al.target_id = $1
  ORDER BY al.occurred_at DESC
`;

export function buildLockListingForUpdateSql(includeImageKey = true) {
  const imageSelect = includeImageKey ? `\n         l.image_key,` : '';
  return `
  SELECT l.id,
         l.batch_id,
         l.offered_kg,
         l.unit_price_cents,
         l.valid_from,
         l.valid_until,
         l.status,${imageSelect}
         hb.farmer_id,
         hb.farm_id
  FROM listings l
  JOIN harvest_batches hb ON l.batch_id = hb.id
  WHERE l.id = $1
  FOR UPDATE OF l
`;
}

export const SQL_LOCK_LISTING_FOR_UPDATE = buildLockListingForUpdateSql(true);
export const SQL_LOCK_LISTING_FOR_UPDATE_NO_IMAGE = buildLockListingForUpdateSql(false);

export function buildFindListingOwnerStatusSql(includeImageKey = true) {
  const imageSelect = includeImageKey ? `\n         l.image_key,` : '';
  return `
  SELECT l.id,
         l.status,${imageSelect}
         hb.farmer_id
  FROM listings l
  JOIN harvest_batches hb ON l.batch_id = hb.id
  WHERE l.id = $1
`;
}

export const SQL_FIND_LISTING_OWNER_STATUS = buildFindListingOwnerStatusSql(true);
export const SQL_FIND_LISTING_OWNER_STATUS_NO_IMAGE = buildFindListingOwnerStatusSql(false);

export const SQL_FIND_BATCH_ENCUMBRANCE = `
  SELECT
    COALESCE(${buildEncumberedKgCaseSql('a')}, 0) AS blocking_kg,
    COALESCE(SUM(GREATEST(0, a.committed_kg - a.picked_up_kg)) FILTER (WHERE a.status IN (${COMMITTED_STATUS_LIST_SQL})), 0) AS committed_kg,
    COUNT(*) FILTER (WHERE a.status = 'disputed') AS disputed_count
  FROM allocations a
  WHERE a.batch_id = $1
    AND a.status IN (${ENCUMBERED_STATUS_LIST_SQL})
`;

export const SQL_FIND_BATCH_ENCUMBRANCE_FOR_REASSIGN = SQL_FIND_BATCH_ENCUMBRANCE;

export const SQL_FIND_FARM_BY_ID = `
  SELECT id, farmer_id, name, district, status
  FROM farms
  WHERE id = $1
`;

export const SQL_LOCK_HARVEST_BATCH_FOR_UPDATE = `
  SELECT id, farmer_id, farm_id, status, actual_kg, sellable_kg
  FROM harvest_batches
  WHERE id = $1
  FOR UPDATE
`;

export const SQL_FIND_ACTIVE_LISTING_ON_BATCH = `
  SELECT id
  FROM listings
  WHERE batch_id = $1
    AND status = '${LISTING_STATUS.ACTIVE}'
`;

export const SQL_FIND_OTHER_ACTIVE_LISTING_ON_BATCH = `
  SELECT id
  FROM listings
  WHERE batch_id = $1
    AND status = '${LISTING_STATUS.ACTIVE}'
    AND id <> $2
`;

export function buildUpdateListingInPlaceSql(includeImageKey = true) {
  const imageReturn = includeImageKey ? `\n            image_key AS "imageKey",` : '';
  return `
  UPDATE listings
  SET batch_id = $1,
      offered_kg = $2,
      unit_price_cents = $3,
      valid_from = $4,
      valid_until = $5,
      status = $6
  WHERE id = $7
  RETURNING id,
            batch_id AS "batchId",
            offered_kg AS "offeredKg",
            unit_price_cents AS "unitPriceCents",
            valid_from AS "validFrom",
            valid_until AS "validUntil",
            status,${imageReturn}
            created_at AS "createdAt"
`;
}

export const SQL_UPDATE_LISTING_IN_PLACE = buildUpdateListingInPlaceSql(true);
export const SQL_UPDATE_LISTING_IN_PLACE_NO_IMAGE = buildUpdateListingInPlaceSql(false);

export const SQL_INSERT_LISTING = `
  INSERT INTO listings (
    batch_id,
    unit_price_cents,
    offered_kg,
    valid_from,
    valid_until,
    status
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id
`;

export function buildUpdateListingStatusSql(includeImageKey = true) {
  const imageReturn = includeImageKey ? `\n            image_key AS "imageKey",` : '';
  return `
  UPDATE listings
  SET status = $1
  WHERE id = $2
  RETURNING id,
            batch_id AS "batchId",
            offered_kg AS "offeredKg",
            unit_price_cents AS "unitPriceCents",
            valid_from AS "validFrom",
            valid_until AS "validUntil",
            status,${imageReturn}
            created_at AS "createdAt"
`;
}

export const SQL_UPDATE_LISTING_STATUS = buildUpdateListingStatusSql(true);
export const SQL_UPDATE_LISTING_STATUS_NO_IMAGE = buildUpdateListingStatusSql(false);

export const SQL_UPDATE_LISTING_IMAGE_KEY = `
  UPDATE listings
  SET image_key = $1
  WHERE id = $2
  RETURNING id,
            image_key AS "imageKey"
`;

export const SQL_INSERT_AUDIT_LOG = `
  INSERT INTO audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    request_id,
    reason,
    safe_changes,
    occurred_at
  )
  VALUES ($1, $2, '${AUDIT_TARGET_TYPE_LISTING}', $3, $4, $5, $6, now())
`;
