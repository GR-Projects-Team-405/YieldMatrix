import { Info, MapPin, Sprout, Layers, Award, Lock } from 'lucide-react';
import { Alert } from '../../../../components/Alert';
import { isEligibleCreateBatch } from '../../services/produceDependenciesApi';
import type {
  ProduceListingFormState,
  AddProduceValidationErrors,
  HarvestBatchOption,
} from '../../types/produce';

interface ProduceInformationFormProps {
  mode?: 'create' | 'edit';
  formState: ProduceListingFormState;
  errors: AddProduceValidationErrors;
  farms: Array<{ id: string; name: string }>;
  harvestBatches: HarvestBatchOption[];
  dependenciesLoading?: boolean;
  dependencyNotice?: string | null;
  isSamplePreview?: boolean;
  isSourceLocked?: boolean;
  lockReason?: string;
  onFarmChange: (farmId: string, farmName: string) => void;
  onBatchChange: (batch: HarvestBatchOption) => void;
}

export function ProduceInformationForm({
  mode = 'create',
  formState,
  errors,
  farms,
  harvestBatches,
  dependenciesLoading = false,
  dependencyNotice = null,
  isSamplePreview = false,
  isSourceLocked = false,
  lockReason,
  onFarmChange,
  onBatchChange,
}: ProduceInformationFormProps) {
  const farmBatches = harvestBatches.filter((b) => !formState.farmId || b.farmId === formState.farmId);

  const effectiveFarms =
    formState.farmId && !farms.some((f) => f.id === formState.farmId)
      ? [{ id: formState.farmId, name: formState.farmName || formState.farmId }, ...farms]
      : farms;

  const handleFarmSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const farm = farms.find((f) => f.id === selectedId);
    onFarmChange(selectedId, farm ? farm.name : '');
  };

  const handleBatchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const batch = harvestBatches.find((b) => b.id === selectedId);
    if (batch) {
      onBatchChange(batch);
    }
  };

  return (
    <section className="ym-content-card ym09-form-section">
      {/* Standardized Section Header Banner */}
      <div className="ym09-section-badge">
        <span className="ym09-section-badge-num">1</span>
        <Info size={16} aria-hidden="true" />
        <span>Produce Information</span>
      </div>

      {/* Explicit Development Preview Notice when SAMPLE_HARVEST_BATCHES are active */}
      {mode === 'create' && !dependenciesLoading && isSamplePreview && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type="info">
            <strong>DEVELOPMENT PREVIEW:</strong> Displaying illustrative sample farms and harvest batches while YM07 and YM08 APIs are pending. These sample batches are for UI preview only and are not real database records.
          </Alert>
        </div>
      )}

      {/* Dependency Pending Notice in Create Mode */}
      {mode === 'create' && !dependenciesLoading && dependencyNotice && (
        <div className="ym09-lock-banner" role="status">
          <Info size={16} color="var(--muted)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
          <div>
            <strong>External Module Integration Pending:</strong> {dependencyNotice}
          </div>
        </div>
      )}

      {/* Lock Notice banner when editing an existing listing */}
      {isSourceLocked && (
        <div className="ym09-lock-banner" role="note">
          <Lock size={16} color="var(--muted)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
          <div>
            <strong>Harvest Source Fixed:</strong>{' '}
            {lockReason ||
              'Farm, Harvest Batch, Crop, and Grade are fixed when editing an existing listing to protect original harvest traceability and historical allocations.'}
          </div>
        </div>
      )}

      {/* Clean 2-Column Equal Width Layout (Row 1: Farm, Crop | Row 2: Batch, Grade) */}
      <div className="ym09-produce-info-grid">
        {/* Row 1, Col 1: Select Farm */}
        <div className="ym-field">
          <label htmlFor="produce-farm" className="ym09-field-label">
            <MapPin size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Select Farm <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
            {isSourceLocked && (
              <span title="Locked by active orders">
                <Lock size={12} color="var(--muted)" aria-hidden="true" />
              </span>
            )}
          </label>
          <div className="ym-input-wrap">
            <select
              id="produce-farm"
              value={formState.farmId}
              onChange={handleFarmSelect}
              disabled={isSourceLocked || dependenciesLoading}
              aria-invalid={errors.farmId ? true : undefined}
              aria-describedby={errors.farmId ? 'produce-farm-error' : undefined}
              title={isSourceLocked ? 'Farm origin is fixed on existing listings' : undefined}
              className={`ym09-source-control ${isSourceLocked ? 'ym09-source-control--locked' : 'ym09-source-control--editable'}`}
            >
              <option value="">
                {dependenciesLoading ? 'Loading certified farms...' : 'Choose certified farm...'}
              </option>
              {effectiveFarms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </div>
          {errors.farmId && (
            <p className="ym-field-error" id="produce-farm-error">
              {errors.farmId}
            </p>
          )}
        </div>

        {/* Row 1, Col 2: Crop / Produce (Always Read-Only Derived) */}
        <div className="ym-field">
          <label htmlFor="produce-crop" className="ym09-field-label">
            <Sprout size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Crop / Produce <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
            <span title="Automatically certified from harvest batch">
              <Lock size={12} color="var(--muted)" aria-hidden="true" />
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-crop"
              type="text"
              readOnly
              value={formState.cropName ? `${formState.cropName} (${formState.category})` : 'Select a harvest batch to derive crop'}
              aria-invalid={errors.cropId ? true : undefined}
              aria-describedby={errors.cropId ? 'produce-crop-error' : 'produce-crop-hint'}
              className="ym09-source-control ym09-source-control--locked"
              style={{
                color: formState.cropName ? 'var(--text)' : 'var(--muted)',
                WebkitTextFillColor: formState.cropName ? 'var(--text)' : 'var(--muted)',
              }}
            />
          </div>
          {errors.cropId ? (
            <p className="ym-field-error" id="produce-crop-error">
              {errors.cropId}
            </p>
          ) : (
            <span id="produce-crop-hint" className="ym09-field-hint">
              Crop type is certified and derived directly from the harvest batch.
            </span>
          )}
        </div>

        {/* Row 2, Col 1: Harvest Batch */}
        <div className="ym-field">
          <label htmlFor="produce-batch" className="ym09-field-label">
            <Layers size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Harvest Batch <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
            {isSourceLocked && (
              <span title="Locked by active orders">
                <Lock size={12} color="var(--muted)" aria-hidden="true" />
              </span>
            )}
          </label>
          <div className="ym-input-wrap">
            <select
              id="produce-batch"
              value={formState.batchId}
              onChange={handleBatchSelect}
              disabled={isSourceLocked || dependenciesLoading}
              aria-invalid={errors.batchId ? true : undefined}
              aria-describedby={errors.batchId ? 'produce-batch-error' : 'produce-batch-hint'}
              title={isSourceLocked ? 'Harvest batch is fixed on existing listings' : undefined}
              className={`ym09-source-control ${isSourceLocked ? 'ym09-source-control--locked' : 'ym09-source-control--editable'}`}
            >
              <option value="">
                {dependenciesLoading ? 'Loading eligible harvest batches...' : 'Select verified harvest batch...'}
              </option>
              {formState.batchId && !farmBatches.some((b) => b.id === formState.batchId) && (
                <option value={formState.batchId}>
                  {formState.batchNumber || formState.batchId} — Currently Selected
                </option>
              )}
              {farmBatches.map((batch) => {
                const isCurrentListingBatch = batch.id === formState.batchId;
                const eligible = isEligibleCreateBatch(batch);
                const isDisabled = !isCurrentListingBatch && !eligible;

                let suffix = `— ${batch.availableStockKg} kg available`;
                if (isCurrentListingBatch) {
                  suffix = `— Currently Selected`;
                } else if (batch.status !== 'harvested') {
                  suffix = `— Status: ${batch.status} (Not harvested)`;
                } else if (batch.hasActiveListing) {
                  suffix = `— Already Active on Marketplace`;
                } else if (batch.availableStockKg <= 0) {
                  suffix = `— Depleted (0 kg)`;
                }

                return (
                  <option key={batch.id} value={batch.id} disabled={isDisabled}>
                    {batch.batchNumber} {suffix}
                  </option>
                );
              })}
            </select>
          </div>
          {errors.batchId ? (
            <p className="ym-field-error" id="produce-batch-error">
              {errors.batchId}
            </p>
          ) : (
            <span id="produce-batch-hint" className="ym09-field-hint">
              {isSourceLocked
                ? 'Harvest source is locked to protect active order reservations and commitments.'
                : 'Only harvested batches with unreserved sellable stock can be listed.'}
            </span>
          )}
        </div>

        {/* Row 2, Col 2: Quality Grade (Always Read-Only Derived) */}
        <div className="ym-field">
          <label htmlFor="produce-grade" className="ym09-field-label">
            <Award size={15} color="var(--muted)" aria-hidden="true" />
            <span>
              Grade <span className="ym09-required-mark" aria-hidden="true">*</span>
            </span>
            <span title="Certified grade from harvest batch">
              <Lock size={12} color="var(--muted)" aria-hidden="true" />
            </span>
          </label>
          <div className="ym-input-wrap">
            <input
              id="produce-grade"
              type="text"
              readOnly
              value={formState.gradeName || 'Select a harvest batch to derive grade'}
              aria-invalid={errors.gradeId ? true : undefined}
              aria-describedby={errors.gradeId ? 'produce-grade-error' : 'produce-grade-hint'}
              className="ym09-source-control ym09-source-control--locked"
              style={{
                color: formState.gradeName ? 'var(--text)' : 'var(--muted)',
                WebkitTextFillColor: formState.gradeName ? 'var(--text)' : 'var(--muted)',
              }}
            />
          </div>
          {errors.gradeId ? (
            <p className="ym-field-error" id="produce-grade-error">
              {errors.gradeId}
            </p>
          ) : (
            <span id="produce-grade-hint" className="ym09-field-hint">
              Grade is certified and derived directly from the harvest batch.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
