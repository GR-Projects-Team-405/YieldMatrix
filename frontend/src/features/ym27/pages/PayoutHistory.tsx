import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { MOCK_PAYOUTS, formatLKR, type PayoutRecord, type PayoutStatus } from '../mockData';
import { usePayoutState } from '../payoutState';

const PAGE_SIZE = 4;

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const mockDates = MOCK_PAYOUTS.map((payout) => payout.date).sort();
const defaultFrom = mockDates[0] ?? '';
const defaultTo = [mockDates[mockDates.length - 1] ?? '', todayIso()].sort().at(-1) ?? '';

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
  const { localPayouts } = usePayoutState();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState<'all' | PayoutStatus>('all');
  const [page, setPage] = useState(1);

  const combined = useMemo(() => {
    return [...localPayouts, ...MOCK_PAYOUTS].sort((a, b) => b.date.localeCompare(a.date) || b.reference.localeCompare(a.reference));
  }, [localPayouts]);

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

  function resetFilters() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setStatus('all');
    setPage(1);
  }

  return (
    <div>
      <div className="ym27-demo-banner">
        <Alert type="warning">Demo data – Simulated wallet and payouts. No real money movement.</Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>

      <WalletTabs />

      <div className="ym27-page-header">
        <div>
          <h1>Payout history</h1>
          <p>Track every simulated payout request and its current status.</p>
        </div>
        <Link to="/farmer/wallet/payout/request" className="ym27-header-action">Request simulated payout</Link>
      </div>

      <Alert type="info">
        New pending requests are visible for this session only.
      </Alert>

      <div className="ym27-balance-grid ym27-balance-grid--3 ym27-section-gap">
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Total paid out</span>
          <span className="ym27-balance-value">{formatLKR(paidOut)}</span>
          <span className="ym27-balance-sub">{confirmedCount} confirmed simulated {confirmedCount === 1 ? 'request' : 'requests'}</span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">In progress</span>
          <span className="ym27-balance-value">{formatLKR(inProgress)}</span>
          <span className="ym27-balance-sub">{pendingCount === 0 ? 'No pending simulated requests' : `${pendingCount} pending simulated ${pendingCount === 1 ? 'request' : 'requests'}`}</span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Latest destination</span>
          <span className="ym27-balance-value ym27-balance-value--small">{latest ? latest.bankLabel : '—'}</span>
          <span className="ym27-balance-sub">Masked simulated label. No full account number is stored.</span>
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

      {visible.length === 0 ? (
        <EmptyState
          title="No payout requests match these filters"
          description="Clear the filters to see the simulated history again. New pending requests only exist until you reload or leave the wallet."
          action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>}
        />
      ) : (
        <>
          <Table headers={['Request date', 'Reference', 'Amount (LKR)', 'Destination', 'Status']}>
            {visible.map((payout: PayoutRecord) => (
              <TableRow key={payout.id}>
                <td>{formatDate(payout.date)}</td>
                <td>
                  {payout.reference}
                  <div className="ym27-cell-meta">{payout.status === 'pending' ? 'Simulated request, this session only' : 'Simulated payout'}</div>
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
