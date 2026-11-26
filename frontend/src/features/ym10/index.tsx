import { Route, Routes, useLocation } from 'react-router-dom';
import BuyerRequestDetails from './BuyerRequestDetails';
import BuyerRequests from './BuyerRequests';
import MyOffers from './MyOffers';
import SubmitOffer from './SubmitOffer';
import './ym10.css';

export default function YM10() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/farmer/offers')) {
    return <MyOffers />;
  }

  return (
    <Routes>
      <Route index element={<BuyerRequests />} />
      <Route path=":requestId" element={<BuyerRequestDetails />} />
      <Route path=":requestId/offer" element={<SubmitOffer />} />
      <Route path="*" element={<p className="ym10-not-found">Page not found.</p>} />
    </Routes>
  );
}
