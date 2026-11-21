import { Route, Routes } from 'react-router-dom';
import PickupStopsPage from './PickupStopsPage';
import PickupStopDetailsPage from './PickupStopDetailsPage';

// WorkspaceLayout owns the sidebar and topbar; YM23 renders module content only.
export default function YM23() {
  return (
    <Routes>
      <Route index element={<PickupStopsPage />} />
      <Route path="history" element={<PickupStopsPage />} />
      <Route path=":stopId" element={<PickupStopDetailsPage />} />
      <Route path="*" element={<PickupStopsPage />} />
    </Routes>
  );
}
