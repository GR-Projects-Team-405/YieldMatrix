import { Route, Routes } from 'react-router-dom';
import MyProducePage from './pages/MyProducePage';
import AddProducePage from './pages/AddProducePage';
import EditProducePage from './pages/EditProducePage';
import ProduceDetailsPage from './pages/ProduceDetailsPage';
import './styles/produceDetails.css';

/**
 * YM09 – Produce Listings
 * Developer: Imalka Randev
 * Main Route: /farmer/produce
 *
 * This entry point manages module-specific sub-routes:
 * - /farmer/produce -> MyProducePage (Listings overview & management)
 * - /farmer/produce/new -> AddProducePage (Create & publish produce listing)
 * - /farmer/produce/:id -> ProduceDetailsPage (Produce Listing Details, Allocations, Price History, Activity)
 * - /farmer/produce/:id/edit -> EditProducePage (Edit existing produce listing)
 *
 * WorkspaceLayout owns the shared sidebar and topbar.
 */
export default function YM09() {
  return (
    <Routes>
      <Route index element={<MyProducePage />} />
      <Route path="new" element={<AddProducePage />} />
      <Route path=":id" element={<ProduceDetailsPage />} />
      <Route path=":id/edit" element={<EditProducePage />} />
      <Route path="*" element={<MyProducePage />} />
    </Routes>
  );
}
