import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { Alert } from '../../../../components/Alert';
import { ProduceInformationForm } from './ProduceInformationForm';
import { QuantityPricingForm } from './QuantityPricingForm';
import { AvailabilityForm } from './AvailabilityForm';
import { ProductTagsForm } from './ProductTagsForm';
import { ListingPreviewCard } from './ListingPreviewCard';
import { ProduceImageSelector } from './ProduceImageSelector';
import { updateProduceListing, createProduceListing } from '../../services/produceApi';
import {
  DEFAULT_PRODUCT_TAGS,
  PRODUCE_PLACEHOLDERS,
  SAMPLE_HARVEST_BATCHES,
} from '../../constants/produceConstants';
import {
  getTodayDateInputString,
  getFutureDateInputString,
} from '../../utils/produceFormatters';
import type {
  AddProduceValidationErrors,
  HarvestBatchOption,
  ProduceCategory,
  ProduceListingFormState,
  ProduceListingView,
  ProducePlaceholderKey,
} from '../../types/produce';
import '../../styles/addProduce.css';

export interface ProduceListingFormProps {
  mode: 'create' | 'edit';
  pageTitle: string;
  pageSubtitle: string;
  submitButtonLabel: string;
  initialData?: ProduceListingFormState;
  existingListing?: ProduceListingView;
  onSubmit?: (formData: ProduceListingFormState) => Promise<void> | void;
  onCancel?: () => void;
}

export function ProduceListingForm({
  mode,
  pageTitle,
  pageSubtitle,
  submitButtonLabel,
  initialData,
  existingListing,
  onCancel,
}: ProduceListingFormProps) {
  const navigate = useNavigate();

  // Hide the redundant "My Produce" page heading rendered by WorkspaceLayout on this page
  useEffect(() => {
    const pageHeading = document.querySelector('.workspace-content > .page-heading');
    if (pageHeading instanceof HTMLElement) {
      const prevDisplay = pageHeading.style.display;
      pageHeading.style.display = 'none';
      return () => {
        pageHeading.style.display = prevDisplay;
      };
    }
  }, []);

  // Extract unique certified farms from sample batches
  const availableFarms = useMemo(() => {
    const map = new Map<string, string>();
    SAMPLE_HARVEST_BATCHES.forEach((b) => map.set(b.farmId, b.farmName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, []);

  // Form State initialized from initialData or defaults
  const [formState, setFormState] = useState<ProduceListingFormState>(() => {
    if (initialData) {
      return initialData;
    }
    const defaultBatch = SAMPLE_HARVEST_BATCHES[0]; // HB-2026-001 (Tomato)
    const today = getTodayDateInputString();
    const futureDate = getFutureDateInputString(15, today);

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
      totalQuantity: 100, // Matches screenshot: 100 kg
      unitPrice: 320, // Matches screenshot: LKR 320 / kg
      availableFrom: today,
      availableUntil: futureDate,
      productTags: [...DEFAULT_PRODUCT_TAGS],
      selectedImageKey: 'vegetables',
    };
  });

  const [errors, setErrors] = useState<AddProduceValidationErrors>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active holds on existing listing (reserved + committed)
  const activeHolds = (existingListing?.reservedKg || 0) + (existingListing?.committedKg || 0);

  // Source selection is locked ONLY if the listing has active buyer holds
  const isSourceLocked = mode === 'edit' && activeHolds > 0;
  const lockReason = isSourceLocked
    ? `Harvest source cannot be changed because this listing has ${
        existingListing?.reservedKg ? `${existingListing.reservedKg} kg reserved` : ''
      }${existingListing?.reservedKg && existingListing?.committedKg ? ' and ' : ''}${
        existingListing?.committedKg ? `${existingListing.committedKg} kg committed` : ''
      }. Reassigning batches under active holds is prevented to protect order allocations and traceability.`
    : undefined;

  // Find currently selected harvest batch to enforce stock validation limit
  const currentBatch = useMemo(() => {
    return SAMPLE_HARVEST_BATCHES.find((b) => b.id === formState.batchId);
  }, [formState.batchId]);

  /**
   * EXACT STOCK CALCULATION LOGIC (Rule DR-01 & Edit Safe Reassignment):
   *
   * In CREATE mode:
   *   Max allowable = batch.availableStockKg (unencumbered sellable stock in batch).
   *   Min allowable = 1 kg.
   *
   * In EDIT mode:
   *   Case 1: User keeps the SAME batch as the existing listing:
   *     Max allowable = batch.availableStockKg + existingListing.availableKg
   *     Min allowable = activeHolds > 0 ? activeHolds : 1
   *
   *   Case 2: User reassigns to ANOTHER eligible batch (allowed only when activeHolds === 0):
   *     Max allowable = batch.availableStockKg (the new batch unencumbered stock)
   *     Min allowable = 1 kg
   */
  const { minAvailableKg, maxAvailableKg } = useMemo(() => {
    if (mode === 'edit' && existingListing) {
      const isSameBatch = currentBatch && currentBatch.id === existingListing.batchId;

      if (isSameBatch) {
        const unallocatedBatchStock = currentBatch ? currentBatch.availableStockKg : 0;
        const maxAllowed = unallocatedBatchStock + existingListing.availableKg;
        return {
          minAvailableKg: activeHolds > 0 ? activeHolds : 1,
          maxAvailableKg: maxAllowed,
        };
      } else {
        // Reassigned to another eligible batch (which only happens when activeHolds === 0)
        return {
          minAvailableKg: 1,
          maxAvailableKg: currentBatch ? currentBatch.availableStockKg : undefined,
        };
      }
    }
    return {
      minAvailableKg: 1,
      maxAvailableKg: currentBatch ? currentBatch.availableStockKg : undefined,
    };
  }, [mode, existingListing, currentBatch, activeHolds]);

  // Active Image URL from the 5 verified local agricultural placeholders
  const activeImageUrl =
    PRODUCE_PLACEHOLDERS[formState.selectedImageKey]?.imageUrl || PRODUCE_PLACEHOLDERS.vegetables.imageUrl;

  // Handlers for Form Section 1: Produce Information
  const handleFarmChange = (farmId: string, farmName: string) => {
    if (isSourceLocked) return;
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
    if (errors.farmId) setErrors((prev) => ({ ...prev, farmId: undefined }));
    if (errors.batchId) setErrors((prev) => ({ ...prev, batchId: undefined }));
    if (errors.cropId) setErrors((prev) => ({ ...prev, cropId: undefined }));
    if (errors.gradeId) setErrors((prev) => ({ ...prev, gradeId: undefined }));
  };

  const handleBatchChange = (batch: HarvestBatchOption) => {
    if (isSourceLocked) return;
    let autoImageKey: ProducePlaceholderKey = 'vegetables';
    if (batch.category === 'Fruits') autoImageKey = 'fruits';
    else if (batch.category === 'Grains') autoImageKey = 'grains';
    else if (batch.category === 'Spices') autoImageKey = 'spices';
    else if (batch.category === 'Others') autoImageKey = 'fresh-produce';

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
    if (errors.batchId) setErrors((prev) => ({ ...prev, batchId: undefined }));
    if (errors.totalQuantity) setErrors((prev) => ({ ...prev, totalQuantity: undefined }));
  };

  // Handlers for Section 2: Quantity & Pricing
  const handleQuantityChange = (totalQuantity: number | '') => {
    setFormState((prev) => ({ ...prev, totalQuantity }));
    if (errors.totalQuantity) setErrors((prev) => ({ ...prev, totalQuantity: undefined }));
  };

  const handlePriceChange = (unitPrice: number | '') => {
    setFormState((prev) => ({ ...prev, unitPrice }));
    if (errors.unitPrice) setErrors((prev) => ({ ...prev, unitPrice: undefined }));
  };

  // Handlers for Section 3: Availability Dates
  const handleFromDateChange = (availableFrom: string) => {
    setFormState((prev) => ({ ...prev, availableFrom }));
    if (errors.availableFrom) setErrors((prev) => ({ ...prev, availableFrom: undefined }));
  };

  const handleUntilDateChange = (availableUntil: string) => {
    setFormState((prev) => ({ ...prev, availableUntil }));
    if (errors.availableUntil) setErrors((prev) => ({ ...prev, availableUntil: undefined }));
  };

  // Handlers for Section 4: Product Tags
  const handleAddTag = (tag: string) => {
    setFormState((prev) => ({
      ...prev,
      productTags: [...prev.productTags, tag],
    }));
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      productTags: prev.productTags.filter((t) => t !== tagToRemove),
    }));
  };

  // Handler for Image Placeholder Selection
  const handleImageKeyChange = (selectedImageKey: ProducePlaceholderKey) => {
    setFormState((prev) => ({ ...prev, selectedImageKey }));
  };

  // Validation Logic
  const validateForm = (): boolean => {
    const newErrors: AddProduceValidationErrors = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === 'edit' && existingListing) {
        // Execute actual in-place update (preserves ID, updates sample data or backend)
        await updateProduceListing(existingListing.id, formState);
      } else if (mode === 'create') {
        // Execute actual creation
        await createProduceListing(formState);
      }
      setShowSuccessModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save produce listing';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/farmer/produce');
    }
  };

  const estimatedValue =
    typeof formState.totalQuantity === 'number' && typeof formState.unitPrice === 'number'
      ? formState.totalQuantity * formState.unitPrice
      : 0;

  return (
    <div className={`ym09-produce-form-page ${mode === 'edit' ? 'ym09-edit-produce-page' : 'ym09-add-produce-page'}`}>
      {/* 1. Header with Back Button, Single Semantic H1 Title, and Subtitle */}
      <div className="ym09-add-header-row">
        <button
          type="button"
          onClick={handleCancelClick}
          title="Back to My Produce"
          aria-label="Back to My Produce"
          className="ym09-back-btn"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="ym09-page-title">{pageTitle}</h1>
          <p className="ym09-page-subtitle">{pageSubtitle}</p>
        </div>
      </div>

      {/* Global Submit Error Banner */}
      {submitError && (
        <Alert type="error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span><strong>Unable to save listing:</strong> {submitError}</span>
          </div>
        </Alert>
      )}

      {/* Global Validation Error Banner */}
      {Object.keys(errors).length > 0 && (
        <Alert type="error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>Please review and complete all required fields highlighted in red below.</span>
          </div>
        </Alert>
      )}

      {/* 2. Main 2-Column Responsive Layout (Left Form + Right Preview) */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="ym09-add-content-grid">
          {/* LEFT COLUMN: The 4 Form Sections */}
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Section 1: Produce Information */}
            <ProduceInformationForm
              formState={formState}
              errors={errors}
              farms={availableFarms}
              harvestBatches={SAMPLE_HARVEST_BATCHES}
              isSourceLocked={isSourceLocked}
              lockReason={lockReason}
              onFarmChange={handleFarmChange}
              onBatchChange={handleBatchChange}
            />

            {/* Section 2: Quantity & Pricing (Exact stock calculations) */}
            <QuantityPricingForm
              formState={formState}
              errors={errors}
              maxAvailableKg={maxAvailableKg}
              minAvailableKg={minAvailableKg}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
            />

            {/* Section 3: Availability Dates */}
            <AvailabilityForm
              formState={formState}
              errors={errors}
              onFromChange={handleFromDateChange}
              onUntilChange={handleUntilDateChange}
            />

            {/* Section 4: Product Tags */}
            <ProductTagsForm
              tags={formState.productTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          </div>

          {/* RIGHT COLUMN: Live Listing Preview, Image Selector & Action Buttons */}
          <div className="ym09-preview-col">
            {/* Live Listing Preview Card */}
            <ListingPreviewCard
              formState={formState}
              activeImageUrl={activeImageUrl}
            />

            {/* Image Placeholder Selector & Illustrative Dropzone */}
            <ProduceImageSelector
              selectedKey={formState.selectedImageKey}
              onSelectKey={handleImageKeyChange}
            />

            {/* Action Buttons: Cancel and Submit Button (Publish or Update) */}
            <div className="ym09-action-buttons-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelClick}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                disabled={isSubmitting}
              >
                <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                <span>{isSubmitting ? 'Saving...' : submitButtonLabel}</span>
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* 3. Phase 2 Verification / Confirmation Modal */}
      {showSuccessModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 40, 29, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="ym-confirm-dialog"
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--soft)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Check size={28} strokeWidth={2.5} />
            </div>

            <h3
              id="success-modal-title"
              style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}
            >
              {mode === 'edit' ? 'Listing Updated Successfully' : 'Listing Published Successfully'}
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              {mode === 'edit'
                ? 'The produce listing details have been updated in-place. Listing ID and historical integrity are preserved.'
                : 'Your harvest listing has been published to the marketplace and is now discoverable.'}
            </p>

            {/* Summary Details */}
            <div
              style={{
                backgroundColor: 'var(--canvas)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '13px',
                lineHeight: 1.8,
                marginBottom: '20px',
              }}
            >
              {formState.listingId && <div><strong>Listing ID:</strong> {formState.listingId}</div>}
              <div><strong>Crop:</strong> {formState.cropName} ({formState.category})</div>
              <div><strong>Quality Grade:</strong> {formState.gradeName}</div>
              <div><strong>Origin Farm:</strong> {formState.farmName}</div>
              <div><strong>Harvest Batch:</strong> {formState.batchNumber}</div>
              <div><strong>Offered Quantity:</strong> {formState.totalQuantity} kg</div>
              <div><strong>Unit Price:</strong> LKR {formState.unitPrice} / kg</div>
              <div><strong>Estimated Value:</strong> LKR {estimatedValue.toLocaleString('en-US')}</div>
              <div><strong>Validity:</strong> {formState.availableFrom} to {formState.availableUntil}</div>
              <div><strong>Status:</strong> {formState.status || 'Draft'}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => setShowSuccessModal(false)}
                style={{ height: '42px', borderRadius: '10px' }}
              >
                Keep Editing
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/farmer/produce')}
                style={{ height: '42px', borderRadius: '10px' }}
              >
                Return to My Produce
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
