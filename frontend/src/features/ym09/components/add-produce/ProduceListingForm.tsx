import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/Button';
import { Alert } from '../../../../components/Alert';
import { ProduceInformationForm } from './ProduceInformationForm';
import { QuantityPricingForm } from './QuantityPricingForm';
import { AvailabilityForm } from './AvailabilityForm';
import { ListingPreviewCard } from './ListingPreviewCard';
import { ProduceImageSelector } from './ProduceImageSelector';
import { ListingSuccessDialog } from './ListingSuccessDialog';
import { useProduceListingForm } from './hooks/useProduceListingForm';
import type {
  ProduceListingFormState,
  ProduceListingView,
} from '../../types/produce';
import '../../styles/addProduce.css';

export interface ProduceListingFormProps {
  mode: 'create' | 'edit';
  pageTitle: string;
  pageSubtitle: string;
  submitButtonLabel: string;
  initialData?: ProduceListingFormState;
  existingListing?: ProduceListingView;
  onCancel?: () => void;
}

/**
 * Shared container for Create and Edit Produce Listing workflows.
 * Layout styling hides the duplicate WorkspaceLayout heading via CSS (.ym09-produce-form-page).
 */
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

  const {
    formState,
    errors,
    isSubmitting,
    submitError,
    showSuccessModal,
    activeImageUrl,
    imageStorageEnabled,
    selectedImageFile,
    hasExistingImage,
    imageError,
    uploadProgress,
    isUploadingImage,
    isRemovingImage,
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
    handleImageFileSelect,
    handleClearSelectedImage,
    handleRemoveExistingImage,
    handleSubmit,
    closeSuccessModal,
  } = useProduceListingForm({
    mode,
    initialData,
    existingListing,
  });

  const handleReturnToList = () => {
    navigate('/farmer/produce');
  };

  const handleCancelClick = onCancel ?? handleReturnToList;
  const hasValidationErrors = Object.values(errors).some(Boolean);

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
          <ArrowLeft size={20} aria-hidden="true" />
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
            <AlertCircle size={18} aria-hidden="true" />
            <span><strong>Unable to save listing:</strong> {submitError}</span>
          </div>
        </Alert>
      )}

      {/* Global Validation Error Banner */}
      {hasValidationErrors && (
        <Alert type="error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} aria-hidden="true" />
            <span>Please review and complete all required fields highlighted in red below.</span>
          </div>
        </Alert>
      )}

      {/* 2. Main 2-Column Responsive Layout (Left Form + Right Preview) */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="ym09-add-content-grid">
          {/* LEFT COLUMN: Form Sections */}
          <div className="ym09-form-sections-col">
            <ProduceInformationForm
              mode={mode}
              formState={formState}
              errors={errors}
              farms={availableFarms}
              harvestBatches={harvestBatches}
              dependenciesLoading={dependenciesLoading}
              dependencyNotice={dependencyNotice}
              isSamplePreview={isSampleDependencies}
              isSourceLocked={isSourceLocked}
              lockReason={lockReason}
              onFarmChange={handleFarmChange}
              onBatchChange={handleBatchChange}
            />

            <QuantityPricingForm
              formState={formState}
              errors={errors}
              maxAvailableKg={maxAvailableKg}
              minAvailableKg={minAvailableKg}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
            />

            <AvailabilityForm
              mode={mode}
              formState={formState}
              errors={errors}
              onFromChange={handleFromDateChange}
              onUntilChange={handleUntilDateChange}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* RIGHT COLUMN: Live Listing Preview, Media Note & Action Buttons */}
          <div className="ym09-preview-col">
            <ListingPreviewCard
              formState={formState}
              activeImageUrl={activeImageUrl}
            />

            <ProduceImageSelector
              mode={mode}
              imageUrl={activeImageUrl}
              imageStorageEnabled={imageStorageEnabled}
              selectedFile={selectedImageFile}
              hasExistingImage={hasExistingImage}
              imageError={imageError}
              uploadProgress={uploadProgress}
              isUploading={isUploadingImage}
              isRemoving={isRemovingImage}
              disabled={isSubmitting}
              onSelectFile={handleImageFileSelect}
              onClearSelectedFile={handleClearSelectedImage}
              onRemoveExistingImage={handleRemoveExistingImage}
            />

            {/* Action Buttons: Cancel and Submit Button (Publish or Update) */}
            <div className="ym09-action-buttons-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelClick}
                disabled={isSubmitting || isUploadingImage || isRemovingImage}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || isRemovingImage}
              >
                <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                <span>
                  {isUploadingImage
                    ? `Uploading Image (${uploadProgress ?? 0}%)...`
                    : isSubmitting
                      ? 'Saving...'
                      : submitButtonLabel}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* 3. Success Confirmation Dialog */}
      <ListingSuccessDialog
        open={showSuccessModal}
        mode={mode}
        formState={formState}
        estimatedValue={estimatedValue}
        onKeepEditing={closeSuccessModal}
        onReturnToList={handleReturnToList}
      />
    </div>
  );
}
