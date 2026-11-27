import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, X } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { formatDateRange, formatKg, formatLkr } from './formatters';
import { MAX_COMPARE, useComparison as useComparisonContext } from './ComparisonContext';
import { useComparison as useComparisonData } from './useComparison';
import type { ComparisonItem } from './types';
import './supplier-comparison.css';

function ComparisonLoading() {
  return <div className="ym12-comparison-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading supplier comparison…</span>
    <span /><span /><span />
  </div>;
}

function comparisonCell(item: ComparisonItem, row: string) {
  switch (row) {
    case 'price':
      return <strong>{formatLkr(item.pricePerKgCents)} LKR per kg</strong>;
    case 'available':
      return formatKg(item.availableKg);
    case 'distance':
      return item.distanceKm === null ? 'Unknown' : `${item.distanceKm} km`;
    case 'grade':
      return item.grade;
    case 'harvest':
      return formatDateRange(item.harvestStart, item.harvestEnd);
    case 'performance':
      return item.performanceScore === null ? 'Not enough history' : `${item.performanceScore}%`;
    default:
      return '';
  }
}

const comparisonRows = [
  { key: 'price', label: 'Price per kg' },
  { key: 'available', label: 'Available kg' },
  { key: 'distance', label: 'Distance¹' },
  { key: 'grade', label: 'Grade' },
  { key: 'harvest', label: 'Harvest window' },
  { key: 'performance', label: 'Performance score' },
];

export function SupplierComparisonPage() {
  const navigate = useNavigate();
  const { listingIds, toggle } = useComparisonContext();
  const { state, retry } = useComparisonData(listingIds);
  const data = state.status === 'success' ? state.data : null;
  const items = data?.items || [];
  const maxCompare = data?.maxCompare ?? MAX_COMPARE;
  const count = items.length;
  const cropName = data?.crop?.toLowerCase().replace(/^fresh\s+/, '').replace(/oes$/, 'o').replace(/s$/, '') || 'produce';
  const supplierWord = count === 1 ? 'supplier' : 'suppliers';

  return <div className="ym12-comparison-page">
    <header className="ym12-comparison-heading">
      <div>
        <nav className="ym12-breadcrumb" aria-label="Breadcrumb"><ol>
          <li><span>Suppliers</span></li><li aria-hidden="true">/</li>
          <li aria-current="page">Comparison</li>
        </ol></nav>
        <h2>Supplier comparison</h2>
        {data && count > 0
          ? <p>{count === 3 ? 'Three' : count} {cropName} {supplierWord}, ranked by price and then distance.</p>
          : <p>Compare selected suppliers side by side before sourcing.</p>}
      </div>
      <Button variant="outline" onClick={() => navigate('/buyer/produce')}>Browse more produce</Button>
    </header>

    {state.status === 'idle' && <div className="ym12-comparison-empty">
      <EmptyState title="Nothing to compare yet" description="Add produce listings to your comparison, then return here to compare suppliers."
        action={<Button variant="primary" onClick={() => navigate('/buyer/produce')}>Browse produce</Button>} />
    </div>}
    {state.status === 'loading' && <ComparisonLoading />}
    {state.status === 'error' && <div className="ym12-comparison-state">
      <Alert type="error">We couldn’t load the supplier comparison. Check your connection and try again.</Alert>
      <Button variant="outline" onClick={retry}>Retry</Button>
    </div>}
    {data && <>
      {data.dataSource === 'sample' && <StatusBadge status="Sample data" />}
      {data.unavailable.length > 0 && <Alert type="warning">
        These selected listings are unavailable and have been removed from the comparison: {data.unavailable.map((item) => item.id).join(', ')}.
      </Alert>}
      {!data.sameCrop && <Alert type="warning">These listings include different crops. Compare crop types as well as price and distance.</Alert>}
      {count === 1 && <Alert type="info">You are comparing one supplier. Add another listing to compare suppliers side by side.</Alert>}
      {listingIds.length >= maxCompare && <p className="ym12-comparison-limit" role="status">Comparison limit reached ({maxCompare}). Remove a listing before adding another.</p>}

      {count > 0 && <section className="ym12-comparison-table-card" aria-label="Supplier listing comparison">
        <div className="ym12-comparison-table-shell" role="region" aria-label="Supplier comparison table" tabIndex={0}>
          <Table className="ym12-comparison-table" headers={[
            'Compare',
            ...items.map((item) => <div className={`ym12-comparison-column-heading${item.isBestPrice ? ' ym12-comparison-column-heading--best' : ''}`} key={item.listingId}>
              <span className="ym12-comparison-rank">RANK {item.rank}</span>
              {item.isBestPrice && <StatusBadge status="BEST PRICE" />}
              <Link to={`/buyer/suppliers/${encodeURIComponent(item.supplierId)}`}>{item.supplierName}</Link>
            </div>),
          ]}>
            {comparisonRows.map((row) => <TableRow key={row.key}>
              <th scope="row">{row.label}</th>
              {items.map((item) => <td className={item.isBestPrice ? 'ym12-comparison-best-cell' : ''} key={item.listingId}>
                {comparisonCell(item, row.key)}
              </td>)}
            </TableRow>)}
            <TableRow className="ym12-comparison-actions-row">
              <th scope="row">Actions</th>
              {items.map((item) => <td className={item.isBestPrice ? 'ym12-comparison-best-cell' : ''} key={item.listingId}>
                <div className="ym12-comparison-actions">
                  <Button variant="outline" onClick={() => toggle(item.listingId)}>
                    <X size={16} aria-hidden="true" />Remove
                  </Button>
                  <Link className="ym-button ym-button--primary" to={`/buyer/produce/${encodeURIComponent(item.listingId)}`}>
                    View produce <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </td>)}
            </TableRow>
          </Table>
        </div>
        {listingIds.length < maxCompare && <button className="ym12-add-supplier" type="button" onClick={() => navigate('/buyer/produce')}>
          <Plus size={19} aria-hidden="true" />Add supplier
        </button>}
      </section>}
      {count === 0 && data.unavailable.length > 0 && <div className="ym12-comparison-empty">
      <EmptyState title="No available listings to compare" description="The selected listings are unavailable. Browse produce to choose current listings."
        action={<Button variant="primary" onClick={() => navigate('/buyer/produce')}>Browse produce</Button>} />
      </div>}

      <aside className="ym12-comparison-ranking-note">
        <h2>Why this ranking</h2>
        <p>Listings are ranked by price per kg, from lowest to highest. When prices are equal, known distances are ranked from nearest to farthest. Listings with unknown distances are ranked after listings with known distances.</p>
      </aside>
      <p className="ym12-comparison-footnote">¹ Distance from the buyer’s {data.buyerDistrict} district · Harvest dates: Asia/Colombo (UTC+05:30)</p>
    </>}
  </div>;
}
