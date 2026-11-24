import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../../components/Button';
import type { ProduceListingDetailView, ListingDetailsTabId } from '../types/produce';
import { getProduceListingDetails } from '../services/produceApi';
import { ProduceDetailsHeader } from '../components/details/ProduceDetailsHeader';
import { ProduceSummaryCard } from '../components/details/ProduceSummaryCard';
import { ProduceDetailsMetrics } from '../components/details/ProduceDetailsMetrics';
import { ProduceDetailsTabBar } from '../components/details/ProduceDetailsTabBar';
import { OverviewTab } from '../components/details/OverviewTab';
import { AllocationsTab } from '../components/details/AllocationsTab';
import { PriceHistoryTab } from '../components/details/PriceHistoryTab';
import { ActivityTab } from '../components/details/ActivityTab';
import '../styles/produceDetails.css';

/**
 * YM09 – Produce Listing Details Page
 * Developer: Imalka Randev
 * Route: /farmer/produce/:id
 *
 * Provides a comprehensive, tabbed interface showcasing:
 * - Listing Overview & description
 * - Active Allocations & Orders
 * - Price Trend & Price Change History
 * - Complete Activity Log in Asia/Colombo time
 */
export default function ProduceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<ProduceListingDetailView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ListingDetailsTabId>('overview');
  const [reloadCounter, setReloadCounter] = useState<number>(0);

  const handleRetry = useCallback(() => {
    setReloadCounter((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;

    setActiveTab('overview');

    if (!id) {
      setListing(null);
      setError('No listing ID provided.');
      setLoading(false);
      return;
    }

    async function loadDetails(listingId: string) {
      try {
        setLoading(true);
        setError(null);
        const data = await getProduceListingDetails(listingId);
        if (active) {
          setListing(data);
        }
      } catch (err: unknown) {
        if (active) {
          const message =
            err instanceof Error ? err.message : 'Failed to load produce listing details.';
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetails(id);
    return () => {
      active = false;
    };
  }, [id, reloadCounter]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div
        className="ym09-produce-details-page"
        role="status"
        aria-label="Loading produce listing details"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--disabled)' }} />
          <div>
            <div style={{ width: '220px', height: '24px', borderRadius: '6px', background: 'var(--disabled)', marginBottom: '8px' }} />
            <div style={{ width: '320px', height: '14px', borderRadius: '4px', background: 'var(--disabled)' }} />
          </div>
        </div>
        <div style={{ height: '220px', borderRadius: '16px', background: 'var(--disabled)', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: '110px', borderRadius: '14px', background: 'var(--disabled)' }} />
          ))}
        </div>
      </div>
    );
  }

  // Error / Not Found State
  if (error || !listing) {
    return (
      <div className="ym09-produce-details-page" style={{ paddingTop: '24px' }}>
        <div className="ym-empty-state ym09-details-error-card">
          <div className="ym09-details-error-icon">
            <AlertCircle size={24} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
            {error ? 'Unable to Load Produce Listing' : 'Produce Listing Not Found'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
            {error || 'The requested produce listing does not exist or may have been removed.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Button
              variant="outline"
              onClick={() => navigate('/farmer/produce')}
            >
              Back to Produce
            </Button>
            {error && (
              <Button
                variant="primary"
                onClick={handleRetry}
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ym09-produce-details-page">
      {/* 1. Header with Breadcrumb and Back Navigation */}
      <ProduceDetailsHeader
        title="Produce Listing Details"
        subtitle="Complete information about this produce listing."
        onBack={() => navigate('/farmer/produce')}
      />

      {/* 2. Top Produce Summary Hero Card */}
      <ProduceSummaryCard
        listing={listing}
        onEditListing={() => navigate(`/farmer/produce/${listing.id}/edit`)}
      />

      {/* 3. Authoritative Metric Strip */}
      <ProduceDetailsMetrics listing={listing} />

      {/* 4. Details Tab Navigation Bar */}
      <ProduceDetailsTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 5. Active Tab Body (connected tabpanel inside single WorkspaceLayout <main>) */}
      <div
        id="ym09-tab-content-panel"
        role="tabpanel"
        aria-labelledby={`ym09-tab-${activeTab}`}
        aria-live="polite"
      >
        {activeTab === 'overview' && (
          <OverviewTab listing={listing} />
        )}
        {activeTab === 'allocations' && (
          <AllocationsTab listing={listing} />
        )}
        {activeTab === 'price-history' && (
          <PriceHistoryTab listing={listing} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab listing={listing} />
        )}
      </div>
    </div>
  );
}
