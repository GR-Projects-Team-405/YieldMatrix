import { Route, Routes } from 'react-router-dom';
import FarmerDashboard from './pages/FarmerDashboard';
import SalesPerformance from './pages/SalesPerformance';
import UpcomingHarvestOverview from './pages/UpcomingHarvestOverview';
import CompletedOrdersOverview from './pages/CompletedOrdersOverview';
import './ym06.css';

export default function YM06() {
  return <div className="ym06-module"><Routes>
    <Route index element={<FarmerDashboard />} />
    <Route path="sales" element={<SalesPerformance />} />
    <Route path="harvests" element={<UpcomingHarvestOverview />} />
    <Route path="completed-orders" element={<CompletedOrdersOverview />} />
    <Route path="*" element={<FarmerDashboard />} />
  </Routes></div>;
}
