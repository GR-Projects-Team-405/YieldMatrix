import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import { sampleOffers, submittedOffers } from './sampleData';
import type { OfferStatus } from './types';
import { formatLkr } from './utils';

const allFilter = 'All';

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));

export default function MyOffers() {
  const location = useLocation();
  const navigate = useNavigate();
  const toastMessage = (location.state as { toastMessage?: string } | null)?.toastMessage;
  const offers = [...submittedOffers, ...sampleOffers];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(allFilter);
  const [produce, setProduce] = useState(allFilter);

  const produceOptions = [
    allFilter,
    ...Array.from(new Set(offers.map((offer) => offer.produce))).sort(),
  ];
  const filteredOffers = offers.filter((offer) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [offer.id, offer.buyerName, offer.produce].some((value) =>
        value.toLowerCase().includes(query),
      );
    return (
      matchesSearch &&
      (status === allFilter || offer.status === status) &&
      (produce === allFilter || offer.produce === produce)
    );
  });
  const countByStatus = (offerStatus: OfferStatus) =>
    offers.filter((offer) => offer.status === offerStatus).length;
  const totalOfferedValue = offers.reduce(
    (total, offer) => total + offer.quantityKg * offer.pricePerKg,
    0,
  );
  const showEmptyState = filteredOffers.length === 0;
  const emptyDescription = offers.length === 0
    ? 'You have not sent any offers yet. Browse buyer requests to get started.'
    : 'No offers match your filters. Try changing your search or selections.';

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

      <section className="ym10-stats" aria-label="Offer summary">
        <StatCard label="Pending" value={countByStatus('Pending')} subtext="Awaiting buyer response" />
        <StatCard label="Accepted" value={countByStatus('Accepted')} subtext="Accepted by buyers" />
        <StatCard label="Declined" value={countByStatus('Declined')} subtext="Declined by buyers" />
        <StatCard
          label="Total offered value"
          value={formatLkr(totalOfferedValue)}
          subtext={`${offers.length} offers submitted`}
        />
      </section>

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
            { value: 'Pending', label: 'Pending' },
            { value: 'Accepted', label: 'Accepted' },
            { value: 'Declined', label: 'Declined' },
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
        {showEmptyState ? (
          <EmptyState
            title="No offers yet"
            description={emptyDescription}
            action={renderBrowseButton()}
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
                    <strong className="ym10-table-primary">{offer.id}</strong>
                    <span className="ym10-table-secondary">
                      {offer.buyerName} {offer.requestId}
                    </span>
                  </td>
                  <td>
                    <strong className="ym10-table-primary">{offer.produce}</strong>
                    <span className="ym10-table-secondary">Grade {offer.grade}</span>
                  </td>
                  <td>{offer.quantityKg.toLocaleString('en-US')}</td>
                  <td>{formatLkr(offer.pricePerKg)}</td>
                  <td>{formatLkr(offer.quantityKg * offer.pricePerKg)}</td>
                  <td><StatusBadge status={offer.status} /></td>
                  <td>{formatDate(offer.submittedDate)}</td>
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
              Showing {filteredOffers.length} of {offers.length} offers
            </p>
          </>
        )}
      </ContentCard>
      {toastMessage === 'Offer submitted' && <Toast message={toastMessage} />}
    </div>
  );
}
