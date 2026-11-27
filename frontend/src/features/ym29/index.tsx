// YM29 · Yasindu Janapriya · Market information module router (all 5 assigned screens).
// Mounted at /farmer/market-insights/*, /buyer/market-insights/*, and /admin/market-data/* by App.tsx.

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MarketInsightsPage from './pages/MarketInsightsPage';
import DemandForecastPage from './pages/DemandForecastPage';
import PriceWeatherAdvicePage from './pages/PriceWeatherAdvicePage';
import AdminMarketDataPage from './pages/AdminMarketDataPage';
import DataUploadReviewPage from './pages/DataUploadReviewPage';
import './ym29.css';

export default function YM29() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdminWorkspace = user?.role === 'admin' || pathname.startsWith('/admin');

  if (isAdminWorkspace) {
    return (
      <Routes>
        <Route index element={<AdminMarketDataPage />} />
        <Route path="uploads/new" element={<DataUploadReviewPage />} />
        <Route path="uploads/:id" element={<DataUploadReviewPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route index element={<MarketInsightsPage />} />
      <Route path="forecast" element={<DemandForecastPage />} />
      <Route path="advice" element={<PriceWeatherAdvicePage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
