import { Route, Routes } from 'react-router-dom';
import PickupStopsPage from './PickupStopsPage';
import PickupStopDetailsPage from './PickupStopDetailsPage';
import RecordPickupPage from './RecordPickupPage';
import PickupHistoryPage from './PickupHistoryPage';
import './ym23.css';

// WorkspaceLayout owns the sidebar and topbar; YM23 renders module content only.
export default function YM23() {
  return (
    <Routes>
      <Route index element={<PickupStopsPage />} />
      <Route path="history" element={<PickupHistoryPage />} />
      <Route path=":stopId/record" element={<RecordPickupPage />} />
      <Route path=":stopId" element={<PickupStopDetailsPage />} />
      <Route path="*" element={<PickupStopsPage />} />
    </Routes>
  );
}
