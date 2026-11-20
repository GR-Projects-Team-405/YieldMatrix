import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import {
  MOCK_PAYOUTS,
  MOCK_SETTLEMENTS,
  MOCK_TRANSACTIONS,
  MOCK_WALLET_SUMMARY,
  formatLKR,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from '../mockData';

const PAGE_SIZE = 5;

const transactionDates = MOCK_TRANSACTIONS.map((txn) => txn.date).sort();
const defaultFrom = transactionDates[0] ?? '';
const defaultTo = transactionDates[transactionDates.length - 1] ?? '';

const settlementById = new Map(MOCK_SETTLEMENTS.map((settlement) => [settlement.id, settlement]));

const totalCredits = MOCK_TRANSACTIONS
  .filter((txn) => txn.type === 'credit')
  .reduce((sum, txn) => sum + txn.amount, 0);

const totalPaidOut = MOCK_PAYOUTS
  .filter((payout) => payout.status === 'confirmed')
  .reduce((sum, payout) => sum + payout.amount, 0);

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function matchedPayout(txn: Transaction) {
  if (txn.type !== 'debit') return undefined;
  return MOCK_PAYOUTS.find((payout) => payout.date === txn.date && payout.amount === txn.amount);
}

function referenceFor(txn: Transaction): string {
  if (txn.settlementId) return txn.settlementId.toUpperCase();
  return matchedPayout(txn)?.reference ?? '—';
}

function searchText(txn: Transaction): string {
  const settlement = txn.settlementId ? settlementById.get(txn.settlementId) : undefined;
  const payout = matchedPayout(txn);
  return [txn.description, txn.settlementId, settlement?.orderId, settlement?.produce, payout?.reference, payout?.bankLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function WalletTabs({ current }: { current: 'overview' | 'transactions' | 'history' | 'request' }) {
  const tabs = [
    { id: 'overview', label: 'Overview', to: '/farmer/wallet' },
    { id: 'transactions', label: 'Transactions', to: '/farmer/wallet/transactions' },
    { id: 'history', label: 'Payout history', to: '/farmer/wallet/payout/history' },
    { id: 'request', label: 'Request payout', to: '/farmer/wallet/payout/request' },
  ] as const;
  return (
    <nav className="ym27-tabs" aria-label="Wallet sections">
      {tabs.map((tab) => (
        <Link key={tab.id} to={tab.to} className={tab.id === current ? 'ym27-tab ym27-tab--active' : 'ym27-tab'} aria-current={tab.id === current ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function WalletTransactions() {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [type, setType] = useState<'all' | TransactionType>('all');
  const [status, setStatus] = useState<'all' | TransactionStatus>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MOCK_TRANSACTIONS.filter((txn) => {
      if (needle && !searchText(txn).includes(needle)) return false;
      if (from && txn.date < from) return false;
      if (to && txn.date > to) return false;
      if (type !== 'all' && txn.type !== type) return false;
      if (status !== 'all' && txn.status !== status) return false;
      return true;
    });
  }, [query, from, to, type, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function resetFilters() {
    setQuery('');
    setFrom(defaultFrom);
    setTo(defaultTo);
    setType('all');
    setStatus('all');
    setPage(1);
  }

  return (
    <div>
      <div className="ym27-demo-banner">
        <Alert type="warning">Demo data – Simulated wallet and payouts. No real money movement.</Alert>
        <span className="ym27-demo-tag">YM27</span>
      </div>

      <WalletTabs current="transactions" />

      <div className="ym27-page-header">
        <div>
          <h1>Wallet transactions</h1>
          <p>A complete record of your simulated settlement credits and payout debits.</p>
        </div>
        <Link to="/farmer/wallet/payout/request" className="ym27-header-action">Request simulated payout</Link>
      </div>

      <div className="ym27-balance-grid ym27-balance-grid--3">
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Total credits</span>
          <span className="ym27-balance-value">{formatLKR(totalCredits)}</span>
          <span className="ym27-balance-sub">Sum of the {MOCK_TRANSACTIONS.filter((txn) => txn.type === 'credit').length} simulated credit rows</span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Total paid out</span>
          <span className="ym27-balance-value">{formatLKR(totalPaidOut)}</span>
          <span className="ym27-balance-sub">{MOCK_PAYOUTS.filter((payout) => payout.status === 'confirmed').length} confirmed simulated payouts</span>
        </div>
        <div className="ym27-balance-card">
          <span className="ym27-balance-label">Available balance</span>
          <span className="ym27-balance-value">{formatLKR(MOCK_WALLET_SUMMARY.availableBalance)}</span>
          <span className="ym27-balance-sub">Original simulated balance. Pending requests are not deducted here.</span>
        </div>
      </div>

      <div className="ym27-filters">
        <label className="ym27-filter">
          <span>Search reference or produce</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} type="search" placeholder="Search reference or produce" />
        </label>
        <label className="ym27-filter">
          <span>From</span>
          <input value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" />
        </label>
        <label className="ym27-filter">
          <span>To</span>
          <input value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" />
        </label>
        <label className="ym27-filter">
          <span>Type</span>
          <select value={type} onChange={(event) => { setType(event.target.value as 'all' | TransactionType); setPage(1); }}>
            <option value="all">All types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
        <label className="ym27-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value as 'all' | TransactionStatus); setPage(1); }}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No transactions match these filters"
          description="Try another reference, produce name, date, type, or status. The simulated ledger itself is unchanged."
          action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>}
        />
      ) : (
        <>
          <Table headers={['Date', 'Transaction', 'Reference', 'Type', 'Amount (LKR)', 'Status']}>
            {visible.map((txn) => {
              const settlement = txn.settlementId ? settlementById.get(txn.settlementId) : undefined;
              return (
                <TableRow key={txn.id}>
                  <td>{formatDate(txn.date)}</td>
                  <td>
                    {txn.settlementId ? (
                      <Link to={`/farmer/wallet/settlement/${txn.settlementId}`} className="ym27-inline-link">{txn.description}</Link>
                    ) : txn.description}
                    {settlement && <div className="ym27-cell-meta">{settlement.produce} · {settlement.quantityKg} kg</div>}
                  </td>
                  <td className="ym27-cell-meta">{referenceFor(txn)}</td>
                  <td className="ym27-capitalize">{txn.type}</td>
                  <td>
                    <span className={txn.type === 'credit' ? 'ym27-amount--credit' : 'ym27-amount--debit'}>
                      {txn.type === 'credit' ? '+' : '−'}{formatLKR(txn.amount)}
                    </span>
                  </td>
                  <td><StatusBadge status={txn.status} /></td>
                </TableRow>
              );
            })}
          </Table>

          <div className="ym27-pager">
            <p>Showing {start + 1}–{start + visible.length} of {filtered.length} transactions</p>
            <div className="ym27-pager-actions">
              <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <Button variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
