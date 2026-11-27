import { Route, Routes } from 'react-router-dom';
import MyDemands from './MyDemands';
// will create the others in the next steps
import CreateDemand from './CreateDemand';
import EditDemand from './EditDemand';
import DemandDetails from './DemandDetails';
import DemandResponses from './DemandResponses';

export default function YM13() {
  return (
    <Routes>
      <Route index element={<MyDemands />} />
      <Route path="new" element={<CreateDemand />} />
      <Route path=":id" element={<DemandDetails />} /> 
      <Route path=":id/edit" element={<EditDemand />} />  
      <Route path=":id/responses" element={<DemandResponses />} /> 
      <Route path="*" element={<p className="p-8 text-gray-500">Page not found.</p>} />
    </Routes>
  );
}