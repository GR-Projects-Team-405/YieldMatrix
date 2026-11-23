import { Info, MapPin, Sprout, Layers, Award, Lock } from 'lucide-react';
import type { ProduceListingFormState, AddProduceValidationErrors, HarvestBatchOption } from '../../types/produce';

interface ProduceInformationFormProps {
  formState: ProduceListingFormState;
  errors: AddProduceValidationErrors;
  farms: Array<{ id: string; name: string }>;
  harvestBatches: HarvestBatchOption[];
  isSourceLocked?: boolean;
  lockReason?: string;
  onFarmChange: (farmId: string, farmName: string) => void;
  onBatchChange: (batch: HarvestBatchOption) => void;
}

export function ProduceInformationForm({
  formState,
  errors,
  farms,
  harvestBatches,
  isSourceLocked = false,
  lockReason,
  onFarmChange,
  onBatchChange,
}: ProduceInformationFormProps) {
  // Filter harvest batches for the currently selected farm
  const farmBatches = harvestBatches.filter((b) => !formState.farmId || b.farmId === formState.farmId);

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

      {/* Lock Notice banner when listing has active reservations or commitments */}
      {isSourceLocked && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--canvas)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--text)',
          }}
        >
          <Lock size={16} color="var(--muted)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
          <div>
            <strong>Harvest Source Locked:</strong>{' '}
            {lockReason ||
              'Source batch cannot be changed because this listing has active reservations or commitments. Reassigning batches under active holds is prevented to protect order integrity.'}
          </div>
        </div>
      )}

      {/* Clean 2-Column Equal Width Layout (Row 1: Farm, Crop | Row 2: Batch, Grade) */}
      <div className="ym09-produce-info-grid">
        {/* Row 1, Col 1: Select Farm */}
        <div className="ym-field">
          <label htmlFor="produce-farm" className="ym09-field-label">
            <MapPin size={15} color="var(--muted)" aria-hidden="true" />
            <span>Select Farm <span style={{ color: '#b42318' }}>*</span></span>
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
              disabled={isSourceLocked}
              aria-invalid={errors.farmId ? true : undefined}
              aria-describedby={errors.farmId ? 'produce-farm-error' : undefined}
              title={isSourceLocked ? 'Farm origin cannot be changed while active reservations exist' : undefined}
              className={`ym09-source-control ${isSourceLocked ? 'ym09-source-control--locked' : 'ym09-source-control--editable'}`}
              style={errors.farmId ? { borderColor: '#b42318' } : undefined}
            >
              <option value="">Choose certified farm...</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </div>
          {errors.farmId && (
            <p className="ym-field-error" id="produce-farm-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.farmId}
            </p>
          )}
        </div>

        {/* Row 1, Col 2: Crop / Produce (Always Read-Only Derived) */}
        <div className="ym-field">
          <label htmlFor="produce-crop" className="ym09-field-label">
            <Sprout size={15} color="var(--muted)" aria-hidden="true" />
            <span>Crop / Produce <span style={{ color: '#b42318' }}>*</span></span>
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
              className="ym09-source-control ym09-source-control--locked"
              style={{
                color: formState.cropName ? 'var(--text)' : 'var(--muted)',
                WebkitTextFillColor: formState.cropName ? 'var(--text)' : 'var(--muted)',
                ...(errors.cropId ? { borderColor: '#b42318' } : {}),
              }}
            />
          </div>
          {errors.cropId ? (
            <p className="ym-field-error" id="produce-crop-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.cropId}
            </p>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Crop type is certified and derived directly from the harvest batch.
            </span>
          )}
        </div>

        {/* Row 2, Col 1: Harvest Batch */}
        <div className="ym-field">
          <label htmlFor="produce-batch" className="ym09-field-label">
            <Layers size={15} color="var(--muted)" aria-hidden="true" />
            <span>Harvest Batch <span style={{ color: '#b42318' }}>*</span></span>
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
              disabled={isSourceLocked}
              aria-invalid={errors.batchId ? true : undefined}
              aria-describedby={errors.batchId ? 'produce-batch-error' : 'produce-batch-hint'}
              title={isSourceLocked ? 'Harvest batch cannot be changed while active reservations exist' : undefined}
              className={`ym09-source-control ${isSourceLocked ? 'ym09-source-control--locked' : 'ym09-source-control--editable'}`}
              style={errors.batchId ? { borderColor: '#b42318' } : undefined}
            >
              <option value="">Select verified harvest batch...</option>
              {farmBatches.map((batch) => {
                const isCurrentListingBatch = batch.id === formState.batchId;
                const isHarvested = batch.status === 'harvested';
                const isDuplicate = !isCurrentListingBatch && batch.hasActiveListing;
                const isDisabled = !isCurrentListingBatch && (!isHarvested || isDuplicate || batch.availableStockKg <= 0);

                let suffix = `— ${batch.availableStockKg} kg available`;
                if (isCurrentListingBatch) {
                  suffix = `— Currently Selected`;
                } else if (!isHarvested) {
                  suffix = `— Status: ${batch.status} (Not harvested)`;
                } else if (isDuplicate) {
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
            <p className="ym-field-error" id="produce-batch-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.batchId}
            </p>
          ) : (
            <span id="produce-batch-hint" style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
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
            <span>Grade <span style={{ color: '#b42318' }}>*</span></span>
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
              className="ym09-source-control ym09-source-control--locked"
              style={{
                color: formState.gradeName ? 'var(--text)' : 'var(--muted)',
                WebkitTextFillColor: formState.gradeName ? 'var(--text)' : 'var(--muted)',
                ...(errors.gradeId ? { borderColor: '#b42318' } : {}),
              }}
            />
          </div>
          {errors.gradeId ? (
            <p className="ym-field-error" id="produce-grade-error" style={{ color: '#b42318', fontSize: '12px', margin: '4px 0 0 0' }}>
              {errors.gradeId}
            </p>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Grade is certified and derived directly from the harvest batch.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
