import { useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Package, PanelsTopLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateRange, formatKg, formatLkr, formatUpdatedLabel } from './formatters';
import { useComparison, MAX_COMPARE } from './ComparisonContext';
import { ProduceImage } from './ProduceImage';
import { SupplierSummaryCard } from './SupplierSummaryCard';
import { TrustNotice } from './TrustNotice';
import { useProduceDetails } from './useProduceDetails';
import './styles.css';
function LoadingDetails() {
  return <div className="ym12-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="ym12-skeleton ym12-skeleton--eyebrow" /><span className="ym12-skeleton ym12-skeleton--title" />
    <span className="ym12-skeleton ym12-skeleton--subtitle" />
    <div className="ym12-loading-grid"><span className="ym12-skeleton ym12-skeleton--image" /><span className="ym12-skeleton ym12-skeleton--details" /></div>
    <span className="sr-only">Loading produce details…</span>
  </div>;
}
export function ProduceDetailsPage({ listingId }: { listingId: string }) {
  const { state, retry } = useProduceDetails(listingId);
  const { isCompared, canAdd, toggle, listingIds } = useComparison();
  const navigate = useNavigate();
  const [compareMessage, setCompareMessage] = useState('');
  if (state.status === 'loading') return <LoadingDetails />;
  if (state.status === 'notFound') return <div className="ym12-state-wrap"><EmptyState title="Produce listing not found" description="This listing may have expired, sold out, or been removed. Browse produce to choose another listing." /></div>;
  if (state.status === 'error') return <div className="ym12-state-wrap"><Alert type="error">We couldn’t load this listing. Check your connection and try again.</Alert><Button variant="outline" onClick={retry}>Retry</Button></div>;
  const { data } = state; const { listing, supplier } = data;
  const compared = isCompared(listing.id); const canCompare = canAdd(listing.id);
  function handleCompare() {
    const added = toggle(listing.id);
    setCompareMessage(added
      ? `Added to comparison. ${listingIds.length + 1} of ${MAX_COMPARE} listings selected.`
      : `Removed from comparison. ${Math.max(0, listingIds.length - 1)} of ${MAX_COMPARE} listings selected.`);
  }
  return <div className="ym12-page">
    <nav className="ym12-breadcrumb" aria-label="Breadcrumb"><ol>
      <li><span>Browse produce</span></li><li aria-hidden="true">/</li><li><span>{listing.category}</span></li><li aria-hidden="true">/</li><li aria-current="page">{listing.cropName}</li>
    </ol></nav>
    <header className="ym12-heading-row"><div><h1>Produce details</h1><p>Know your harvest. Source with confidence.</p></div>
      <p className="ym12-listing-meta">Listing {listing.displayId} <span aria-hidden="true">·</span> {data.dataSource === 'sample' ? 'Updated today' : formatUpdatedLabel(listing.updatedAt)}</p>
    </header>
    {data.dataSource === 'sample' && <Alert type="info">Sample listing data for development. Supplier ratings and product details are illustrative.</Alert>}
    <div className="ym12-details-grid">
      <div className="ym12-visual-column"><ProduceImage imageUrl={listing.imageUrl} cropName={listing.cropName} /><TrustNotice data={data} /></div>
      <section className="ym12-info-column" aria-labelledby="ym12-crop-title">
        <div className="ym12-badge-row"><StatusBadge status={listing.grade} /><StatusBadge status="Harvest ready" /><span className="ym12-category">{listing.category}</span></div>
        <div className="ym12-crop-heading"><h3 id="ym12-crop-title">{listing.cropName}</h3><p>{listing.description}</p></div>
        <div className="ym12-price-block"><p className="ym12-price"><strong>{formatLkr(listing.pricePerKgCents)}</strong><span>LKR per kg</span></p><span className="ym12-price-note">Supplier listed price</span></div>
        <dl className="ym12-facts">
          <div className="ym12-fact"><dt><Package size={20} aria-hidden="true" />Available quantity</dt><dd>{formatKg(listing.availableKg)}</dd></div>
          <div className="ym12-fact"><dt><MapPin size={20} aria-hidden="true" />District</dt><dd>{listing.district}</dd></div>
          <div className="ym12-fact ym12-fact--wide"><dt><CalendarDays size={20} aria-hidden="true" />Harvest availability</dt><dd>{formatDateRange(listing.harvestStart, listing.harvestEnd)}</dd></div>
        </dl>
        <SupplierSummaryCard data={data} />
        <div className="ym12-actions">
          <Button variant="outline" className="ym12-action-button" onClick={handleCompare} disabled={!canCompare} aria-pressed={compared}
            aria-label={compared ? `Remove ${listing.cropName} from comparison` : `Add ${listing.cropName} to comparison`}>
            <PanelsTopLeft size={18} aria-hidden="true" />{compared ? 'Remove from comparison' : 'Add to comparison'}
          </Button>
          <Button variant="primary" className="ym12-action-button" onClick={() => navigate('/buyer/bulk-matching', { state: { crop: listing.cropName, grade: listing.grade } })}>
            Start bulk match <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
        {listingIds.length > 0 && <Link className="ym12-compare-selected-link" to="/buyer/suppliers/compare">
          Compare selected listings ({listingIds.length})
        </Link>}
        <p className="ym12-action-feedback" role="status" aria-live="polite">{compareMessage || (!canCompare ? `Comparison limit reached (${MAX_COMPARE}). Remove a listing to add another.` : '')}</p>
      </section>
    </div>
    <p className="ym12-units-note">All quantities in kg · Prices in LKR per kg · Harvest dates shown in Asia/Colombo (UTC+05:30)</p>
    <p className="sr-only">Supplier: {supplier.name}</p>
  </div>;
}
