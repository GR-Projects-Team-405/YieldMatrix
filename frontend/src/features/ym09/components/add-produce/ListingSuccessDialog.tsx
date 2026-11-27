import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../../../components/Button';
import type { ProduceListingFormState } from '../../types/produce';

export interface ListingSuccessDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  formState: ProduceListingFormState;
  estimatedValue: number;
  onKeepEditing: () => void;
  onReturnToList: () => void;
}

/**
 * Confirmation modal shown after publishing or updating a produce listing.
 */
export function ListingSuccessDialog({
  open,
  mode,
  formState,
  estimatedValue,
  onKeepEditing,
  onReturnToList,
}: ListingSuccessDialogProps) {
  const dialogPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    dialogPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onKeepEditing();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [open, onKeepEditing]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      className="ym09-dialog-overlay"
    >
      <div ref={dialogPanelRef} className="ym-confirm-dialog ym09-dialog-panel">
        <div className="ym09-dialog-success-icon">
          <Check size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>

        <h3
          id="success-modal-title"
          style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}
        >
          {mode === 'edit'
            ? 'Listing Updated Successfully'
            : formState.status === 'draft'
              ? 'Listing Draft Saved'
              : 'Listing Published Successfully'}
        </h3>

        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
          {mode === 'edit'
            ? 'The produce listing details have been updated in-place. Listing ID and historical integrity are preserved.'
            : formState.status === 'draft'
              ? 'Your produce listing has been saved as a draft. You can activate it when ready to publish to buyers.'
              : 'Your harvest listing has been published to the marketplace and is now discoverable.'}
        </p>

        {/* Summary Details */}
        <div className="ym09-dialog-summary">
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
            onClick={onKeepEditing}
            style={{ height: '42px', borderRadius: '10px' }}
          >
            Keep Editing
          </Button>
          <Button
            variant="primary"
            onClick={onReturnToList}
            style={{ height: '42px', borderRadius: '10px' }}
          >
            Return to My Produce
          </Button>
        </div>
      </div>
    </div>
  );
}
