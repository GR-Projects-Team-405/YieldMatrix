
import { Route, Routes } from 'react-router-dom';

import PublicLayout from './components/PublicLayout';
import RoleSelectionPage from './pages/RoleSelectionPage';
import FarmerAuthPage from './pages/FarmerAuthPage';
import BuyerAuthPage from './pages/BuyerAuthPage';

import './styles/ym03.css';

export default function YM03() {
  return (
    <PublicLayout>
      <Routes>
        <Route index element={<RoleSelectionPage />} />

        <Route
          path="farmer"
          element={<FarmerAuthPage />}
        />

        <Route
          path="buyer"
          element={<BuyerAuthPage />}
        />

        <Route
          path="*"
          element={
            <div className="ym03-checkpoint">
              <h1>Page under development</h1>
              <p>Other YM-03 pages will be added next.</p>
            </div>
          }
        />
      </Routes>
    </PublicLayout>
  );
}
