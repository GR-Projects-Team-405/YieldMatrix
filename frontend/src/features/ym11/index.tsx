import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Alert } from '../../components/Alert';
import { ContentCard } from '../../components/ContentCard';
import BuyerOverviewPage from './BuyerOverviewPage';
import HarvestAvailabilityPage from './HarvestAvailabilityPage';
import MarketplacePage from './MarketplacePage';
import MarketplaceSearchPage from './MarketplaceSearchPage';

// YM11 · Meranga Akash · Buyer marketplace
// Handles both /buyer/overview/* and /buyer/marketplace/* as distinct route trees.
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

  if (pathname.startsWith('/buyer/marketplace')) {
    return (
      <Routes>
        <Route index element={<MarketplacePage />} />
        <Route path="search" element={<MarketplaceSearchPage />} />
        <Route path="harvest-availability" element={<HarvestAvailabilityPage />} />
        <Route path="*" element={<Navigate to="/buyer/marketplace" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route index element={<BuyerOverviewPage />} />
      <Route path="*" element={<Navigate to="/buyer/overview" replace />} />
    </Routes>
  );
}
