import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/Alert';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { formatLKRIfKnown, type Settlement } from '../mockData';
import { fetchSettlement, getYm27ErrorMessage, getYm27ResponseMode, type Ym27DataMode } from '../api';
import { DataModeBanner } from '../DataModeBanner';

function formatDate(iso: string | null): string {
  if (!iso) return 'Not recorded';
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
        <Link key={tab.id} to={tab.to} className={tab.id === 'transactions' ? 'ym27-tab ym27-tab--active' : 'ym27-tab'} aria-current={tab.id === 'transactions' ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function outcomeCopy(status: string): string {
  if (status === 'confirmed') return 'Net amount recorded as credited in the simulated wallet.';
  if (status === 'pending') return 'The simulated credit is still pending.';
  return 'The simulated credit was not applied.';
}

export default function SettlementBreakdown() {
  const { settlementId } = useParams();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [dataMode, setDataMode] = useState<Ym27DataMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (!settlementId) {
      setSettlement(null);
      setDataMode(null);
      setLoading(false);
      return () => { active = false; };
    }
    fetchSettlement(settlementId)
      .then((result) => {
        if (active) {
          setSettlement(result.settlement);
          setDataMode(result.mode);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setDataMode(getYm27ResponseMode(requestError));
          setError(getYm27ErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [settlementId]);

  const unitCents = settlement
    && settlement.quantityKg !== null
    && settlement.quantityKg > 0
    && settlement.grossAmount !== null
    ? settlement.grossAmount / settlement.quantityKg
    : null;
  const unitIsExact = unitCents !== null && Number.isInteger(unitCents);

  return (
    <div>
      <DataModeBanner mode={dataMode} />

      <WalletTabs />

      <Link to="/farmer/wallet/transactions" className="ym27-back-link">← Back to transactions</Link>

      {loading && <p role="status">Loading settlement…</p>}
      {error && <Alert type="error">{error}</Alert>}
      {!loading && !error && !settlement ? (
        <EmptyState
          title="Settlement not found"
          description={dataMode === 'database'
            ? 'That settlement id is not in the approved farmer wallet records.'
            : 'That settlement id is not in the simulated wallet records.'}
          action={<Link to="/farmer/wallet/transactions" className="ym27-inline-link">Return to transactions</Link>}
        />
      ) : !loading && !error && settlement && (
        <>
          <div className="ym27-page-header">
            <div>
              <h1>Settlement breakdown</h1>
              <p>{settlement.id.toUpperCase()} · A read-only view of this recorded settlement.</p>
            </div>
            <StatusBadge status={settlement.status} />
          </div>

          <div className="ym27-split">
            <section className="ym27-info-card">
              <h2>Order information</h2>
              <dl className="ym27-kv">
                <dt>Order</dt>
                <dd>{settlement.orderId ?? 'Not recorded'}</dd>
                <dt>Settlement date</dt>
                <dd>{formatDate(settlement.date)}</dd>
                <dt>Buyer</dt>
                <dd>Not included in this simulated record</dd>
              </dl>
            </section>

            <section className="ym27-info-card">
              <h2>Settlement summary</h2>
              <dl className="ym27-kv">
                <dt>Gross amount</dt>
                <dd>{formatLKRIfKnown(settlement.grossAmount)}</dd>
                <dt>Platform fee</dt>
                <dd>{formatLKRIfKnown(settlement.platformFee)}</dd>
                {settlement.journalAmount !== undefined && settlement.journalAmount !== null && (
                  <>
                    <dt>Posted journal amount</dt>
                    <dd>{formatLKRIfKnown(settlement.journalAmount)}</dd>
                  </>
                )}
              </dl>
              <div className="ym27-net-block">
                <span>Net credited amount</span>
                <strong>{formatLKRIfKnown(settlement.netPaid)}</strong>
                <p>{dataMode === 'database'
                  ? 'Posted amount is available above; gross amount, fees, and net allocation are not defined by the current schema.'
                  : outcomeCopy(settlement.status)}</p>
              </div>
            </section>
          </div>

          <section className="ym27-info-card ym27-section-gap">
            <h2>Accepted produce</h2>
            <Table headers={['Produce', 'Accepted', unitIsExact ? 'LKR/kg' : 'LKR/kg', 'Gross (LKR)']}>
              <TableRow>
                <td>{settlement.produce ?? 'Not recorded'}</td>
                <td>{settlement.quantityKg === null ? 'Not recorded' : `${settlement.quantityKg} kg`}</td>
                <td>{unitIsExact && unitCents !== null ? formatLKRIfKnown(unitCents) : 'Not stored'}</td>
                <td>{formatLKRIfKnown(settlement.grossAmount)}</td>
              </TableRow>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
