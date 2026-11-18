import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { buyerRequests } from './sampleData';
import type { BuyerRequestStatus } from './types';

const allFilter = 'All';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));

const statusClass: Record<BuyerRequestStatus, string> = {
  Open: 'ym10-status--open',
  'Closing soon': 'ym10-status--closing',
  'Offer sent': 'ym10-status--sent',
  Matching: 'ym10-status--matching',
};

export default function BuyerRequests() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [produce, setProduce] = useState(allFilter);
  const [grade, setGrade] = useState(allFilter);
  const [district, setDistrict] = useState(allFilter);
  const [deliveryDate, setDeliveryDate] = useState(allFilter);

  const produceOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(buyerRequests.map((request) => request.produce))).sort()],
    [],
  );
  const gradeOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(buyerRequests.map((request) => request.grade))).sort()],
    [],
  );
  const districtOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(buyerRequests.map((request) => request.district))).sort()],
    [],
  );
  const deliveryDateOptions = useMemo(
    () => [allFilter, ...Array.from(new Set(buyerRequests.map((request) => request.deliveryDate))).sort()],
    [],
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return buyerRequests.filter((request) => {
      const matchesSearch =
        !query ||
        [
          request.buyerName,
          request.id,
          request.district,
          request.produce,
          request.grade,
          request.status,
        ].some((value) => value.toLowerCase().includes(query));

      return (
        matchesSearch &&
        (produce === allFilter || request.produce === produce) &&
        (grade === allFilter || request.grade === grade) &&
        (district === allFilter || request.district === district) &&
        (deliveryDate === allFilter || request.deliveryDate === deliveryDate)
      );
    });
  }, [deliveryDate, district, grade, produce, search]);

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

      <section className="ym10-stats" aria-label="Buyer request summary">
        <StatCard label="Open requests" value="18" subtext="6 new this week" />
        <StatCard
          label="Matching my produce"
          value="7"
          subtext="Based on your active listings"
        />
        <StatCard label="Offers submitted" value="05" subtext="2 awaiting a buyer reply" />
        <StatCard label="Closing soon" value="03" subtext="Within the next 48 hours" />
      </section>

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
            label: option === allFilter ? 'All grades' : `Grade ${option}`,
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
            label: option === allFilter ? 'Any date' : formatDate(option),
          }))}
        />
      </section>

      <ContentCard title="Requests matching you" className="ym10-request-card">
        {filteredRequests.length ? (
          <Table
            className="ym10-request-table"
            headers={[
              'Buyer / request',
              'Produce',
              'Quantity needed (kg)',
              'Delivery by',
              'Price range (LKR per kg)',
              'Status',
              '',
            ]}
          >
            {filteredRequests.map((request) => (
              <TableRow key={request.id}>
                <td>
                  <strong className="ym10-table-primary">{request.buyerName}</strong>
                  <span className="ym10-table-secondary">{request.id} · {request.district}</span>
                </td>
                <td>
                  <strong className="ym10-table-primary">{request.produce}</strong>
                  <span className="ym10-table-secondary">Grade {request.grade}</span>
                </td>
                <td>{request.quantityKg.toLocaleString('en-US')}</td>
                <td>{formatDate(request.deliveryDate)}</td>
                <td>{request.minimumPrice}–{request.maximumPrice}</td>
                <td>
                  <span className={statusClass[request.status]}>
                    <StatusBadge status={request.status} />
                  </span>
                </td>
                <td>
                  <Link className="ym10-view-link" to={`/farmer/buyer-requests/${request.id}`}>
                    View request
                  </Link>
                </td>
              </TableRow>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No requests match your filters"
            description="Try adjusting or clearing your filters to see more buyer requests."
          />
        )}
        {filteredRequests.length > 0 && (
          <p className="ym10-table-footer">
            Showing {filteredRequests.length} of {filteredRequests.length} matching requests
          </p>
        )}
      </ContentCard>
    </div>
  );
}
