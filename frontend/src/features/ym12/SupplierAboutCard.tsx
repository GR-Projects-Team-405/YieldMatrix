import { BadgeCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import type { SupplierProfileResponse } from './types';

function metricValue(value: number | null, suffix = '') {
  return value === null ? 'Unavailable' : `${value.toLocaleString('en-US')}${suffix}`;
}

export function SupplierAboutCard({ data }: { data: SupplierProfileResponse }) {
  const { supplier, performanceSummary } = data;
  const insufficientHistory = performanceSummary.insufficientHistory;
  return <ContentCard title="About the supplier" className="ym12-profile-about">
    {supplier.description && <p className="ym12-profile-description">{supplier.description}</p>}
    <Link className="ym12-performance-link" to={`/buyer/suppliers/${encodeURIComponent(supplier.id)}/performance`}>
      Performance summary <ArrowRight size={17} aria-hidden="true" />
    </Link>
    <div className="ym12-performance-stats">
      <StatCard label="Completed orders"
        value={insufficientHistory ? 'Insufficient history' : metricValue(performanceSummary.completedOrders)}
        subtext={insufficientHistory ? 'Supplier activity is not yet available.' : undefined} />
      <StatCard label="Order fulfilment"
        value={insufficientHistory ? 'Insufficient history' : metricValue(performanceSummary.fulfilmentRatePercent, '%')}
        subtext={!insufficientHistory ? performanceSummary.fulfilmentLabel || undefined : undefined} />
    </div>
    <p className="ym12-verified-row">
      <BadgeCheck size={19} aria-hidden="true" />
      {supplier.verified ? 'Business identity verified' : 'Business identity verification not recorded'}
    </p>
    {data.cropsSupplied.length > 0 && <div className="ym12-crops">
      <h3>Crops supplied</h3>
      <ul>{data.cropsSupplied.map((crop) => <li key={crop}>{crop}</li>)}</ul>
    </div>}
  </ContentCard>;
}
