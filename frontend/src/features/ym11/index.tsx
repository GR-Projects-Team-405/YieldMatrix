import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import BuyerOverviewPage from './BuyerOverviewPage';

// YM11 · Meranga Akash · Buyer marketplace
// Handles both /buyer/overview/* and /buyer/marketplace/* as distinct views.
function MarketplacePlaceholder() {
  const navigate = useNavigate();
  const marketplacePages = ['Marketplace', 'Search and filtered results', 'Harvest availability'];

  return (
    <ContentCard title="YM11 · Buyer Marketplace" subtitle="Owner: Meranga Akash">
      <p className="module-note">
        The Buyer Overview dashboard is live on <strong>/buyer/overview</strong>. Marketplace discovery, search results, and harvest availability pages will be added here next.
      </p>
      <h3 className="module-heading">Upcoming Marketplace pages</h3>
      <ul className="assigned-pages">
        {marketplacePages.map((page) => (
          <li key={page}>{page}</li>
        ))}
      </ul>
      <div style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={() => navigate('/buyer/overview')}>
          Go to Buyer Overview
        </Button>
      </div>
    </ContentCard>
  );
}

export default function YM11() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user || user.role !== 'buyer') {
    return (
      <ContentCard title="Access restricted">
        <Alert type="error">This module is available only to approved buyer accounts.</Alert>
      </ContentCard>
    );
  }

  const isMarketplaceRoute = pathname.startsWith('/buyer/marketplace');

  if (isMarketplaceRoute) {
    return (
      <Routes>
        <Route index element={<MarketplacePlaceholder />} />
        <Route path="*" element={<MarketplacePlaceholder />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route index element={<BuyerOverviewPage />} />
      <Route path="*" element={<BuyerOverviewPage />} />
    </Routes>
  );
}
