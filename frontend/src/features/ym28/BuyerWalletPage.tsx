import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import BuyerSubNav from './BuyerSubNav';
import {
  extractApiError,
  formatColomboDateTime,
  formatLkrCents,
  formatSignedLkrCents,
  humanizeLabel,
  isAbortError,
  isNegativeCents,
  isPositiveCents,
  shortId,
  type BuyerTransactionsResponse,
  type BuyerWalletResponse,
} from './utils';

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All transaction types' },
  { value: 'funding', label: 'Simulated funding' },
  { value: 'hold', label: 'Order hold' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'refund', label: 'Refund' },
  { value: 'reversal', label: 'Reversal' },
];

export default function BuyerWalletPage() {
  const navigate = useNavigate();
  const [walletData, setWalletData] = useState<BuyerWalletResponse | null>(null);
  const [txData, setTxData] = useState<BuyerTransactionsResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [txError, setTxError] = useState('');

  const [eventType, setEventType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadWallet = useCallback(async (signal?: AbortSignal) => {
    setLoadingWallet(true);
    setWalletError('');
    try {
      const { data } = await api.get<BuyerWalletResponse>('/ym28/buyer/wallet', { signal });
      setWalletData(data);
    } catch (err) {
      if (!isAbortError(err)) {
        setWalletError(extractApiError(err, 'Could not load your simulated buyer wallet.').message);
      }
    } finally {
      if (!signal?.aborted) setLoadingWallet(false);
    }
  }, []);

  const loadTransactions = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingTx(true);
      setTxError('');
      try {
        const params: Record<string, string | number> = { page, limit: 15 };
        if (eventType) params.eventType = eventType;
        if (appliedSearch) params.search = appliedSearch;
        const { data } = await api.get<BuyerTransactionsResponse>('/ym28/buyer/transactions', {
          params,
          signal,
        });
        setTxData(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setTxError(extractApiError(err, 'Could not load transaction history.').message);
        }
      } finally {
        if (!signal?.aborted) setLoadingTx(false);
      }
    },
    [page, eventType, appliedSearch]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadWallet(controller.signal);
    return () => controller.abort();
  }, [loadWallet]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTransactions(controller.signal);
    return () => controller.abort();
  }, [loadTransactions]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setEventType('');
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  }

  return (
    <div className="ym28-stack">
      <BuyerSubNav />

      <Alert type="warning">
        <strong>Simulated Agri Wallet:</strong> Balances, funding top-ups, order holds, settlements and refunds are
        local demonstration records in LKR. No real bank credentials or payment gateways are used.
      </Alert>

      {walletError ? (
        <ContentCard title="Wallet balances unavailable">
          <Alert type="error">{walletError}</Alert>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void loadWallet()}>
              Retry loading wallet
            </Button>
          </div>
        </ContentCard>
      ) : loadingWallet || !walletData ? (
        <ContentCard title="Simulated Buyer Wallet">
          <p role="status" className="ym28-muted">
            Loading wallet balances…
          </p>
        </ContentCard>
      ) : (
        <>
          <div className="ym28-stat-grid">
            <StatCard
              label="Available balance (Simulated)"
              value={formatLkrCents(walletData.wallet.availableCents)}
              subtext="Ready to confirm bulk orders"
              highlight
            />
            <StatCard
              label="Held for active orders"
              value={formatLkrCents(walletData.wallet.heldCents)}
              subtext={`${walletData.summary.heldOrderCount} order(s) · ${walletData.summary.heldAllocationCount} allocation(s)`}
            />
            <StatCard
              label="Total funded (Simulated)"
              value={formatLkrCents(walletData.summary.totalFundedCents)}
              subtext="Cumulative simulated credits"
            />
            <StatCard
              label="Settled / Refunded"
              value={formatLkrCents(walletData.summary.totalSettledCents)}
              subtext={`Refunded: ${formatLkrCents(walletData.summary.totalRefundedCents)}`}
            />
          </div>

          <ContentCard
            title="Quick wallet actions"
            subtitle={`Wallet ID: ${shortId(walletData.wallet.id)} · Account: ${walletData.wallet.ownerName} · Currency: ${walletData.wallet.currency}`}
          >
            <div className="ym28-actions">
              <Button variant="primary" onClick={() => navigate('/buyer/wallet/funding')}>
                Add simulated funds
              </Button>
              <Button variant="outline" onClick={() => navigate('/buyer/wallet/holds')}>
                View held funds by order
              </Button>
              <Button variant="outline" onClick={() => navigate('/buyer/wallet/refunds')}>
                View refund details
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void loadWallet();
                  void loadTransactions();
                }}
              >
                Refresh balances
              </Button>
            </div>
          </ContentCard>
        </>
      )}

      <ContentCard
        title="Transaction history"
        subtitle="Immutable simulated wallet journal entries displayed in Asia/Colombo time."
      >
        <form className="ym28-toolbar" onSubmit={handleSearchSubmit}>
          <div className="ym28-filters">
            <SelectField
              label="Filter by type"
              value={eventType}
              options={EVENT_TYPE_OPTIONS}
              onChange={(e) => {
                setEventType(e.target.value);
                setPage(1);
              }}
            />
            <InputField
              label="Search reference or ID"
              placeholder="Reference, entry ID or order ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="ym28-actions">
            <Button type="submit" variant="primary">
              Apply filters
            </Button>
            {(eventType || appliedSearch) && (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </form>

        {txError ? (
          <div className="ym28-stack">
            <Alert type="error">{txError}</Alert>
            <div>
              <Button variant="outline" onClick={() => void loadTransactions()}>
                Retry loading transactions
              </Button>
            </div>
          </div>
        ) : loadingTx ? (
          <p role="status" className="ym28-muted">
            Loading transactions…
          </p>
        ) : !txData || txData.transactions.length === 0 ? (
          <EmptyState
            title="No wallet transactions found"
            description={
              eventType || appliedSearch
                ? 'No transactions match your current filter. Try clearing the filters.'
                : 'Your simulated wallet ledger is empty. Add simulated funding to begin trading.'
            }
            action={
              eventType || appliedSearch ? (
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/buyer/wallet/funding')}>
                  Add simulated funds
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table
              headers={[
                'Date (Asia/Colombo)',
                'Type',
                'Reference',
                'Available impact',
                'Held impact',
                'Entry amount',
                'Details',
              ]}
            >
              {txData.transactions.map((tx) => {
                const availClass = isPositiveCents(tx.availableDeltaCents)
                  ? 'ym28-amount-pos'
                  : isNegativeCents(tx.availableDeltaCents)
                    ? 'ym28-amount-neg'
                    : 'ym28-muted';
                const badgeText = tx.reversedById
                  ? 'Reversed'
                  : tx.eventType === 'funding'
                    ? 'Confirmed'
                    : humanizeLabel(tx.eventType);

                return (
                  <TableRow key={tx.id}>
                    <td>{formatColomboDateTime(tx.occurredAt)}</td>
                    <td>
                      <StatusBadge status={badgeText} />
                      <div className="ym28-muted" style={{ marginTop: 4 }}>
                        {humanizeLabel(tx.eventType)}
                      </div>
                    </td>
                    <td>
                      <div>{tx.eventReference}</div>
                      <div className="ym28-mono ym28-muted">
                        Entry: {shortId(tx.id)}
                        {tx.orderId ? ` · Order: ${shortId(tx.orderId)}` : ''}
                      </div>
                    </td>
                    <td className={availClass}>{formatSignedLkrCents(tx.availableDeltaCents)}</td>
                    <td className="ym28-muted">{formatSignedLkrCents(tx.heldDeltaCents)}</td>
                    <td>
                      <strong>{formatLkrCents(tx.amountCents)}</strong>
                    </td>
                    <td>
                      <Link className="ym28-inline-link" to={`/buyer/wallet/transactions/${tx.id}`}>
                        Inspect
                      </Link>
                    </td>
                  </TableRow>
                );
              })}
            </Table>

            <div className="ym28-pagination">
              <span className="ym28-muted">
                Showing page {txData.pagination.page} of {txData.pagination.totalPages} ({txData.pagination.total}{' '}
                total entries)
              </span>
              <div className="ym28-actions">
                <Button
                  variant="outline"
                  disabled={txData.pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={txData.pagination.page >= txData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </ContentCard>
    </div>
  );
}