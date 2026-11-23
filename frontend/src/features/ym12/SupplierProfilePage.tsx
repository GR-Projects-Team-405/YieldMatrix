import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SupplierAboutCard } from './SupplierAboutCard';
import { SupplierHero } from './SupplierHero';
import { SupplierListingCard } from './SupplierListingCard';
import { useSupplierProfile } from './useSupplierProfile';
import './supplier-profile.css';

function SupplierProfileLoading() {
  return <div className="ym12-profile-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading supplier profile…</span>
    <div className="ym12-profile-skeleton-heading"><span /><span /></div>
    <span className="ym12-profile-skeleton-hero" />
    <div className="ym12-profile-skeleton-columns"><span /><span /></div>
  </div>;
}

export function SupplierProfilePage({ supplierId }: { supplierId: string }) {
  const { state, retry } = useSupplierProfile(supplierId);
  const navigate = useNavigate();
  const backToProduce = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === 'number' && historyState.idx > 0) navigate(-1);
    else navigate('/buyer/produce');
  };

  return <div className="ym12-profile-page">
    <div className="ym12-profile-page-heading">
      <div>
        <nav className="ym12-breadcrumb" aria-label="Breadcrumb"><ol>
          <li><span>Suppliers</span></li><li aria-hidden="true">/</li>
          <li aria-current="page">{state.status === 'success' ? state.data.supplier.name : 'Supplier profile'}</li>
        </ol></nav>
        <h1>Supplier profile</h1>
        <p>Public business information to support your sourcing decisions.</p>
      </div>
      <Button variant="outline" className="ym12-profile-back" onClick={backToProduce}>
        <ArrowLeft size={18} aria-hidden="true" />Back to produce
      </Button>
    </div>

    {state.status === 'loading' && <SupplierProfileLoading />}
    {state.status === 'error' && <div className="ym12-profile-state">
      <Alert type="error">We couldn’t load this supplier profile. Check your connection and try again.</Alert>
      <Button variant="outline" onClick={retry}>Retry</Button>
    </div>}
    {state.status === 'notFound' && <div className="ym12-profile-state">
      <EmptyState title="Supplier not found" description="This supplier profile is unavailable or the supplier is not approved."
        action={<Button variant="outline" onClick={() => navigate('/buyer/produce')}>Back to produce</Button>} />
    </div>}
    {state.status === 'success' && <div className="ym12-profile-content">
      <SupplierHero data={state.data} />
      <div className="ym12-profile-columns">
        <SupplierAboutCard data={state.data} />
        <section className="ym12-profile-listings" aria-labelledby="ym12-listings-title">
          <div className="ym12-profile-listings-heading">
            <h2 id="ym12-listings-title">Active listings</h2>
            <span className="ym12-profile-listings-count">{state.data.activeListingCount} active listings</span>
          </div>
          {state.data.activeListings.length > 0
            ? <div className="ym12-profile-listings-grid">
              {state.data.activeListings.map((listing) => <SupplierListingCard key={listing.listingId} listing={listing} />)}
            </div>
            : <EmptyState title="No active listings right now" description="Check back later for this supplier’s available produce." />}
        </section>
      </div>
      <p className="ym12-profile-footer">Public supplier profile · No phone number or address shown · Prices in LKR per kg · Dates: Asia/Colombo (UTC+05:30)</p>
    </div>}
  </div>;
}
