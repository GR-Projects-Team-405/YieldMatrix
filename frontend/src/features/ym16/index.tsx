import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { apiError, ym16Api } from './api';
import BatchReservationReview from './BatchReservationReview';
import FarmerResponseEvaluation from './FarmerResponseEvaluation';
import ReservationConfirmationResult from './ReservationConfirmationResult';
import ReservationStatusCountdown from './ReservationStatusCountdown';
import FarmerReservations from './FarmerReservations';
import './ym16.css';

function ReservationsGate() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await ym16Api.list();
        const open = list.find((item) => !['cancelled', 'expired', 'closed'].includes(item.status)) || list[0];
        if (open) {
          if (active) navigate(`/buyer/reservations/${open.id}/batch-review`, { replace: true });
          return;
        }
        if (active) setError('No reservation is available. Create one from existing buyer commitments.');
      } catch (err) {
        if (active) setError(apiError(err, 'Unable to open reservations. Confirm the API and database are available.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  if (loading) return <p className="loading-state" role="status">Opening reservations…</p>;
  if (error) {
    return (
      <EmptyState
        title="Reservations could not start"
        description={error}
        action={<Button onClick={() => { setError(''); setLoading(true); window.location.reload(); }}>Retry</Button>}
      />
    );
  }
  return <Alert type="info">Preparing your reservation workspace…</Alert>;
}

export default function YM16() {
  const location = useLocation();
  if (location.pathname.startsWith('/farmer/reservations')) {
    return <div className="ym16"><FarmerReservations /></div>;
  }
  return (
    <div className="ym16">
      <Routes>
        <Route index element={<ReservationsGate />} />
        <Route path=":orderId/batch-review" element={<BatchReservationReview />} />
        <Route path=":orderId/status-countdown" element={<ReservationStatusCountdown />} />
        <Route path=":orderId/farmer-evaluation" element={<FarmerResponseEvaluation />} />
        <Route path=":orderId/confirmation-result" element={<ReservationConfirmationResult />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  );
}
