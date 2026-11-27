import { Route, Routes } from 'react-router-dom';
import HarvestViewSwitch from './HarvestViewSwitch';
import HarvestBatchList from './HarvestBatchList';
import HarvestCalendar from './HarvestCalendar';
import AddHarvestBatch from './AddHarvestBatch';
import UpdateHarvestBatch from './UpdateHarvestBatch';
import HarvestBatchDetails from './HarvestBatchDetails';
import './ym08.css';

export default function YM08() {
  return (
    <Routes>
      <Route element={<HarvestViewSwitch />}>
        <Route index element={<HarvestCalendar />} />
        <Route path="list" element={<HarvestBatchList />} />
      </Route>
      <Route path="new" element={<AddHarvestBatch />} />
      <Route path=":batchId" element={<HarvestBatchDetails />} />
      <Route path=":batchId/edit" element={<UpdateHarvestBatch />} />
      <Route path="*" element={<p>Page not found.</p>} />
    </Routes>
  );
}