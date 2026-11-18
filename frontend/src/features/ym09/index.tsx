import { Route, Routes } from 'react-router-dom';
import MyProducePage from './pages/MyProducePage';

/**
 * YM09 – Produce Listings
 * Developer: Imalka Randev
 * Main Route: /farmer/produce
 *
 * This entry point manages module-specific sub-routes.
 * WorkspaceLayout owns the shared sidebar and topbar.
 */
export default function YM09() {
  return (
    <Routes>
      <Route index element={<MyProducePage />} />
      {/* Future assigned sub-pages (Add, Edit, Details) will be connected here upon development */}
      <Route path="*" element={<MyProducePage />} />
    </Routes>
  );
}
