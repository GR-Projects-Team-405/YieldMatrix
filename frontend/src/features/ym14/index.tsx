import { Routes, Route, useLocation } from 'react-router-dom';
import ReceivedOfferDetails from './ReceivedOfferDetails';
import OfferComparison from './OfferComparison';
import CommitmentsList from './CommitmentsList';
import CommitmentDetails from './CommitmentDetails';
import HarvestChangeReview from './HarvestChangeReview';
import './ym14.css';

/**
 * YM14: Offers & Commitments (Lead: Mohomad Mushrif)
 * Dispatches subroutes across the 5 assigned screens:
 * 1. Received Offer Details (YM14_01): /buyer/offers/:id
 * 2. Offer Comparison (YM14_02): /buyer/offers/compare/:demandId
 * 3. Commitments List (YM14_03): /buyer/commitments & /farmer/commitments
 * 4. Commitment Details (YM14_04): /buyer/commitments/:id & /farmer/commitments/:id
 * 5. Harvest Change Review (YM14_05): /buyer/commitments/:id/change-review
 */
export default function YM14() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="ym14-container">
      {/* Subroute rendering based on URL path */}
      {path.includes('/commitments') ? (
        <Routes>
          <Route path=":id/change-review" element={<HarvestChangeReview />} />
          <Route path=":id" element={<CommitmentDetails />} />
          <Route index element={<CommitmentsList />} />
          <Route path="*" element={<CommitmentsList />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="compare/:demandId" element={<OfferComparison />} />
          <Route path=":id" element={<ReceivedOfferDetails />} />
          <Route index element={<ReceivedOfferDetails />} />
          <Route path="*" element={<ReceivedOfferDetails />} />
        </Routes>
      )}
    </div>
  );
}
