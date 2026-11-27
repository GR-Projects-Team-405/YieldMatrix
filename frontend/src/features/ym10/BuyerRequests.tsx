import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { BuyerRequest, BuyerRequestsResponse } from './types';
import { formatLkr, formatPlainDate, getApiErrorMessage } from './utils';

const allFilter = 'All';

const statusForRequest = (request: BuyerRequest) => {
  if (request.myOfferStatus === 'pending') return 'Offer sent';
  if (request.closingSoon) return 'Closing soon';
  if (request.hasMatchingStock) return 'Matching';
  return 'Open';
};

const statusClassForRequest = (status: string) => {
  switch (status) {
    case 'Offer sent': return 'ym10-status--sent';
    case 'Closing soon': return 'ym10-status--closing';
    case 'Matching': return 'ym10-status--matching';
    default: return 'ym10-status--open';
  }
};

export default function BuyerRequests() {
  const navigate = useNavigate();
  const [data, setData] = useState<BuyerRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [produce, setProduce] = useState(allFilter);
  const [grade, setGrade] = useState(allFilter);
  const [district, setDistrict] = useState(allFilter);
  const [deliveryDate, setDeliveryDate] = useState(allFilter);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<BuyerRequestsResponse>('/ym10/buyer-requests');
      setData(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load buyer requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const requests = data?.requests ?? [];
  const produceOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(requests.map((request) => request.cropName))).sort()],
    [requests],
  );
  const gradeOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(requests.map((request) => request.gradeName))).sort()],
    [requests],
  );
  const districtOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(requests.map((request) => request.district))).sort()],
    [requests],
  );
  const deliveryDateOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(requests.map((request) => request.deliveryFrom))).sort()],
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        [request.buyerName, request.cropName, request.requestCode].some((value) =>
          value.toLowerCase().includes(query),
        );

      return (
        matchesSearch &&
        (produce === allFilter || request.cropName === produce) &&
        (grade === allFilter || request.gradeName === grade) &&
        (district === allFilter || request.district === district) &&
        (deliveryDate === allFilter || request.deliveryFrom === deliveryDate)
      );
    });
  }, [deliveryDate, district, grade, produce, requests, search]);

  return (
    <div className="ym10-page">
      <header className="ym10-page-heading">
        <div>
          <p>Browse what buyers need and send your offer for the produce you grow.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/farmer/offers')}>
          View my offers
        </Button>
      </header>

      {data && (
        <section className="ym10-stats" aria-label="Buyer request summary">
          <StatCard label="Open requests" value={data.summary.openRequests} />
          <StatCard label="Matching my produce" value={data.summary.matchingRequests} />
          <StatCard
            label="Offers submitted"
            value={data.summary.offersSubmitted}
            subtext={`${data.summary.awaitingReply} awaiting a buyer reply`}
          />
          <StatCard label="Closing soon" value={data.summary.closingSoon} />
        </section>
      )}

      <section className="ym10-filters" aria-label="Filter buyer requests">
        <InputField
          label="Search"
          type="search"
          placeholder="Buyer, produce, request ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Produce"
          value={produce}
          onChange={(event) => setProduce(event.target.value)}
          options={produceOptions.map((option) => ({
            value: option,
            label: option === allFilter ? 'All produce' : option,
          }))}
        />
        <SelectField
          label="Grade"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          options={gradeOptions.map((option) => ({
            value: option,
            label: option === allFilter ? 'All grades' : option,
          }))}
        />
        <SelectField
          label="District"
          value={district}
          onChange={(event) => setDistrict(event.target.value)}
          options={districtOptions.map((option) => ({
            value: option,
            label: option === allFilter ? 'All districts' : option,
          }))}
        />
        <SelectField
          label="Delivery date"
          value={deliveryDate}
          onChange={(event) => setDeliveryDate(event.target.value)}
          options={deliveryDateOptions.map((option) => ({
            value: option,
            label: option === allFilter ? 'Any date' : formatPlainDate(option),
          }))}
        />
      </section>

      <ContentCard title="Requests matching you" className="ym10-request-card">
        {loading ? (
          <p className="ym10-placeholder">Loading...</p>
        ) : error ? (
          <Alert type="error">
            {error}{' '}
            <Button variant="outline" onClick={() => void loadRequests()}>
              Retry
            </Button>
          </Alert>
        ) : filteredRequests.length ? (
          <Table
            className="ym10-request-table"
            headers={[
              'Buyer / request',
              'Produce',
              'Quantity needed (kg)',
              'Delivery window',
              'Maximum price (LKR per kg)',
              'Status',
              '',
            ]}
          >
            {filteredRequests.map((request) => {
              const status = statusForRequest(request);
              return (
                <TableRow key={request.id}>
                  <td>
                    <strong className="ym10-table-primary">{request.buyerName}</strong>
                    <span className="ym10-table-secondary">{request.requestCode} · {request.district}</span>
                  </td>
                  <td>
                    <strong className="ym10-table-primary">{request.cropName}</strong>
                    <span className="ym10-table-secondary">{request.gradeName}</span>
                  </td>
                  <td>{request.quantityKg.toLocaleString('en-US')}</td>
                  <td>{formatPlainDate(request.deliveryFrom)} – {formatPlainDate(request.deliveryUntil)}</td>
                  <td>
                    {request.maxPricePerKgCents === null
                      ? 'Not specified'
                      : `Up to ${formatLkr(request.maxPricePerKgCents)} / kg`}
                  </td>
                  <td>
                    <span className={statusClassForRequest(status)}>
                      <StatusBadge status={status} />
                    </span>
                  </td>
                  <td>
                    <Link className="ym10-view-link" to={`/farmer/buyer-requests/${request.id}`}>
                      View request
                    </Link>
                  </td>
                </TableRow>
              );
            })}
          </Table>
        ) : (
          <EmptyState
            title="No requests match your filters"
            description="Try adjusting or clearing your filters to see more buyer requests."
          />
        )}
        {!loading && !error && (
          <p className="ym10-table-footer">
            Showing {filteredRequests.length} of {requests.length} requests
          </p>
        )}
      </ContentCard>
    </div>
  );
}
