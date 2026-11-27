import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { formatLKR, type PayoutRecord, type PayoutStatus } from '../mockData';
import { usePayoutState } from '../payoutState';
import { DataModeBanner } from '../DataModeBanner';

const PAGE_SIZE = 4;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function WalletTabs() {
  const tabs = [
    { id: 'overview', label: 'Overview', to: '/farmer/wallet' },
    { id: 'transactions', label: 'Transactions', to: '/farmer/wallet/transactions' },
    { id: 'history', label: 'Payout history', to: '/farmer/wallet/payout/history' },
    { id: 'request', label: 'Request payout', to: '/farmer/wallet/payout/request' },
  ];
  return (
    <nav className="ym27-tabs" aria-label="Wallet sections">
      {tabs.map((tab) => (
        <Link key={tab.id} to={tab.to} className={tab.id === 'history' ? 'ym27-tab ym27-tab--active' : 'ym27-tab'} aria-current={tab.id === 'history' ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function PayoutHistory() {
  const { payouts: payoutData, payoutsLoading, payoutsError, refreshPayouts, dataMode } = usePayoutState();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'all' | PayoutStatus>('all');
  const [page, setPage] = useState(1);

  const combined = useMemo(() => payoutData?.payouts ?? [], [payoutData]);

  const paidOut = combined.filter((payout) => payout.status === 'confirmed').reduce((sum, payout) => sum + payout.amount, 0);
  const inProgress = combined.filter((payout) => payout.status === 'pending').reduce((sum, payout) => sum + payout.amount, 0);
  const confirmedCount = combined.filter((payout) => payout.status === 'confirmed').length;
  const pendingCount = combined.filter((payout) => payout.status === 'pending').length;
  const latest = combined[0];

  const filtered = combined.filter((payout) => {
    if (from && payout.date < from) return false;
    if (to && payout.date > to) return false;
    if (status !== 'all' && payout.status !== status) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    void refreshPayouts();
    const refreshOnFocus = () => { void refreshPayouts(); };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [refreshPayouts]);

  function resetFilters() {
    setFrom('');
    setTo('');
    setStatus('all');
    setPage(1);
  }

  return (
    <div>
      <DataModeBanner mode={dataMode} />

      <WalletTabs />

      <div className="ym27-page-header">
        <div>
          <h1>Payout history</h1>
          <p>{dataMode === 'database'
            ? 'Track payout requests recorded for your approved farmer wallet.'
            : 'Track every simulated payout request and its current status.'}</p>
        </div>
        <Link to="/farmer/wallet/payout/request" className="ym27-header-action">
          {dataMode === 'database' ? 'Payout request options' : 'Request simulated payout'}
        </Link>
      </div>

      {dataMode === 'database' ? (
        <Alert type="info">Payout destinations are not stored in the database. Existing requests are displayed read-only.</Alert>
      ) : (
        <Alert type="info">
          Pending requests stay in temporary server memory for this browser session. They may expire after inactivity or be cleared when the server restarts.
        </Alert>
      )}
      {payoutsLoading && <p role="status">Loading payout history…</p>}
      {payoutsError && <Alert type="error">{payoutsError}</Alert>}

      <div className="ym27-balance-grid ym27-balance-grid--3 ym27-section-gap">
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Total paid out</span>
          <span className="ym27-balance-value">{payoutData ? formatLKR(paidOut) : '—'}</span>
          <span className="ym27-balance-sub">
            {payoutData ? confirmedCount : '—'} confirmed {dataMode === 'database' ? 'requests' : 'simulated requests'}
          </span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">In progress</span>
          <span className="ym27-balance-value">{payoutData ? formatLKR(inProgress) : '—'}</span>
          <span className="ym27-balance-sub">{!payoutData ? '—' : pendingCount === 0 ? 'No pending simulated requests' : `${pendingCount} pending simulated ${pendingCount === 1 ? 'request' : 'requests'}`}</span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Latest destination</span>
          <span className="ym27-balance-value ym27-balance-value--small">{payoutData ? latest?.bankLabel ?? '—' : '—'}</span>
          <span className="ym27-balance-sub">
            {dataMode === 'database' ? 'Destination details are not stored in the database.' : 'Masked simulated label. No full account number is stored.'}
          </span>
        </div>
      </div>

      <div className="ym27-section-header">
        <div>
          <h2>Payout requests</h2>
        </div>
      </div>

      <div className="ym27-filters ym27-filters--3">
        <label className="ym27-filter">
          <span>From</span>
          <input value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" />
        </label>
        <label className="ym27-filter">
          <span>To</span>
          <input value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" />
        </label>
        <label className="ym27-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value as 'all' | PayoutStatus); setPage(1); }}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>

      {payoutData && visible.length === 0 ? (
        <EmptyState
          title="No payout requests match these filters"
          description="Clear the filters to see the simulated history again. Pending requests are temporary and may expire after inactivity or a server restart."
          action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>}
        />
      ) : payoutData && (
        <>
          <Table headers={['Request date', 'Reference', 'Amount (LKR)', 'Destination', 'Status']}>
            {visible.map((payout: PayoutRecord) => (
              <TableRow key={payout.id}>
                <td>{formatDate(payout.date)}</td>
                <td>
                  {payout.reference}
                  <div className="ym27-cell-meta">
                    {dataMode === 'database'
                      ? 'Database record · read-only'
                      : payout.status === 'pending' ? 'Simulated request, this session only' : 'Simulated payout'}
                  </div>
                </td>
                <td>{formatLKR(payout.amount)}</td>
                <td>{payout.bankLabel}</td>
                <td><StatusBadge status={payout.status} /></td>
              </TableRow>
            ))}
          </Table>
          <div className="ym27-pager">
            <p>Showing {start + 1}–{start + visible.length} of {filtered.length} payout requests</p>
            <div className="ym27-pager-actions">
              <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <Button variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <p className="ym27-footer-note">
        <Link to="/farmer/wallet" className="ym27-inline-link">← Back to wallet</Link>
      </p>
    </div>
  );
}
