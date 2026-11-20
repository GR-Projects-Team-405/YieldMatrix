import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { Toast } from '../../components/Toast';
import type { Offer, OffersResponse } from './types';
import { formatColomboTimestamp, formatLkr, getApiErrorMessage } from './utils';

const allFilter = 'All';

const statusLabel = (status: Offer['status']) => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Declined';
    case 'withdrawn': return 'Withdrawn';
    case 'expired': return 'Expired';
  }
};

export default function MyOffers() {
  const location = useLocation();
  const navigate = useNavigate();
  const toastMessage = (location.state as { toastMessage?: string } | null)?.toastMessage;
  const [data, setData] = useState<OffersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(allFilter);
  const [produce, setProduce] = useState(allFilter);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<OffersResponse>('/ym10/offers');
      setData(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load your offers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const offers = data?.offers ?? [];
  const produceOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(offers.map((offer) => offer.cropName))).sort()],
    [offers],
  );
  const filteredOffers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesSearch =
        !query ||
        [offer.offerCode, offer.requestCode, offer.buyerName, offer.cropName].some((value) =>
          value.toLowerCase().includes(query),
        );
      return (
        matchesSearch &&
        (status === allFilter || offer.status === status) &&
        (produce === allFilter || offer.cropName === produce)
      );
    });
  }, [offers, produce, search, status]);

  const renderBrowseButton = () => (
    <Button variant="primary" onClick={() => navigate('/farmer/buyer-requests')}>
      Browse buyer requests
    </Button>
  );

  return (
    <div className="ym10-page">
      <header className="ym10-page-heading">
        <p>Track the offers you have sent to buyers.</p>
        {renderBrowseButton()}
      </header>

      {data && (
        <section className="ym10-stats" aria-label="Offer summary">
          <StatCard label="Pending" value={data.summary.pending} subtext="Awaiting buyer response" />
          <StatCard label="Accepted" value={data.summary.accepted} subtext="Accepted by buyers" />
          <StatCard label="Declined" value={data.summary.rejected} subtext="Declined by buyers" />
          <StatCard
            label="Total offered value"
            value={formatLkr(data.summary.totalOfferedCents)}
            subtext={`${data.summary.offerCount} ${data.summary.offerCount === 1 ? 'offer' : 'offers'} submitted`}
          />
        </section>
      )}

      <section className="ym10-filters ym10-offer-filters" aria-label="Filter offers">
        <InputField
          label="Search"
          type="search"
          placeholder="Offer ID, buyer or produce..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: allFilter, label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Declined' },
            { value: 'withdrawn', label: 'Withdrawn' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <SelectField
          label="Produce"
          value={produce}
          onChange={(event) => setProduce(event.target.value)}
          options={produceOptions.map((option) => ({
            value: option,
            label: option === allFilter ? 'All' : option,
          }))}
        />
      </section>

      <ContentCard title="Offers I have sent" className="ym10-request-card">
        {loading ? (
          <p className="ym10-placeholder">Loading...</p>
        ) : error ? (
          <Alert type="error">
            {error}{' '}
            <Button variant="outline" onClick={() => void loadOffers()}>
              Retry
            </Button>
          </Alert>
        ) : offers.length === 0 ? (
          <EmptyState
            title="No offers yet"
            description="You have not sent any offers yet. Browse buyer requests to get started."
            action={renderBrowseButton()}
          />
        ) : filteredOffers.length === 0 ? (
          <EmptyState
            title="No offers match your filters"
            description="Try changing your search or selections."
          />
        ) : (
          <>
            <Table
              className="ym10-offers-table"
              headers={[
                'Offer ID / Buyer',
                'Produce',
                'Quantity (kg)',
                'Price per kg',
                'Total (LKR)',
                'Status',
                'Submitted',
                '',
              ]}
            >
              {filteredOffers.map((offer) => (
                <TableRow key={offer.id}>
                  <td>
                    <strong className="ym10-table-primary">{offer.offerCode}</strong>
                    <span className="ym10-table-secondary">
                      {offer.buyerName} · {offer.requestCode}
                    </span>
                  </td>
                  <td>
                    <strong className="ym10-table-primary">{offer.cropName}</strong>
                    <span className="ym10-table-secondary">{offer.gradeName}</span>
                  </td>
                  <td>{offer.quantityKg.toLocaleString('en-US')}</td>
                  <td>{formatLkr(offer.pricePerKgCents)}</td>
                  <td>{formatLkr(offer.totalCents)}</td>
                  <td><StatusBadge status={statusLabel(offer.status)} /></td>
                  <td>{formatColomboTimestamp(offer.createdAt)}</td>
                  <td>
                    <Link
                      className="ym10-view-link"
                      to={`/farmer/buyer-requests/${offer.requestId}`}
                    >
                      View request
                    </Link>
                  </td>
                </TableRow>
              ))}
            </Table>
            <p className="ym10-table-footer">
              Showing {filteredOffers.length} of {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
            </p>
          </>
        )}
      </ContentCard>
      {toastMessage === 'Offer submitted' && <Toast message={toastMessage} />}
    </div>
  );
}
