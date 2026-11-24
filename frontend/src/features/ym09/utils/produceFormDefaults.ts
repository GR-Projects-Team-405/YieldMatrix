import {
  getTodayDateInputString,
  getFutureDateInputString,
} from './produceFormatters';
import type {
  HarvestBatchOption,
  ProduceCategory,
  ProduceListingFormState,
  ProduceListingView,
  ProducePlaceholderKey,
} from '../types/produce';

/**
 * Maps a crop category to its corresponding local agricultural placeholder key.
 */
export function getPlaceholderKeyForCategory(
  category: ProduceCategory | string
): ProducePlaceholderKey {
  switch (category) {
    case 'Fruits':
      return 'fruits';
    case 'Grains':
      return 'grains';
    case 'Spices':
      return 'spices';
    case 'Others':
      return 'fresh-produce';
    case 'Vegetables':
    default:
      return 'vegetables';
  }
}

/**
 * Extracts unique certified farms (preserving source order) from available harvest batches.
 */
export function getAvailableFarms(
  batches: HarvestBatchOption[]
): Array<{ id: string; name: string }> {
  const farmMap = new Map<string, string>();
  batches.forEach((batch) => {
    farmMap.set(batch.farmId, batch.farmName);
  });
  return Array.from(farmMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Builds the default ProduceListingFormState for create mode using the initial default batch.
 */
export function createDefaultProduceFormState(
  batches: HarvestBatchOption[]
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
      totalQuantity: 100,
      unitPrice: 320,
      availableFrom: today,
      availableUntil: futureDate,
      selectedImageKey: 'vegetables',
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
    totalQuantity: 100, // Matches design baseline: 100 kg
    unitPrice: 320, // Matches design baseline: LKR 320 / kg
    availableFrom: today,
    availableUntil: futureDate,
    selectedImageKey: 'vegetables',
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
  batches: HarvestBatchOption[]
): ProduceListingFormState {
  const batch = batches.find((b) => b.id === listing.batchId);
  const fromDate = listing.validFrom ? listing.validFrom.split('T')[0] : getTodayDateInputString();
  const untilDate = listing.validUntil
    ? listing.validUntil.split('T')[0]
    : getFutureDateInputString(15);

  return {
    listingId: listing.id,
    farmId: listing.farmId,
    farmName: listing.farmName,
    cropId: batch ? batch.cropId : 'crop-001',
    cropName: listing.cropName,
    category: listing.category,
    batchId: listing.batchId,
    batchNumber: batch ? batch.batchNumber : `HB-${listing.id} (${listing.cropName})`,
    gradeId: batch ? batch.gradeId : 'grade-001',
    gradeName: listing.gradeName,
    totalQuantity: listing.offeredKg,
    unitPrice: Math.round(listing.unitPriceCents / 100),
    availableFrom: fromDate,
    availableUntil: untilDate,
    selectedImageKey: getPlaceholderKeyForCategory(listing.category),
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
    a.selectedImageKey === b.selectedImageKey &&
    a.status === b.status
  );
}
