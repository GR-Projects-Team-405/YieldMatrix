import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ProduceListingForm } from '../components/add-produce/ProduceListingForm';
import { getProduceListingById } from '../services/produceApi';
import {
  DEFAULT_PRODUCT_TAGS,
  DEV_SAMPLE_PRODUCE,
  ENABLE_DEV_SAMPLE_DATA,
  SAMPLE_HARVEST_BATCHES,
} from '../constants/produceConstants';
import {
  getTodayDateInputString,
  getFutureDateInputString,
} from '../utils/produceFormatters';
import type {
  ProduceListingFormState,
  ProduceListingView,
  ProducePlaceholderKey,
} from '../types/produce';

/**
 * Edit Produce Listing Page (/farmer/produce/:id/edit)
 * Loads an existing produce listing, locks harvest source fields,
 * and allows updating permitted parameters (Quantity, Pricing, Dates, Tags, Image).
 */
export function EditProducePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Initialize synchronously from sample data if available to prevent loading flicker
  const [listing, setListing] = useState<ProduceListingView | null>(() => {
    if (ENABLE_DEV_SAMPLE_DATA && id) {
      const found = DEV_SAMPLE_PRODUCE.find((item) => item.id === id);
      return found ? { ...found } : null;
    }
    return null;
  });

  const [error, setError] = useState<string | null>(() => {
    if (ENABLE_DEV_SAMPLE_DATA && id) {
      const found = DEV_SAMPLE_PRODUCE.find((item) => item.id === id);
      if (!found) {
        return `Produce listing with ID "${id}" was not found.`;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => !listing && !error);

  useEffect(() => {
    let active = true;

    async function loadListing() {
      if (listing || error) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (!id) {
          throw new Error('No produce listing ID provided');
        }
        const found = await getProduceListingById(id);
        if (!found) {
          throw new Error(`Produce listing with ID "${id}" was not found.`);
        }
        if (active) {
          setListing(found);
        }
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load listing';
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadListing();
    return () => {
      active = false;
    };
  }, [id, listing]);

  // Map loaded listing to ProduceListingFormState
  const initialFormData = useMemo<ProduceListingFormState | undefined>(() => {
    if (!listing) return undefined;

    // Find batch details from SAMPLE_HARVEST_BATCHES
    const batch = SAMPLE_HARVEST_BATCHES.find((b) => b.id === listing.batchId);

    // Determine placeholder image key based on category
    let imageKey: ProducePlaceholderKey = 'vegetables';
    if (listing.category === 'Fruits') imageKey = 'fruits';
    else if (listing.category === 'Grains') imageKey = 'grains';
    else if (listing.category === 'Spices') imageKey = 'spices';
    else if (listing.category === 'Others') imageKey = 'fresh-produce';

    const fromDate = listing.validFrom ? listing.validFrom.split('T')[0] : getTodayDateInputString();
    const untilDate = listing.validUntil ? listing.validUntil.split('T')[0] : getFutureDateInputString(15);

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
      productTags: [...DEFAULT_PRODUCT_TAGS],
      selectedImageKey: imageKey,
      status: listing.status,
    };
  }, [listing]);

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)' }}>
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
