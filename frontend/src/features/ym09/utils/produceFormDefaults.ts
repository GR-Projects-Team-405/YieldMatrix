import {
  getTodayDateInputString,
  getFutureDateInputString,
} from './produceFormatters';
import type {
  HarvestBatchOption,
  ProduceListingFormState,
  ProduceListingView,
} from '../types/produce';

/**
 * Builds the default ProduceListingFormState for create mode.
 */
export function createDefaultProduceFormState(
  batches: HarvestBatchOption[] = []
): ProduceListingFormState {
  const defaultBatch = batches[0];
  const today = getTodayDateInputString();
  const futureDate = getFutureDateInputString(15, today);

  if (!defaultBatch) {
    return {
      farmId: '',
      farmName: '',
      cropId: '',
      cropName: '',
      category: 'Vegetables',
      batchId: '',
      batchNumber: '',
      gradeId: '',
      gradeName: '',
      totalQuantity: '',
      unitPrice: '',
      availableFrom: today,
      availableUntil: futureDate,
      status: 'active',
    };
  }

  return {
    farmId: defaultBatch.farmId,
    farmName: defaultBatch.farmName,
    cropId: defaultBatch.cropId,
    cropName: defaultBatch.cropName,
    category: defaultBatch.category,
    batchId: defaultBatch.id,
    batchNumber: defaultBatch.batchNumber,
    gradeId: defaultBatch.gradeId,
    gradeName: defaultBatch.gradeName,
    totalQuantity: '',
    unitPrice: '',
    availableFrom: today,
    availableUntil: futureDate,
    status: 'active',
  };
}

/**
 * Resolves the initial form state for either create or edit mode.
 * Returns a fresh copy of `initialData` when provided; otherwise builds create-mode defaults.
 */
export function getInitialProduceFormState(
  mode: 'create' | 'edit',
  batches: HarvestBatchOption[],
  initialData?: ProduceListingFormState
): ProduceListingFormState {
  if (initialData) {
    return { ...initialData };
  }
  if (mode === 'edit') {
    return { ...createDefaultProduceFormState(batches) };
  }
  return createDefaultProduceFormState(batches);
}

/**
 * Maps an existing ProduceListingView entity into ProduceListingFormState for Edit mode.
 */
export function mapListingToFormState(
  listing: ProduceListingView,
  batches: HarvestBatchOption[] = []
): ProduceListingFormState {
  const batch = batches.find((b) => b.id === listing.batchId);
  const fromDate = listing.validFrom ? listing.validFrom.split('T')[0] : getTodayDateInputString();
  const untilDate = listing.validUntil
    ? listing.validUntil.split('T')[0]
    : getFutureDateInputString(15);

  const fallbackBatchNumber = listing.batchId
    ? `HB-${listing.batchId.slice(0, 8).toUpperCase()}`
    : 'HB-UNKNOWN';

  return {
    listingId: listing.id,
    farmId: listing.farmId,
    farmName: listing.farmName,
    cropId: batch ? batch.cropId : '',
    cropName: listing.cropName,
    category: listing.category,
    batchId: listing.batchId,
    batchNumber: listing.batchNumber || (batch ? batch.batchNumber : fallbackBatchNumber),
    gradeId: batch ? batch.gradeId : '',
    gradeName: listing.gradeName,
    totalQuantity: listing.offeredKg,
    unitPrice: Number((listing.unitPriceCents / 100).toFixed(2)),
    availableFrom: fromDate,
    availableUntil: untilDate,
    status: listing.status,
  };
}

/**
 * Compares two ProduceListingFormState objects by value to prevent unnecessary resets
 * when parent components pass semantically identical initialData references.
 */
export function areProduceFormStatesEqual(
  a?: ProduceListingFormState,
  b?: ProduceListingFormState
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.listingId === b.listingId &&
    a.farmId === b.farmId &&
    a.farmName === b.farmName &&
    a.cropId === b.cropId &&
    a.cropName === b.cropName &&
    a.category === b.category &&
    a.batchId === b.batchId &&
    a.batchNumber === b.batchNumber &&
    a.gradeId === b.gradeId &&
    a.gradeName === b.gradeName &&
    a.totalQuantity === b.totalQuantity &&
    a.unitPrice === b.unitPrice &&
    a.availableFrom === b.availableFrom &&
    a.availableUntil === b.availableUntil &&
    a.status === b.status
  );
}
