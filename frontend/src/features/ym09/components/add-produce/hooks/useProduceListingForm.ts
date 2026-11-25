import { useEffect, useRef, useState } from 'react';
import {
  createProduceListing,
  updateProduceListing,
} from '../../../services/produceApi';
import {
  fetchEligibleHarvestBatches,
  fetchFarmerFarms,
} from '../../../services/produceDependenciesApi';
import {
  areProduceFormStatesEqual,
  getInitialProduceFormState,
} from '../../../utils/produceFormDefaults';
import {
  calculateStockValidationBounds,
  getHarvestSourceLockState,
  validateProduceListingForm,
} from '../../../utils/produceFormValidation';
import type {
  AddProduceValidationErrors,
  FarmerFarmOption,
  HarvestBatchOption,
  ProduceListingFormState,
  ProduceListingView,
} from '../../../types/produce';

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
  activeImageUrl?: string;
  availableFarms: FarmerFarmOption[];
  harvestBatches: HarvestBatchOption[];
  dependenciesLoading: boolean;
  dependencyNotice: string | null;
  isSampleDependencies: boolean;
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
  handleStatusChange: (status: 'active' | 'draft') => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  closeSuccessModal: () => void;
}

/**
 * Custom hook encapsulating state, validation, stock calculations,
 * source-lock enforcement, dependency loading, and submission lifecycle for ProduceListingForm.
 */
export function useProduceListingForm({
  mode,
  initialData,
  existingListing,
}: UseProduceListingFormParams): UseProduceListingFormReturn {
  const [availableFarms, setAvailableFarms] = useState<FarmerFarmOption[]>([]);
  const [harvestBatches, setHarvestBatches] = useState<HarvestBatchOption[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState<boolean>(mode === 'create');
  const [dependencyNotice, setDependencyNotice] = useState<string | null>(null);
  const [isSampleDependencies, setIsSampleDependencies] = useState<boolean>(false);

  const [formState, setFormState] = useState<ProduceListingFormState>(() =>
    getInitialProduceFormState(mode, [], initialData)
  );
  const [errors, setErrors] = useState<AddProduceValidationErrors>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Load YM07 farms and YM08 eligible harvest batches in create mode
  useEffect(() => {
    if (mode !== 'create') {
      setDependenciesLoading(false);
      setDependencyNotice(null);
      setIsSampleDependencies(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadDependencies() {
      setDependenciesLoading(true);
      try {
        const [farmsResult, batchesResult] = await Promise.all([
          fetchFarmerFarms({ signal: controller.signal }),
          fetchEligibleHarvestBatches({ signal: controller.signal }),
        ]);

        if (!active || controller.signal.aborted) {
          return;
        }

        setAvailableFarms(farmsResult.items);
        setHarvestBatches(batchesResult.items);
        setIsSampleDependencies(
          Boolean(farmsResult.isSampleData || batchesResult.isSampleData)
        );

        const messages = [farmsResult.message, batchesResult.message].filter(
          (msg): msg is string => Boolean(msg)
        );
        setDependencyNotice(messages.length > 0 ? messages.join(' ') : null);
      } catch (err: unknown) {
        if (!active || controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Failed to load certified farms and harvest batches.';
        setAvailableFarms([]);
        setHarvestBatches([]);
        setIsSampleDependencies(false);
        setDependencyNotice(message);
      } finally {
        if (active && !controller.signal.aborted) {
          setDependenciesLoading(false);
        }
      }
    }

    loadDependencies();
    return () => {
      active = false;
      controller.abort();
    };
  }, [mode]);

  useEffect(() => {
    const prev = syncedContextRef.current;
    const modeChanged = prev.mode !== mode;
    const entityChanged = prev.entityId !== currentEntityId;
    const dataChanged = !areProduceFormStatesEqual(prev.initialData, initialData);

    if (modeChanged || entityChanged) {
      syncedContextRef.current = {
        mode,
        entityId: currentEntityId,
        initialData,
      };
      isDirtyRef.current = false;
      setFormState(getInitialProduceFormState(mode, [], initialData));
      setErrors({});
      setSubmitError(null);
      setShowSuccessModal(false);
      return;
    }

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

  const currentBatch = harvestBatches.find((b) => b.id === formState.batchId);

  const { minAvailableKg, maxAvailableKg } = calculateStockValidationBounds({
    mode,
    existingListing,
    currentBatch,
    activeHolds,
  });

  const activeImageUrl = existingListing?.imageUrl;

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

  const handleStatusChange = (status: 'active' | 'draft') => {
    if (mode !== 'create') return;
    isDirtyRef.current = true;
    setFormState((prev) => ({ ...prev, status }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }

    const validationErrors = validateProduceListingForm(
      formState,
      { minAvailableKg, maxAvailableKg },
      mode
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let savedListing: ProduceListingView;
      if (mode === 'edit') {
        if (!existingListing) {
          throw new Error('Existing listing context is required to update this produce listing.');
        }
        savedListing = await updateProduceListing(existingListing.id, formState);
      } else {
        savedListing = await createProduceListing(formState);
      }
      setFormState((prev) => ({
        ...prev,
        listingId: savedListing.id,
        status: savedListing.status,
      }));
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
    availableFarms,
    harvestBatches,
    dependenciesLoading,
    dependencyNotice,
    isSampleDependencies,
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
    handleStatusChange,
    handleSubmit,
    closeSuccessModal,
  };
}
