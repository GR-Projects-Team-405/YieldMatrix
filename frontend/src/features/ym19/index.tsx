import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { DeliveryAcceptanceReview } from './DeliveryAcceptanceReview';
import { PartialAcceptance } from './PartialAcceptance';
import { MyDisputes } from './MyDisputes';
import { DisputeDetails } from './DisputeDetails';
import { PackageCheck, ShieldAlert } from 'lucide-react';

// YM19 · Pasan Kalhara · Acceptance & disputes
// Module entry point with local sub-routes. WorkspaceLayout provides the topbar and sidebar.
export default function YM19() {
  const navigate = useNavigate();
  const location = useLocation();

  const isDisputes = location.pathname.includes('/disputes');

  return (
    <div className="ym19-module-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Module Navigation Tabs */}
      <nav
        aria-label="Module navigation"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '8px',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/buyer/acceptance')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: !isDisputes ? '#16a34a' : '#f3f4f6',
            color: !isDisputes ? '#ffffff' : '#4b5563',
            transition: 'all 0.15s ease-in-out',
          }}
        >
          <PackageCheck size={16} />
          Delivery Acceptance
        </button>

        <button
          type="button"
          onClick={() => navigate('/buyer/disputes')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: isDisputes ? '#16a34a' : '#f3f4f6',
            color: isDisputes ? '#ffffff' : '#4b5563',
            transition: 'all 0.15s ease-in-out',
          }}
        >
          <ShieldAlert size={16} />
          My Disputes
        </button>
      </nav>

      {/* Subroutes within YM19 */}
      <Routes>
        <Route index element={isDisputes ? <MyDisputes /> : <DeliveryAcceptanceReview />} />
        <Route path="partial/:id" element={<PartialAcceptance />} />
        <Route path=":id" element={isDisputes ? <DisputeDetails /> : <PartialAcceptance />} />
      </Routes>
    </div>
  );
}
