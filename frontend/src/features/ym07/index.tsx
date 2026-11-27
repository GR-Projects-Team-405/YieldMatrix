import { Link, Route, Routes } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import AddFarm from './AddFarm';
import EditFarm from './EditFarm';
import FarmDetails from './FarmDetails';
import FarmList from './FarmList';

export default function YM07() {
  return (
    <Routes>
      <Route index element={<FarmList />} />
      <Route path="new" element={<AddFarm />} />
      <Route path=":farmId" element={<FarmDetails />} />
      <Route path=":farmId/edit" element={<EditFarm />} />
      <Route path="*" element={<EmptyState title="Farm page not found" description="Choose a farm from My farms." action={<Link to="/farmer/farms">Back to My farms</Link>} />} />
    </Routes>
  );
}
