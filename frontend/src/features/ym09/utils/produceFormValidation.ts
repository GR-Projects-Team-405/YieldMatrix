import type {
  AddProduceValidationErrors,
  HarvestBatchOption,
  ProduceListingFormState,
  ProduceListingView,
} from '../types/produce';

export interface HarvestSourceLockState {
  activeHolds: number;
  isSourceLocked: boolean;
  lockReason?: string;
}

export interface StockValidationBounds {
  minAvailableKg: number;
  maxAvailableKg?: number;
}

/**
 * Determines whether harvest source fields (Farm / Batch) must be locked during edit.
 * Per backend DR-01 semantics, `reservedKg` already includes active reservations
 * and uncollected committed/disputed stock; `committedKg` is an informational subset.
 */
export function getHarvestSourceLockState(
  mode: 'create' | 'edit',
  existingListing?: ProduceListingView
): HarvestSourceLockState {
  const activeHolds = existingListing?.reservedKg || 0;
  const committedSubset = existingListing?.committedKg || 0;
  const isSourceLocked = mode === 'edit' && activeHolds > 0;

  if (!isSourceLocked) {
    return { activeHolds, isSourceLocked: false, lockReason: undefined };
  }

  const effectiveCommitted = Math.min(activeHolds, committedSubset);
  const nonCommittedReserved = Math.max(0, activeHolds - effectiveCommitted);

  const parts: string[] = [];
  if (nonCommittedReserved > 0) parts.push(`${nonCommittedReserved} kg reserved`);
  if (effectiveCommitted > 0) parts.push(`${effectiveCommitted} kg committed`);
  if (parts.length === 0) parts.push(`${activeHolds} kg reserved`);

  return {
    activeHolds,
    isSourceLocked: true,
    lockReason: `Harvest source cannot be changed because this listing has ${parts.join(' and ')}. Reassigning batches under active holds is prevented to protect order allocations and traceability.`,
  };
}

/**
 * Computes permissible [minAvailableKg, maxAvailableKg] stock bounds (Rule DR-01 & Safe Reassignment).
 *
 * - CREATE mode:
 *     Max allowable = batch.availableStockKg (unencumbered sellable stock in batch)
 *     Min allowable = 1 kg
 * - EDIT mode (Same batch as existing listing):
 *     Max allowable = batch.availableStockKg + existingListing.availableKg
 *     Min allowable = activeHolds > 0 ? activeHolds : 1
 * - EDIT mode (Reassigned to another batch when activeHolds === 0):
 *     Max allowable = batch.availableStockKg (new batch unencumbered stock)
 *     Min allowable = 1 kg
 */
export function calculateStockValidationBounds(params: {
  mode: 'create' | 'edit';
  existingListing?: ProduceListingView;
  currentBatch?: HarvestBatchOption;
  activeHolds: number;
}): StockValidationBounds {
  const { mode, existingListing, currentBatch, activeHolds } = params;

  if (mode === 'edit' && existingListing) {
    const isSameBatch = Boolean(currentBatch && currentBatch.id === existingListing.batchId);

    if (isSameBatch && currentBatch) {
      return {
        minAvailableKg: activeHolds > 0 ? activeHolds : 1,
        maxAvailableKg: currentBatch.availableStockKg + existingListing.availableKg,
      };
    }

    return {
      minAvailableKg: 1,
      maxAvailableKg: currentBatch ? currentBatch.availableStockKg : undefined,
    };
  }

  return {
    minAvailableKg: 1,
    maxAvailableKg: currentBatch ? currentBatch.availableStockKg : undefined,
  };
}

/**
 * Validates all produce listing form fields against required rules and stock/date bounds.
 */
export function validateProduceListingForm(
  formState: ProduceListingFormState,
  bounds: StockValidationBounds
): AddProduceValidationErrors {
  const newErrors: AddProduceValidationErrors = {};
  const { minAvailableKg, maxAvailableKg } = bounds;

  if (!formState.farmId) {
    newErrors.farmId = 'Please select a certified farm.';
  }
  if (!formState.cropId) {
    newErrors.cropId = 'Please select a crop type.';
  }
  if (!formState.batchId) {
    newErrors.batchId = 'Please select an eligible harvest batch.';
  }
  if (!formState.gradeId) {
    newErrors.gradeId = 'Please select a quality grade.';
  }

  if (formState.totalQuantity === '' || formState.totalQuantity <= 0) {
    newErrors.totalQuantity = 'Quantity must be greater than 0 kg.';
  } else if (minAvailableKg !== undefined && formState.totalQuantity < minAvailableKg) {
    newErrors.totalQuantity = `Quantity cannot be reduced below active reserved/committed holds (${minAvailableKg} kg).`;
  } else if (maxAvailableKg !== undefined && formState.totalQuantity > maxAvailableKg) {
    newErrors.totalQuantity = `Quantity cannot exceed permissible batch stock (${maxAvailableKg} kg).`;
  }

  if (formState.unitPrice === '' || formState.unitPrice <= 0) {
    newErrors.unitPrice = 'Price per kg must be greater than LKR 0.';
  }

  if (!formState.availableFrom) {
    newErrors.availableFrom = 'Available start date is required.';
  }
  if (!formState.availableUntil) {
    newErrors.availableUntil = 'Available expiry date is required.';
  } else if (formState.availableFrom && formState.availableUntil < formState.availableFrom) {
    newErrors.availableUntil = 'Available until date cannot be earlier than start date.';
  }

  return newErrors;
}
