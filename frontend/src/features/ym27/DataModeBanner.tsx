import { Alert } from '../../components/Alert';
import type { Ym27DataMode } from './api';

export function DataModeBanner({ mode }: { mode: Ym27DataMode | null }) {
  if (mode === 'database') {
    return (
      <div className="ym27-demo-banner">
        <Alert type="info">
          Database mode · Simulated wallet data. YM27 does not make real payments.
        </Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>
    );
  }
  if (mode === 'mock') {
    return (
      <div className="ym27-demo-banner">
        <Alert type="warning">
          Demo data – Simulated wallet and payouts. No real money movement.
        </Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>
    );
  }
  return (
    <div className="ym27-demo-banner">
      <Alert type="info">Wallet data source is not confirmed.</Alert>
      <span className="ym27-demo-tag">YM27</span>
    </div>
  );
}
