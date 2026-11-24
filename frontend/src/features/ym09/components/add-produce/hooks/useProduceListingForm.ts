import { useEffect, useRef, useState } from 'react';
import {
  PRODUCE_PLACEHOLDERS,
  SAMPLE_HARVEST_BATCHES,
} from '../../../constants/produceConstants';
import {
  createProduceListing,
  updateProduceListing,
} from '../../../services/produceApi';
import {
  areProduceFormStatesEqual,
  getAvailableFarms,
  getInitialProduceFormState,
  getPlaceholderKeyForCategory,
} from '../../../utils/produceFormDefaults';
import {
  calculateStockValidationBounds,
  getHarvestSourceLockState,
  validateProduceListingForm,
} from '../../../utils/produceFormValidation';
import type {
  AddProduceValidationErrors,
  HarvestBatchOption,
  ProduceListingFormState,
  ProduceListingView,
  ProducePlaceholderKey,
} from '../../../types/produce';

const AVAILABLE_FARMS = getAvailableFarms(SAMPLE_HARVEST_BATCHES);

export interface UseProduceListingFormParams {
  mode: 'create' | 'edit';
  initialData?: ProduceListingFormState;
  existingListing?: ProduceListingView;
}

export interface UseProduceListingFormReturn {
  formState: ProduceListingFormState;
  errors: AddProduceValidationErrors;
  isSubmitting: boolean;
  submitError: string | null;
  showSuccessModal: boolean;
  activeImageUrl: string;
  availableFarms: Array<{ id: string; name: string }>;
  harvestBatches: HarvestBatchOption[];
  isSourceLocked: boolean;
  lockReason?: string;
  minAvailableKg: number;
  maxAvailableKg?: number;
  estimatedValue: number;
  handleFarmChange: (farmId: string, farmName: string) => void;
  handleBatchChange: (batch: HarvestBatchOption) => void;
  handleQuantityChange: (totalQuantity: number | '') => void;
  handlePriceChange: (unitPrice: number | '') => void;
  handleFromDateChange: (availableFrom: string) => void;
  handleUntilDateChange: (availableUntil: string) => void;
  handleImageKeyChange: (selectedImageKey: ProducePlaceholderKey) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  closeSuccessModal: () => void;
}

/**
 * Custom hook encapsulating state, validation, stock calculations,
 * source-lock enforcement, and submission lifecycle for ProduceListingForm.
 */
export function useProduceListingForm({
  mode,
  initialData,
  existingListing,
}: UseProduceListingFormParams): UseProduceListingFormReturn {
  const [formState, setFormState] = useState<ProduceListingFormState>(() =>
    getInitialProduceFormState(mode, SAMPLE_HARVEST_BATCHES, initialData)
  );
  const [errors, setErrors] = useState<AddProduceValidationErrors>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track user modification and last synced external entity to safely handle async initialData
  const isDirtyRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const currentEntityId = initialData?.listingId ?? existingListing?.id;
  const syncedContextRef = useRef<{
    mode: 'create' | 'edit';
    entityId?: string;
    initialData?: ProduceListingFormState;
  }>({
    mode,
    entityId: currentEntityId,
    initialData,
  });

  useEffect(() => {
    const prev = syncedContextRef.current;
    const modeChanged = prev.mode !== mode;
    const entityChanged = prev.entityId !== currentEntityId;
    const dataChanged = !areProduceFormStatesEqual(prev.initialData, initialData);

    // Full reset when switching between create/edit or loading a different listing ID
    if (modeChanged || entityChanged) {
      syncedContextRef.current = {
        mode,
        entityId: currentEntityId,
        initialData,
      };
      isDirtyRef.current = false;
      setFormState(getInitialProduceFormState(mode, SAMPLE_HARVEST_BATCHES, initialData));
      setErrors({});
      setSubmitError(null);
      setShowSuccessModal(false);
      return;
    }

    // Populate async initialData for the same entity only if the user hasn't started editing
    if (dataChanged && initialData && !isDirtyRef.current) {
      syncedContextRef.current = {
        mode,
        entityId: currentEntityId,
        initialData,
      };
      setFormState({ ...initialData });
      setErrors({});
      setSubmitError(null);
    }
  }, [mode, currentEntityId, initialData]);

  const { activeHolds, isSourceLocked, lockReason } = getHarvestSourceLockState(
    mode,
    existingListing
  );

  const currentBatch = SAMPLE_HARVEST_BATCHES.find((b) => b.id === formState.batchId);

  const { minAvailableKg, maxAvailableKg } = calculateStockValidationBounds({
    mode,
    existingListing,
    currentBatch,
    activeHolds,
  });

  const activeImageUrl =
    PRODUCE_PLACEHOLDERS[formState.selectedImageKey]?.imageUrl ||
    PRODUCE_PLACEHOLDERS.vegetables.imageUrl;

  const estimatedValue =
    typeof formState.totalQuantity === 'number' && typeof formState.unitPrice === 'number'
      ? formState.totalQuantity * formState.unitPrice
      : 0;

  const clearErrorFields = (fields: Array<keyof AddProduceValidationErrors>) => {
    setErrors((prev) => {
      const hasAny = fields.some((field) => prev[field] !== undefined);
      if (!hasAny) return prev;
      const next = { ...prev };
      fields.forEach((field) => {
        delete next[field];
      });
      return next;
    });
  };

  const handleFarmChange = (farmId: string, farmName: string) => {
    if (isSourceLocked) return;
    isDirtyRef.current = true;
    setFormState((prev) => {
      const isSameFarm = prev.farmId === farmId;
      return {
        ...prev,
        farmId,
        farmName,
        batchId: isSameFarm ? prev.batchId : '',
        batchNumber: isSameFarm ? prev.batchNumber : '',
        cropId: isSameFarm ? prev.cropId : '',
        cropName: isSameFarm ? prev.cropName : '',
        category: isSameFarm ? prev.category : 'Vegetables',
        gradeId: isSameFarm ? prev.gradeId : '',
        gradeName: isSameFarm ? prev.gradeName : '',
        totalQuantity: isSameFarm ? prev.totalQuantity : '',
      };
    });
    clearErrorFields(['farmId', 'batchId', 'cropId', 'gradeId']);
  };

  const handleBatchChange = (batch: HarvestBatchOption) => {
    if (isSourceLocked) return;
    isDirtyRef.current = true;
    const autoImageKey = getPlaceholderKeyForCategory(batch.category);

    setFormState((prev) => ({
      ...prev,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      farmId: batch.farmId,
      farmName: batch.farmName,
      cropId: batch.cropId,
      cropName: batch.cropName,
      category: batch.category,
      gradeId: batch.gradeId,
      gradeName: batch.gradeName,
      selectedImageKey: autoImageKey,
      totalQuantity:
        typeof prev.totalQuantity === 'number' && prev.totalQuantity <= batch.availableStockKg
          ? prev.totalQuantity
          : batch.availableStockKg,
    }));
    clearErrorFields(['batchId', 'cropId', 'gradeId', 'totalQuantity']);
  };

  const handleQuantityChange = (totalQuantity: number | '') => {
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, totalQuantity }));
    clearErrorFields(['totalQuantity']);
  };

  const handlePriceChange = (unitPrice: number | '') => {
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, unitPrice }));
    clearErrorFields(['unitPrice']);
  };

  const handleFromDateChange = (availableFrom: string) => {
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, availableFrom }));
    clearErrorFields(['availableFrom']);
  };

  const handleUntilDateChange = (availableUntil: string) => {
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, availableUntil }));
    clearErrorFields(['availableUntil']);
  };

  const handleImageKeyChange = (selectedImageKey: ProducePlaceholderKey) => {
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, selectedImageKey }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }

    const validationErrors = validateProduceListingForm(formState, {
      minAvailableKg,
      maxAvailableKg,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === 'edit') {
        if (!existingListing) {
          throw new Error('Existing listing context is required to update this produce listing.');
        }
        await updateProduceListing(existingListing.id, formState);
      } else {
        await createProduceListing(formState);
      }
      setShowSuccessModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save produce listing';
      setSubmitError(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  return {
    formState,
    errors,
    isSubmitting,
    submitError,
    showSuccessModal,
    activeImageUrl,
    availableFarms: AVAILABLE_FARMS,
    harvestBatches: SAMPLE_HARVEST_BATCHES,
    isSourceLocked,
    lockReason,
    minAvailableKg,
    maxAvailableKg,
    estimatedValue,
    handleFarmChange,
    handleBatchChange,
    handleQuantityChange,
    handlePriceChange,
    handleFromDateChange,
    handleUntilDateChange,
    handleImageKeyChange,
    handleSubmit,
    closeSuccessModal,
  };
}
