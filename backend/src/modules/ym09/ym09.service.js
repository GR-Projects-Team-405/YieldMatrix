import {
  AUDIT_ACTION_CREATE,
  AUDIT_ACTION_PRICE_UPDATE,
  AUDIT_ACTION_STATUS_UPDATE,
  AUDIT_ACTION_UPDATE,
  FARM_ACTIVE_STATUS,
  HARVEST_BATCH_ELIGIBLE_STATUS,
  LISTING_STATUS,
  PG_UNIQUE_VIOLATION,
  YM09_MODULE_META,
  createConflictError,
  createForbiddenError,
  createNotFoundError,
  createUnauthorizedError,
  createValidationError,
} from './ym09.constants.js';
import {
  mapListingDetailsResponse,
  mapProduceListingByIdRow,
  mapProduceListingRow,
  mapUpdatedListingRow,
} from './ym09.mapper.js';
import { ym09Repository as defaultRepository } from './ym09.repository.js';
import {
  isValidListingTransition,
  validateCreateListingPayload,
  validateDateRange,
  validateListQueryParams,
  validateListingId,
  validateUpdateListingPayload,
  validateUpdateStatusPayload,
} from './ym09.validation.js';

function buildReassignmentBlockMessage(blockingKg, disputedCount) {
  if (disputedCount > 0 && blockingKg === 0) {
    return `Cannot reassign harvest batch: existing listing has ${disputedCount} unresolved disputed allocation(s).`;
  }
  if (disputedCount > 0) {
    return `Cannot reassign harvest batch: existing listing has active commitments or unresolved disputed allocations (${blockingKg} kg encumbered).`;
  }
  return `Cannot reassign harvest batch: existing listing has ${blockingKg} kg in active reservations or commitments.`;
}

/**
 * Creates the YM09 business service layer (repository injectable for unit tests).
 */
export function createYm09Service({ repository = defaultRepository } = {}) {
  async function assertApprovedFarmer(
    userId,
    userRole = YM09_MODULE_META.farmerRole,
    deniedMessage = 'Account is not approved'
  ) {
    if (!userId) {
      throw createUnauthorizedError('Authentication required');
    }

    if (userRole !== YM09_MODULE_META.farmerRole) {
      throw createForbiddenError(deniedMessage);
    }

    const user = await repository.findApprovedUser(
      userId,
      YM09_MODULE_META.farmerRole,
      YM09_MODULE_META.approvedAccountStatus
    );
    if (!user) {
      throw createForbiddenError(deniedMessage);
    }

    return user;
  }

  async function getModuleStatus({ userId, userRole }) {
    const user = await assertApprovedFarmer(userId, userRole, 'Account is not approved');

    return {
      module: YM09_MODULE_META.module,
      owner: YM09_MODULE_META.owner,
      status: YM09_MODULE_META.status,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    };
  }

  async function listFarmerProduceListings({ farmerId, userRole = YM09_MODULE_META.farmerRole, query }) {
    await assertApprovedFarmer(farmerId, userRole, 'Account is not approved');
    validateListQueryParams(query);
    const rows = await repository.findListingsByFarmer(farmerId);
    const listings = rows.map(mapProduceListingRow);

    return {
      data: listings,
      total: listings.length,
    };
  }

  async function getFarmerProduceListingById({
    listingId,
    farmerId,
    userRole = YM09_MODULE_META.farmerRole,
  }) {
    const validId = validateListingId(listingId);
    await assertApprovedFarmer(farmerId, userRole, 'Account is not approved');
    const row = await repository.findListingById(validId, farmerId);

    if (!row) {
      throw createNotFoundError('Produce listing not found');
    }

    return mapProduceListingByIdRow(row);
  }

  async function getFarmerProduceListingDetails({
    listingId,
    farmerId,
    userRole = YM09_MODULE_META.farmerRole,
  }) {
    const validId = validateListingId(listingId);
    await assertApprovedFarmer(farmerId, userRole, 'Account is not approved');
    const listingRow = await repository.findListingDetailsHeader(validId, farmerId);

    if (!listingRow) {
      throw createNotFoundError('Produce listing not found');
    }

    const [allocationRows, orderRows, auditRows] = await Promise.all([
      repository.findListingAllocations(
        listingRow.batchId,
        farmerId,
        listingRow.createdAt,
        listingRow.validUntil
      ),
      repository.findListingOrders(
        listingRow.batchId,
        farmerId,
        listingRow.createdAt,
        listingRow.validUntil
      ),
      repository.findListingAuditLogs(validId),
    ]);

    return mapListingDetailsResponse({
      listingRow,
      allocationRows,
      orderRows,
      auditRows,
    });
  }

  async function updateFarmerProduceListing({
    listingId,
    farmerId,
    userRole = YM09_MODULE_META.farmerRole,
    requestId,
    payload,
  }) {
    const validId = validateListingId(listingId);
    const sanitized = validateUpdateListingPayload(payload);

    // 1. Verify caller role and approval before acquiring row locks
    await assertApprovedFarmer(
      farmerId,
      userRole,
      'Account is not approved for farmer operations'
    );

    return repository.runInTransaction(async (client) => {
      // 2. Lock existing listing row for update
      const currentListing = await repository.lockListingForUpdate(validId, client);
      if (!currentListing) {
        throw createNotFoundError('Produce listing not found');
      }

      if (currentListing.farmer_id !== farmerId) {
        throw createForbiddenError('You do not own this produce listing');
      }

      const targetBatchId = sanitized.batchId || currentListing.batch_id;
      const updatedOfferedKg =
        sanitized.offeredKg !== undefined ? sanitized.offeredKg : currentListing.offered_kg;
      const updatedUnitPrice =
        sanitized.unitPriceCents !== undefined
          ? sanitized.unitPriceCents
          : currentListing.unit_price_cents;
      const updatedValidFrom = sanitized.validFrom || currentListing.valid_from;
      const updatedValidUntil = sanitized.validUntil || currentListing.valid_until;

      validateDateRange(updatedValidFrom, updatedValidUntil);

      const updatedStatus = sanitized.status || currentListing.status;
      if (
        sanitized.status !== undefined &&
        !isValidListingTransition(currentListing.status, updatedStatus)
      ) {
        throw createConflictError(
          `Invalid listing status transition: ${currentListing.status} -> ${updatedStatus}`
        );
      }

      const isActivating =
        updatedStatus === LISTING_STATUS.ACTIVE &&
        currentListing.status !== LISTING_STATUS.ACTIVE;

      // 3. Batch Stock, Eligibility & Reassignment Validation (under batch FOR UPDATE locks)
      if (targetBatchId !== currentListing.batch_id) {
        const currentBatch = await repository.lockHarvestBatchForUpdate(
          currentListing.batch_id,
          client
        );
        if (currentBatch && currentBatch.farmer_id !== farmerId) {
          throw createForbiddenError('You do not own this harvest batch');
        }

        const encumbrance = await repository.findBatchEncumbrance(
          currentListing.batch_id,
          client
        );
        const blockingKg = parseFloat(encumbrance.blocking_kg || '0');
        const disputedCount = parseInt(encumbrance.disputed_count || '0', 10);

        if (blockingKg > 0 || disputedCount > 0) {
          throw createConflictError(buildReassignmentBlockMessage(blockingKg, disputedCount));
        }

        const targetBatch = await repository.lockHarvestBatchForUpdate(targetBatchId, client);
        if (!targetBatch) {
          throw createNotFoundError('Target harvest batch not found');
        }

        if (targetBatch.farmer_id !== farmerId) {
          throw createForbiddenError('Target harvest batch does not belong to your account');
        }

        if (sanitized.farmId && sanitized.farmId !== targetBatch.farm_id) {
          throw createValidationError('Selected farm does not match the target harvest batch');
        }

        if (targetBatch.status !== HARVEST_BATCH_ELIGIBLE_STATUS) {
          throw createValidationError('Harvest batch must be in harvested status before listing');
        }

        const existingActive = await repository.findOtherActiveListingOnBatch(
          targetBatchId,
          validId,
          client
        );
        if (existingActive) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }

        const targetEncumbrance = await repository.findBatchEncumbrance(targetBatchId, client);
        const targetHolds = parseFloat(targetEncumbrance.blocking_kg || '0');
        const targetAvailable = parseFloat(targetBatch.sellable_kg || '0') - targetHolds;
        const qty =
          sanitized.offeredKg !== undefined
            ? sanitized.offeredKg
            : parseFloat(currentListing.offered_kg);

        if (qty > targetAvailable) {
          throw createValidationError(
            `Offered quantity (${qty} kg) exceeds available uncommitted stock on the new batch (${targetAvailable} kg)`
          );
        }
      } else {
        // Same-batch edit: lock harvest batch row & verify uncommitted stock and existing commitments
        const currentBatch = await repository.lockHarvestBatchForUpdate(
          currentListing.batch_id,
          client
        );
        if (!currentBatch) {
          throw createNotFoundError('Harvest batch not found');
        }

        if (currentBatch.farmer_id !== farmerId) {
          throw createForbiddenError('Harvest batch does not belong to your account');
        }

        if (sanitized.farmId && sanitized.farmId !== currentBatch.farm_id) {
          throw createValidationError('Selected farm does not match the harvest batch');
        }

        if (isActivating) {
          if (currentBatch.status !== HARVEST_BATCH_ELIGIBLE_STATUS) {
            throw createValidationError(
              'Harvest batch must be in harvested status before listing'
            );
          }

          const existingActive = await repository.findOtherActiveListingOnBatch(
            targetBatchId,
            validId,
            client
          );
          if (existingActive) {
            throw createConflictError('Target harvest batch already has an active produce listing');
          }
        }

        const encumbrance = await repository.findBatchEncumbrance(
          currentListing.batch_id,
          client
        );
        const blockingKg = parseFloat(encumbrance.blocking_kg || '0');
        const currentOffered = parseFloat(currentListing.offered_kg || '0');
        const nextOffered = parseFloat(updatedOfferedKg);
        const batchSellableKg = parseFloat(currentBatch.sellable_kg || '0');

        const isQuantityEdited = sanitized.offeredKg !== undefined;
        if (isQuantityEdited || isActivating) {
          if (nextOffered < blockingKg) {
            throw createConflictError(
              `Cannot reduce offered quantity (${nextOffered} kg) below active reserved, committed, or disputed obligations (${blockingKg} kg).`
            );
          }

          if (nextOffered > currentOffered && currentBatch.status !== HARVEST_BATCH_ELIGIBLE_STATUS) {
            throw createValidationError(
              'Harvest batch must be in harvested status before increasing offered quantity'
            );
          }

          if (nextOffered > batchSellableKg) {
            throw createValidationError(
              `Offered quantity (${nextOffered} kg) exceeds available harvest batch sellable stock (${batchSellableKg} kg)`
            );
          }
        }
      }

      // 4. Update listing in-place preserving listing ID and historical traceability
      let updatedRow;
      try {
        updatedRow = await repository.updateListingInPlace(
          {
            batchId: targetBatchId,
            offeredKg: updatedOfferedKg,
            unitPriceCents: updatedUnitPrice,
            validFrom: updatedValidFrom,
            validUntil: updatedValidUntil,
            status: updatedStatus,
            listingId: validId,
          },
          client
        );
      } catch (error) {
        if (error?.code === PG_UNIQUE_VIOLATION) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }
        throw error;
      }

      // 5. Audit unit price changes & non-price listing changes when modified
      const oldPriceInt = parseInt(currentListing.unit_price_cents, 10);
      const newPriceInt = parseInt(updatedUnitPrice, 10);
      if (newPriceInt !== oldPriceInt) {
        await repository.insertListingAudit(
          {
            actorId: farmerId,
            action: AUDIT_ACTION_PRICE_UPDATE,
            listingId: validId,
            requestId,
            reason: 'Produce listing unit price updated by farmer',
            safeChanges: {
              unit_price_cents: {
                old: oldPriceInt,
                new: newPriceInt,
              },
            },
          },
          client
        );
      }

      const nonPriceChanges = {};
      const prevOfferedNum = parseFloat(currentListing.offered_kg);
      const nextOfferedNum = parseFloat(updatedOfferedKg);
      if (nextOfferedNum !== prevOfferedNum) {
        nonPriceChanges.offered_kg = { old: prevOfferedNum, new: nextOfferedNum };
      }
      if (String(updatedValidFrom) !== String(currentListing.valid_from)) {
        nonPriceChanges.valid_from = {
          old: currentListing.valid_from,
          new: updatedValidFrom,
        };
      }
      if (String(updatedValidUntil) !== String(currentListing.valid_until)) {
        nonPriceChanges.valid_until = {
          old: currentListing.valid_until,
          new: updatedValidUntil,
        };
      }
      if (updatedStatus !== currentListing.status) {
        nonPriceChanges.status = { old: currentListing.status, new: updatedStatus };
      }
      if (targetBatchId !== currentListing.batch_id) {
        nonPriceChanges.batch_id = { old: currentListing.batch_id, new: targetBatchId };
      }

      if (Object.keys(nonPriceChanges).length > 0) {
        await repository.insertListingAudit(
          {
            actorId: farmerId,
            action: AUDIT_ACTION_UPDATE,
            listingId: validId,
            requestId,
            reason: 'Produce listing updated by farmer',
            safeChanges: nonPriceChanges,
          },
          client
        );
      }

      return mapUpdatedListingRow(updatedRow);
    });
  }

  async function createFarmerProduceListing({
    farmerId,
    userRole = YM09_MODULE_META.farmerRole,
    requestId,
    payload,
  }) {
    const sanitized = validateCreateListingPayload(payload);

    // 1. Verify caller role and approval before acquiring row locks
    await assertApprovedFarmer(
      farmerId,
      userRole,
      'Account is not approved for farmer operations'
    );

    return repository.runInTransaction(async (client) => {
      // 2. Verify farm exists, belongs to farmer, and is active
      const farm = await repository.findFarmById(sanitized.farmId, client);
      if (!farm) {
        throw createNotFoundError('Farm not found');
      }
      if (farm.farmer_id !== farmerId) {
        throw createForbiddenError('Farm does not belong to your account');
      }
      if (farm.status !== FARM_ACTIVE_STATUS) {
        throw createValidationError('Selected farm must be active before listing');
      }

      // 3. Lock target harvest batch (FOR UPDATE serializes concurrent creates on the same batch)
      const batch = await repository.lockHarvestBatchForUpdate(sanitized.batchId, client);
      if (!batch) {
        throw createNotFoundError('Harvest batch not found');
      }
      if (batch.farmer_id !== farmerId) {
        throw createForbiddenError('Harvest batch does not belong to your account');
      }
      if (batch.farm_id !== sanitized.farmId) {
        throw createValidationError('Selected farm does not match the harvest batch origin');
      }
      if (batch.status !== HARVEST_BATCH_ELIGIBLE_STATUS) {
        throw createValidationError('Harvest batch must be in harvested status before listing');
      }

      const actualKg = parseFloat(batch.actual_kg ?? '0');
      const sellableKg = parseFloat(batch.sellable_kg ?? '0');
      if (actualKg <= 0 || sellableKg <= 0) {
        throw createValidationError('Harvest batch has no available sellable stock to list');
      }

      // 4. Enforce one active listing per batch before insert
      if (sanitized.status === LISTING_STATUS.ACTIVE) {
        const existingActive = await repository.findActiveListingOnBatch(
          sanitized.batchId,
          client
        );
        if (existingActive) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }
      }

      // 5. Enforce available uncommitted stock bound (DR-01)
      const encumbrance = await repository.findBatchEncumbrance(sanitized.batchId, client);
      const blockingKg = parseFloat(encumbrance.blocking_kg || '0');
      const eligibleAvailableKg = Math.max(0, sellableKg - blockingKg);

      if (eligibleAvailableKg <= 0 || sanitized.offeredKg > eligibleAvailableKg) {
        throw createValidationError(
          `Offered quantity (${sanitized.offeredKg} kg) exceeds available uncommitted stock on this batch (${eligibleAvailableKg} kg)`
        );
      }

      // 6. Insert listing cleanly with unique index safety fallback
      let inserted;
      try {
        inserted = await repository.insertListing(sanitized, client);
      } catch (error) {
        if (error?.code === PG_UNIQUE_VIOLATION) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }
        throw error;
      }

      // 7. Write audit record for listing creation
      await repository.insertListingAudit(
        {
          actorId: farmerId,
          action: AUDIT_ACTION_CREATE,
          listingId: inserted.id,
          requestId,
          reason: 'Produce listing created by farmer',
          safeChanges: {
            batch_id: { new: sanitized.batchId },
            status: { new: sanitized.status },
            offered_kg: { new: sanitized.offeredKg },
            unit_price_cents: { new: sanitized.unitPriceCents },
          },
        },
        client
      );

      // 8. Return enriched camelCase listing DTO consistent with GET /produce/:id
      const createdRow = await repository.findListingById(inserted.id, farmerId, client);
      return mapProduceListingByIdRow(createdRow);
    });
  }

  async function updateFarmerProduceListingStatus({
    listingId,
    farmerId,
    userRole = YM09_MODULE_META.farmerRole,
    requestId,
    payload,
  }) {
    const validId = validateListingId(listingId);
    const { status: nextStatus } = validateUpdateStatusPayload(payload);

    await assertApprovedFarmer(
      farmerId,
      userRole,
      'Account is not approved for farmer operations'
    );

    return repository.runInTransaction(async (client) => {
      const currentListing = await repository.lockListingForUpdate(validId, client);
      if (!currentListing) {
        throw createNotFoundError('Produce listing not found');
      }

      if (currentListing.farmer_id !== farmerId) {
        throw createForbiddenError('You do not own this produce listing');
      }

      if (!isValidListingTransition(currentListing.status, nextStatus)) {
        throw createConflictError(
          `Invalid listing status transition: ${currentListing.status} -> ${nextStatus}`
        );
      }

      const currentBatch = await repository.lockHarvestBatchForUpdate(
        currentListing.batch_id,
        client
      );
      if (!currentBatch) {
        throw createNotFoundError('Harvest batch not found');
      }
      if (currentBatch.farmer_id !== farmerId) {
        throw createForbiddenError('Harvest batch does not belong to your account');
      }

      const isActivating =
        nextStatus === LISTING_STATUS.ACTIVE &&
        currentListing.status !== LISTING_STATUS.ACTIVE;

      if (isActivating) {
        if (currentBatch.status !== HARVEST_BATCH_ELIGIBLE_STATUS) {
          throw createValidationError(
            'Harvest batch must be in harvested status before activating listing'
          );
        }

        const existingActive = await repository.findOtherActiveListingOnBatch(
          currentListing.batch_id,
          validId,
          client
        );
        if (existingActive) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }

        const encumbrance = await repository.findBatchEncumbrance(
          currentListing.batch_id,
          client
        );
        const blockingKg = parseFloat(encumbrance.blocking_kg || '0');
        const batchSellableKg = parseFloat(currentBatch.sellable_kg || '0');
        const offeredKg = parseFloat(currentListing.offered_kg || '0');

        if (offeredKg < blockingKg) {
          throw createConflictError(
            `Cannot activate listing: offered quantity (${offeredKg} kg) is below active obligations (${blockingKg} kg)`
          );
        }
        if (batchSellableKg <= 0 || offeredKg > batchSellableKg) {
          throw createValidationError(
            `Cannot activate listing: insufficient eligible harvest batch sellable stock (${batchSellableKg} kg available for ${offeredKg} kg offered)`
          );
        }
      }

      let updatedRow;
      try {
        updatedRow = await repository.updateListingStatus(
          { listingId: validId, status: nextStatus },
          client
        );
      } catch (error) {
        if (error?.code === PG_UNIQUE_VIOLATION) {
          throw createConflictError('Target harvest batch already has an active produce listing');
        }
        throw error;
      }

      if (nextStatus !== currentListing.status) {
        await repository.insertListingAudit(
          {
            actorId: farmerId,
            action: AUDIT_ACTION_STATUS_UPDATE,
            listingId: validId,
            requestId,
            reason: `Listing status updated from ${currentListing.status} to ${nextStatus}`,
            safeChanges: {
              status: {
                old: currentListing.status,
                new: nextStatus,
              },
            },
          },
          client
        );
      }

      return mapUpdatedListingRow(updatedRow);
    });
  }

  return {
    getModuleStatus,
    listFarmerProduceListings,
    getFarmerProduceListingById,
    getFarmerProduceListingDetails,
    createFarmerProduceListing,
    updateFarmerProduceListing,
    updateFarmerProduceListingStatus,
  };
}

export const ym09Service = createYm09Service();
