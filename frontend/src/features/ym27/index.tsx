import { Route, Routes, Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import WalletDashboard from './pages/WalletDashboard';
import WalletTransactions from './pages/WalletTransactions';
import SettlementBreakdown from './pages/SettlementBreakdown';
import PayoutRequest from './pages/PayoutRequest';
import PayoutHistory from './pages/PayoutHistory';
import { PayoutStateProvider } from './payoutState';
import './ym27.css';
// YM27 · Udith Rashan · Farmer wallet
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.

export default function YM27() {
  return (
    <PayoutStateProvider>
      <Routes>
        <Route index element={<WalletDashboard />} />
        <Route path="transactions" element={<WalletTransactions />} />
        <Route path="settlement/:settlementId" element={<SettlementBreakdown />} />
        <Route path="payout/request" element={<PayoutRequest />} />
        <Route path="payout/history" element={<PayoutHistory />} />
        <Route path="*" element={
          <ContentCard title="Page not found">
            <p className="module-note">This YM27 page does not exist.</p>
            <Link to="/farmer/wallet">← Back to Wallet</Link>
          </ContentCard>
        } />
      </Routes>
    </PayoutStateProvider>
  );
}
