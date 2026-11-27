import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ProduceListingForm } from '../components/add-produce/ProduceListingForm';
import { getProduceListingById } from '../services/produceApi';
import { mapListingToFormState } from '../utils/produceFormDefaults';
import type { ProduceListingView } from '../types/produce';

/**
 * Edit Produce Listing Page (/farmer/produce/:id/edit)
 * Loads an existing produce listing from backend (or explicit dev sample mode),
 * keeps Farm, Batch, Crop, and Grade fixed to preserve original batch traceability,
 * and allows updating Quantity, Pricing, and Availability dates.
 */
export function EditProducePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<ProduceListingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    if (!id) {
      setListing(null);
      setError('No produce listing ID provided.');
      setLoading(false);
      return;
    }

    async function loadListing(listingId: string) {
      setLoading(true);
      setError(null);
      try {
        const found = await getProduceListingById(listingId);
        if (!found) {
          throw new Error(`Produce listing with ID "${listingId}" was not found.`);
        }
        if (active) {
          setListing(found);
        }
      } catch (err: unknown) {
        if (active) {
          setListing(null);
          const message = err instanceof Error ? err.message : 'Failed to load listing.';
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadListing(id);
    return () => {
      active = false;
    };
  }, [id]);

  const initialFormData = listing ? mapListingToFormState(listing) : undefined;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)' }}
      >
        <p style={{ fontSize: '15px' }}>Loading produce listing details…</p>
      </div>
    );
  }

  if (error || !listing || !initialFormData) {
    return (
      <div style={{ display: 'grid', gap: '16px', maxWidth: '600px', margin: '40px auto 0 auto' }}>
        <Alert type="error">
          <strong>Unable to load listing:</strong> {error || 'Listing not found'}
        </Alert>
        <div>
          <Button variant="primary" onClick={() => navigate('/farmer/produce')}>
            Return to My Produce
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProduceListingForm
      mode="edit"
      pageTitle="Edit Produce Listing"
      pageSubtitle="Update the product details for this listing"
      submitButtonLabel="Update Listing"
      initialData={initialFormData}
      existingListing={listing}
      onCancel={() => navigate('/farmer/produce')}
    />
  );
}

export default EditProducePage;
