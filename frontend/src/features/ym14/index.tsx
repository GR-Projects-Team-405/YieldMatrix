import { Routes, Route, useLocation, Link } from 'react-router-dom';
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

  const isScreen1 = path.includes('/offers') && !path.includes('/compare');
  const isScreen2 = path.includes('/offers/compare');
  const isScreen3 = path.endsWith('/commitments') || path.endsWith('/commitments/');
  const isScreen4 = path.includes('/commitments/') && !path.includes('/change-review') && !isScreen3;
  const isScreen5 = path.includes('/change-review');

  return (
    <div className="ym14-container">
      {/* Quick-switch navigation banner for seamless review and evaluation */}
      <nav className="ym14-nav-bar" aria-label="YM14 Screen Switcher">
        <span className="label">YM14 Screens:</span>
        <Link
          to="/buyer/offers/OFF-2026-0842"
          className={`ym14-nav-pill ${isScreen1 ? 'active' : ''}`}
        >
          1. Offer Details (YM14_01)
        </Link>
        <Link
          to="/buyer/offers/compare/DM-1042"
          className={`ym14-nav-pill ${isScreen2 ? 'active' : ''}`}
        >
          2. Offer Comparison (YM14_02)
        </Link>
        <Link
          to="/buyer/commitments"
          className={`ym14-nav-pill ${isScreen3 ? 'active' : ''}`}
        >
          3. Commitments List (YM14_03)
        </Link>
        <Link
          to="/buyer/commitments/c1042"
          className={`ym14-nav-pill ${isScreen4 ? 'active' : ''}`}
        >
          4. Commitment Details (YM14_04)
        </Link>
        <Link
          to="/buyer/commitments/c1041/change-review"
          className={`ym14-nav-pill ${isScreen5 ? 'active' : ''}`}
        >
          5. Change Review (YM14_05)
        </Link>
      </nav>

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
