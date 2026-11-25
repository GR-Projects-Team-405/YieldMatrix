import defaultPool from '../../config/db.js';
import {
  SQL_FIND_ACTIVE_LISTING_ON_BATCH,
  SQL_FIND_APPROVED_USER,
  SQL_FIND_BATCH_ENCUMBRANCE,
  SQL_FIND_FARM_BY_ID,
  SQL_FIND_LISTING_ALLOCATIONS,
  SQL_FIND_LISTING_AUDIT_LOGS,
  SQL_FIND_LISTING_BY_ID,
  SQL_FIND_LISTING_DETAILS_HEADER,
  SQL_FIND_LISTING_ORDERS,
  SQL_FIND_LISTINGS_BY_FARMER,
  SQL_FIND_OTHER_ACTIVE_LISTING_ON_BATCH,
  SQL_INSERT_AUDIT_LOG,
  SQL_INSERT_LISTING,
  SQL_LOCK_HARVEST_BATCH_FOR_UPDATE,
  SQL_LOCK_LISTING_FOR_UPDATE,
  SQL_UPDATE_LISTING_IN_PLACE,
  SQL_UPDATE_LISTING_STATUS,
} from './ym09.sql.js';

const UUID_REGEX = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function normalizeNullableUuid(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Creates a PostgreSQL repository scoped to a shared pool (injectable for testing).
 */
export function createYm09Repository(dbPool = defaultPool) {
  async function runInTransaction(work) {
    const client = await dbPool.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the originating database/domain error if ROLLBACK fails.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function findApprovedUser(userId, role, approvalStatus, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_APPROVED_USER, [
      userId,
      role,
      approvalStatus,
    ]);
    return rows[0] || null;
  }

  async function findListingsByFarmer(farmerId, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTINGS_BY_FARMER, [farmerId]);
    return rows;
  }

  async function findListingById(listingId, farmerId, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTING_BY_ID, [listingId, farmerId]);
    return rows[0] || null;
  }

  async function findListingDetailsHeader(listingId, farmerId, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTING_DETAILS_HEADER, [listingId, farmerId]);
    return rows[0] || null;
  }

  async function findListingAllocations(batchId, farmerId, createdAt, validUntil, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTING_ALLOCATIONS, [
      batchId,
      farmerId,
      createdAt,
      validUntil,
    ]);
    return rows;
  }

  async function findListingOrders(batchId, farmerId, createdAt, validUntil, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTING_ORDERS, [
      batchId,
      farmerId,
      createdAt,
      validUntil,
    ]);
    return rows;
  }

  async function findListingAuditLogs(listingId, executor = dbPool) {
    const { rows } = await executor.query(SQL_FIND_LISTING_AUDIT_LOGS, [listingId]);
    return rows;
  }

  async function lockListingForUpdate(listingId, client) {
    const { rows } = await client.query(SQL_LOCK_LISTING_FOR_UPDATE, [listingId]);
    return rows[0] || null;
  }

  async function findBatchEncumbrance(batchId, client) {
    const { rows } = await client.query(SQL_FIND_BATCH_ENCUMBRANCE, [batchId]);
    return rows[0] || { blocking_kg: '0', committed_kg: '0', disputed_count: '0' };
  }

  async function findBatchEncumbranceForReassign(batchId, client) {
    return findBatchEncumbrance(batchId, client);
  }

  async function findFarmById(farmId, client) {
    const { rows } = await client.query(SQL_FIND_FARM_BY_ID, [farmId]);
    return rows[0] || null;
  }

  async function lockHarvestBatchForUpdate(batchId, client) {
    const { rows } = await client.query(SQL_LOCK_HARVEST_BATCH_FOR_UPDATE, [batchId]);
    return rows[0] || null;
  }

  async function findActiveListingOnBatch(batchId, client) {
    const { rows } = await client.query(SQL_FIND_ACTIVE_LISTING_ON_BATCH, [batchId]);
    return rows[0] || null;
  }

  async function findOtherActiveListingOnBatch(batchId, excludeListingId, client) {
    const { rows } = await client.query(SQL_FIND_OTHER_ACTIVE_LISTING_ON_BATCH, [
      batchId,
      excludeListingId,
    ]);
    return rows[0] || null;
  }

  async function insertListing(
    { batchId, unitPriceCents, offeredKg, validFrom, validUntil, status },
    client
  ) {
    const { rows } = await client.query(SQL_INSERT_LISTING, [
      batchId,
      unitPriceCents,
      offeredKg,
      validFrom,
      validUntil,
      status,
    ]);
    return rows[0];
  }

  async function updateListingInPlace(
    { batchId, offeredKg, unitPriceCents, validFrom, validUntil, status, listingId },
    client
  ) {
    const { rows } = await client.query(SQL_UPDATE_LISTING_IN_PLACE, [
      batchId,
      offeredKg,
      unitPriceCents,
      validFrom,
      validUntil,
      status,
      listingId,
    ]);
    return rows[0];
  }

  async function updateListingStatus({ listingId, status }, client) {
    const { rows } = await client.query(SQL_UPDATE_LISTING_STATUS, [status, listingId]);
    return rows[0];
  }

  async function insertListingAudit(
    { actorId, action, listingId, requestId, reason, safeChanges },
    client
  ) {
    await client.query(SQL_INSERT_AUDIT_LOG, [
      actorId,
      action,
      listingId,
      normalizeNullableUuid(requestId),
      reason,
      JSON.stringify(safeChanges || {}),
    ]);
  }

  return {
    runInTransaction,
    findApprovedUser,
    findListingsByFarmer,
    findListingById,
    findListingDetailsHeader,
    findListingAllocations,
    findListingOrders,
    findListingAuditLogs,
    lockListingForUpdate,
    findBatchEncumbrance,
    findBatchEncumbranceForReassign,
    findFarmById,
    lockHarvestBatchForUpdate,
    findActiveListingOnBatch,
    findOtherActiveListingOnBatch,
    insertListing,
    updateListingInPlace,
    updateListingStatus,
    insertListingAudit,
  };
}

export const ym09Repository = createYm09Repository();
