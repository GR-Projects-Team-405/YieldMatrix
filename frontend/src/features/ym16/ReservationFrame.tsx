import { Alert } from '../../components/Alert';
import { Toast } from '../../components/Toast';
import { WorkflowBar } from './WorkflowBar';
import type { ReservationDetail } from './types';
import type { ReactNode } from 'react';

export function ReservationFrame({
  orderId,
  current,
  data,
  loading,
  error,
  notice,
  onCloseNotice,
  children,
}: {
  orderId: string;
  current: string;
  data: ReservationDetail | null;
  loading: boolean;
  error: string;
  notice: string;
  onCloseNotice: () => void;
  children: ReactNode;
}) {
  if (loading) return <p className="loading-state" role="status">Loading reservation…</p>;
  if (!data) return <Alert type="error">{error || 'Reservation is unavailable.'}</Alert>;
  return (
    <div className="ym16-shell">
      <WorkflowBar orderId={orderId} current={current} />
      {error && <Alert type="error">{error}</Alert>}
      {children}
      <Toast message={notice} open={Boolean(notice)} onClose={onCloseNotice} />
    </div>
  );
}
