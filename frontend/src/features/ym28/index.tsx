import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import AdminReconciliationPage from './AdminReconciliationPage';
import BuyerWalletPage from './BuyerWalletPage';
import HeldFundsPage from './HeldFundsPage';
import RefundDetailsPage from './RefundDetailsPage';
import SimulatedFundingPage from './SimulatedFundingPage';
import TransactionDetailPage from './TransactionDetailPage';
import './ym28.css';

// YM28 · Umindu Isith · Buyer wallet & reconciliation
// Keeps /buyer/wallet/* and /admin/reconciliation/* strictly separated by route and role.
export default function YM28() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminRoute = location.pathname.startsWith('/admin/reconciliation');
  const isBuyerRoute = location.pathname.startsWith('/buyer/wallet');

  if (isAdminRoute) {
    if (user?.role !== 'admin') {
      return (
        <ContentCard title="Access restricted">
          <Alert type="error">Administrator access is required to view platform wallet reconciliation.</Alert>
        </ContentCard>
      );
    }

    return (
      <Routes>
        <Route index element={<AdminReconciliationPage />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Reconciliation view not found"
              description="The requested reconciliation page does not exist."
              action={
                <Button variant="primary" onClick={() => navigate('/admin/reconciliation')}>
                  Back to reconciliation
                </Button>
              }
            />
          }
        />
      </Routes>
    );
  }

  if (isBuyerRoute) {
    if (user?.role !== 'buyer') {
      return (
        <ContentCard title="Access restricted">
          <Alert type="error">Buyer / Shop access is required to view the Buyer Agri Wallet.</Alert>
        </ContentCard>
      );
    }

    return (
      <Routes>
        <Route index element={<BuyerWalletPage />} />
        <Route path="funding" element={<SimulatedFundingPage />} />
        <Route path="holds" element={<HeldFundsPage />} />
        <Route path="refunds" element={<RefundDetailsPage />} />
        <Route path="transactions/:entryId" element={<TransactionDetailPage />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Wallet page not found"
              description="The requested Buyer Wallet sub-page does not exist."
              action={
                <Button variant="primary" onClick={() => navigate('/buyer/wallet')}>
                  Back to Buyer Wallet
                </Button>
              }
            />
          }
        />
      </Routes>
    );
  }

  return (
    <ContentCard title="YM28 · Buyer wallet & reconciliation">
      <Alert type="error">Unsupported route context for module YM28.</Alert>
    </ContentCard>
  );
}