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

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function hasAtMostDecimals(value: number, maxDecimals: number): boolean {
  if (!Number.isFinite(value)) return false;
  const factor = 10 ** maxDecimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

function isValidCalendarDate(dateStr: string): boolean {
  const match = DATE_ONLY_REGEX.exec(dateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Determines whether harvest source fields (Farm / Batch / Crop / Grade) are locked.
 * In Edit mode, Farm, Harvest Batch, Crop, and Grade are always fixed to protect
 * original harvest batch traceability and historical buyer allocations.
 */
export function getHarvestSourceLockState(
  mode: 'create' | 'edit',
  existingListing?: ProduceListingView
): HarvestSourceLockState {
  const activeHolds = existingListing?.reservedKg || 0;
  const committedSubset = existingListing?.committedKg || 0;
  const isSourceLocked = mode === 'edit';

  if (!isSourceLocked) {
    return { activeHolds, isSourceLocked: false, lockReason: undefined };
  }

  if (activeHolds <= 0) {
    return {
      activeHolds: 0,
      isSourceLocked: true,
      lockReason:
        'Farm, Harvest Batch, Crop, and Grade are fixed when editing an existing listing to preserve original batch traceability and order history.',
    };
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
    lockReason: `Farm, Harvest Batch, Crop, and Grade are locked (${parts.join(' and ')}). Original harvest linkage and historical allocations are preserved.`,
  };
}

/**
 * Computes permissible [minAvailableKg, maxAvailableKg] stock bounds (Rule DR-01).
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
    const maxFromBatch =
      isSameBatch && currentBatch
        ? currentBatch.availableStockKg + existingListing.availableKg
        : existingListing.sellableKg;

    return {
      minAvailableKg: activeHolds > 0 ? activeHolds : 0,
      maxAvailableKg: maxFromBatch,
    };
  }

  return {
    minAvailableKg: 0,
    maxAvailableKg: currentBatch ? currentBatch.availableStockKg : undefined,
  };
}

/**
 * Validates all produce listing form fields against required rules and stock/date bounds.
 */
export function validateProduceListingForm(
  formState: ProduceListingFormState,
  bounds: StockValidationBounds,
  mode: 'create' | 'edit' = 'create'
): AddProduceValidationErrors {
  const newErrors: AddProduceValidationErrors = {};
  const { minAvailableKg, maxAvailableKg } = bounds;

  if (!formState.farmId) {
    newErrors.farmId = 'Please select a certified farm.';
  }
  if (!formState.batchId) {
    newErrors.batchId = 'Please select an eligible harvest batch.';
  }
  if (mode === 'create') {
    if (!formState.cropId && !formState.cropName) {
      newErrors.cropId = 'Crop is derived automatically from the selected harvest batch.';
    }
    if (!formState.gradeId && !formState.gradeName) {
      newErrors.gradeId = 'Grade is derived automatically from the selected harvest batch.';
    }
  }

  if (
    formState.totalQuantity === '' ||
    typeof formState.totalQuantity !== 'number' ||
    !Number.isFinite(formState.totalQuantity) ||
    formState.totalQuantity <= 0
  ) {
    newErrors.totalQuantity = 'Quantity must be greater than 0 kg.';
  } else if (!hasAtMostDecimals(formState.totalQuantity, 3)) {
    newErrors.totalQuantity = 'Quantity supports up to 3 decimal places (e.g. 25.5 kg).';
  } else if (minAvailableKg > 0 && formState.totalQuantity < minAvailableKg) {
    newErrors.totalQuantity = `Quantity cannot be reduced below active reserved/committed holds (${minAvailableKg} kg).`;
  } else if (maxAvailableKg !== undefined && formState.totalQuantity > maxAvailableKg) {
    newErrors.totalQuantity = `Quantity cannot exceed permissible batch sellable stock (${maxAvailableKg} kg).`;
  }

  if (
    formState.unitPrice === '' ||
    typeof formState.unitPrice !== 'number' ||
    !Number.isFinite(formState.unitPrice) ||
    formState.unitPrice <= 0
  ) {
    newErrors.unitPrice = 'Price per kg must be greater than LKR 0.';
  } else if (!hasAtMostDecimals(formState.unitPrice, 2) || Math.round(formState.unitPrice * 100) <= 0) {
    newErrors.unitPrice = 'Price per kg must be a valid LKR amount (up to 2 decimal places).';
  }

  if (!formState.availableFrom) {
    newErrors.availableFrom = 'Available start date is required.';
  } else if (!isValidCalendarDate(formState.availableFrom)) {
    newErrors.availableFrom = 'Please enter a valid start date.';
  }

  if (!formState.availableUntil) {
    newErrors.availableUntil = 'Available expiry date is required.';
  } else if (!isValidCalendarDate(formState.availableUntil)) {
    newErrors.availableUntil = 'Please enter a valid expiry date.';
  } else if (
    formState.availableFrom &&
    isValidCalendarDate(formState.availableFrom) &&
    formState.availableUntil < formState.availableFrom
  ) {
    newErrors.availableUntil = 'Available until date cannot be earlier than start date.';
  }

  return newErrors;
}
