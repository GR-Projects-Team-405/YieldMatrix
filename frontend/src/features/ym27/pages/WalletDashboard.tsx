import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { Button } from '../../../components/Button';
import {
  MOCK_WALLET_SUMMARY,
  MOCK_TRANSACTIONS,
  MOCK_SETTLEMENTS,
  MOCK_PAYOUTS,
  formatLKR,
} from '../mockData';

// ── Derived values (computed from existing mock data, nothing invented) ────────

/** Total paid out = sum of all confirmed payout amounts */
const totalPaidOut = MOCK_PAYOUTS
  .filter((p) => p.status === 'confirmed')
  .reduce((sum, p) => sum + p.amount, 0);

/** Recent transactions — first 3 */
const recentTransactions = MOCK_TRANSACTIONS.slice(0, 3);

/** Next expected settlement — first pending settlement */
const nextSettlement = MOCK_SETTLEMENTS.find((s) => s.status === 'pending');

// ── SVG icons (inline to avoid new dependencies) ─────────────────────────────

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.5" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 10h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5H5a2 2 0 00-2 2v6a2 2 0 002 2h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 1.5L3 3.5v4c0 3.1 2.1 5.4 5 6.5 2.9-1.1 5-3.4 5-6.5v-4L8 1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M6 8l1.5 1.5L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Helper: format date ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Dashboard component ──────────────────────────────────────────────────────

export default function WalletDashboard() {
  return (
    <div>
      {/* ── Demo banner ──────────────────────────────────────────────── */}
      <div className="ym27-demo-banner">
        <Alert type="warning">
          Demo data – Simulated wallet and payouts. No real money movement.
        </Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────── */}
      <nav className="ym27-tabs" aria-label="Wallet sections">
        <Link to="/farmer/wallet" className="ym27-tab ym27-tab--active">Overview</Link>
        <Link to="/farmer/wallet/transactions" className="ym27-tab">Transactions</Link>
        <Link to="/farmer/wallet/payout/history" className="ym27-tab">Payout history</Link>
        <Link to="/farmer/wallet/payout/request" className="ym27-tab">Request payout</Link>
      </nav>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="ym27-page-header">
        <div>
          <h1>Farmer wallet</h1>
          <p>Your harvest earnings, settlements and scheduled payouts in one place.</p>
        </div>
        <Link to="/farmer/wallet/payout/request">
          <Button variant="primary">↗ Request simulated payout</Button>
        </Link>
      </div>

      {/* ── Balance summary cards ────────────────────────────────────── */}
      <div className="ym27-balance-grid">
        {/* Available balance — dark green card */}
        <div className="ym27-balance-card ym27-balance-card--primary">
          <span className="ym27-balance-label">
            <span className="ym27-balance-icon"><WalletIcon /></span>
            Available balance
          </span>
          <span className="ym27-balance-value">{formatLKR(MOCK_WALLET_SUMMARY.availableBalance)}</span>
          <span className="ym27-balance-sub">Ready for simulated payouts</span>
        </div>

        {/* Pending settlements */}
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">
            <span className="ym27-balance-icon"><ClockIcon /></span>
            Pending settlements
          </span>
          <span className="ym27-balance-value">{formatLKR(MOCK_WALLET_SUMMARY.pendingSettlements)}</span>
          <span className="ym27-balance-sub">
            {MOCK_SETTLEMENTS.filter((s) => s.status === 'pending').length} pending settlement{MOCK_SETTLEMENTS.filter((s) => s.status === 'pending').length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Total received */}
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">
            <span className="ym27-balance-icon"><ArrowUpIcon /></span>
            Total received
          </span>
          <span className="ym27-balance-value">{formatLKR(MOCK_WALLET_SUMMARY.totalEarned)}</span>
          <span className="ym27-balance-sub">
            {MOCK_SETTLEMENTS.filter((s) => s.status === 'confirmed').length} confirmed settlements · All time
          </span>
        </div>

        {/* Total paid out */}
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">
            <span className="ym27-balance-icon"><ArrowOutIcon /></span>
            Total paid out
          </span>
          <span className="ym27-balance-value">{formatLKR(totalPaidOut)}</span>
          <span className="ym27-balance-sub">
            {MOCK_PAYOUTS.filter((p) => p.status === 'confirmed').length} completed payouts
          </span>
        </div>
      </div>

      {/* ── Recent transactions ──────────────────────────────────────── */}
      <section>
        <div className="ym27-section-header">
          <div>
            <h2>Recent transactions</h2>
            <p>The latest credits and debits in your simulated wallet.</p>
          </div>
          <Link to="/farmer/wallet/transactions" className="ym27-view-all">
            View all transactions →
          </Link>
        </div>

        <Table headers={['Date', 'Transaction', 'Reference', 'Type', 'Amount (LKR)', 'Status']}>
          {recentTransactions.map((txn) => (
            <TableRow
              key={txn.id}
              className={txn.settlementId ? 'ym27-clickable-row' : ''}
              onClick={undefined}
            >
              <td>{formatDate(txn.date)}</td>
              <td>
                {txn.settlementId ? (
                  <Link
                    to={`/farmer/wallet/settlement/${txn.settlementId}`}
                    style={{ color: 'var(--accent-text)', fontWeight: 500 }}
                  >
                    {txn.description}
                  </Link>
                ) : (
                  txn.description
                )}
              </td>
              <td style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {txn.settlementId?.toUpperCase() || '—'}
              </td>
              <td style={{ textTransform: 'capitalize' }}>{txn.type}</td>
              <td>
                <span className={txn.type === 'credit' ? 'ym27-amount--credit' : 'ym27-amount--debit'}>
                  {txn.type === 'credit' ? '+' : '−'}{formatLKR(txn.amount)}
                </span>
              </td>
              <td><StatusBadge status={txn.status} /></td>
            </TableRow>
          ))}
        </Table>

      </section>

      {/* ── Bottom info row ──────────────────────────────────────────── */}
      <div className="ym27-info-row">
        {/* Next expected settlement */}
        <div className="ym27-info-card">
          <h3>
            <span className="ym27-info-icon"><ClockIcon /></span>
            Next expected settlement
            {nextSettlement && (
              <StatusBadge status="Pending" />
            )}
          </h3>
          {nextSettlement ? (
            <div className="ym27-settlement-detail">
              <div className="ym27-settlement-row">
                <div>
                  <span className="ym27-settlement-produce">
                    {nextSettlement.produce} · Grade A · {nextSettlement.quantityKg} kg
                  </span>
                  <div className="ym27-settlement-meta">
                    {nextSettlement.orderId} · {formatDate(nextSettlement.date)}
                  </div>
                </div>
                <span className="ym27-settlement-amount">{formatLKR(nextSettlement.grossAmount)}</span>
              </div>
            </div>
          ) : (
            <p className="ym27-info-note">No pending settlements at this time.</p>
          )}
        </div>

        {/* Safe place info card */}
        <div className="ym27-info-card">
          <h3>
            <span className="ym27-info-icon"><ShieldIcon /></span>
            A safe place to try payouts
          </h3>
          <p className="ym27-info-note">
            New payout requests stay pending for this session and do not change this balance.
          </p>
        </div>
      </div>
    </div>
  );
}
