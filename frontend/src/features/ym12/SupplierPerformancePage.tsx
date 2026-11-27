import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateRange } from './formatters';
import { usePerformance } from './usePerformance';
import type { PerformanceMetric, SupplierPerformanceTrendMonth } from './types';
import './supplier-performance.css';

function PerformanceLoading() {
  return <div className="ym12-performance-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading supplier performance…</span>
    <span className="ym12-performance-skeleton-header" />
    <div className="ym12-performance-skeleton-metrics">{Array.from({ length: 5 }, (_, index) =>
      <span key={index} />)}</div>
    <span className="ym12-performance-skeleton-chart" />
  </div>;
}

function formatRate(metric: PerformanceMetric, decimalPlaces = 0) {
  return metric.percent === null ? 'Not enough data' : `${metric.percent.toFixed(decimalPlaces)}%`;
}

function formatRatio(metric: PerformanceMetric, description: string) {
  if (metric.numerator === null || metric.denominator === null) return `No recorded ${description} data`;
  return `${metric.numerator.toLocaleString('en-US')} / ${metric.denominator.toLocaleString('en-US')} ${description}`;
}

function FulfilmentChart({ trend }: { trend: SupplierPerformanceTrendMonth[] }) {
  const width = 720;
  const left = 54;
  const right = 12;
  const baseline = 154;
  const plotHeight = 120;
  const plotWidth = width - left - right;
  const step = plotWidth / trend.length;
  const barWidth = Math.min(46, step * 0.54);
  const summary = trend.map((item) =>
    `${item.label}: ${item.percent === null ? 'not enough data' : `${item.percent}%`}, ${item.completed} completed of ${item.confirmed} confirmed${item.isPartial ? ` through ${item.through}` : ''}`,
  ).join('; ');

  return <>
    <div className="ym12-performance-chart" role="img" aria-label={`Monthly fulfilment trend. ${summary}`}>
      <svg viewBox={`0 0 ${width} 232`} aria-hidden="true" focusable="false">
        {[0, 50, 100].map((tick) => {
          const y = baseline - plotHeight * tick / 100;
          return <g key={tick}>
            <line className="ym12-chart-grid-line" x1={left} x2={width - right} y1={y} y2={y} />
            <text className="ym12-chart-axis-label" x={left - 10} y={y + 4} textAnchor="end">{tick}%</text>
          </g>;
        })}
        {trend.map((item, index) => {
          const x = left + step * index + (step - barWidth) / 2;
          const barHeight = item.percent === null ? 0 : plotHeight * item.percent / 100;
          const y = baseline - barHeight;
          const valueLabel = item.percent === null ? '—' : `${item.percent}%${item.isPartial ? '*' : ''}`;
          return <g key={item.month}>
            {item.percent !== null && <rect
              className={`ym12-chart-bar${item.isPartial ? ' ym12-chart-bar--partial' : ''}`}
              x={x} y={y} width={barWidth} height={barHeight} rx="5" />}
            <text className="ym12-chart-value" x={x + barWidth / 2} y={Math.max(14, y - 8)} textAnchor="middle">{valueLabel}</text>
            <text className="ym12-chart-month" x={x + barWidth / 2} y={181} textAnchor="middle">{item.label}{item.isPartial ? '*' : ''}</text>
            <text className="ym12-chart-count" x={x + barWidth / 2} y={202} textAnchor="middle">{item.completed} / {item.confirmed}</text>
          </g>;
        })}
      </svg>
    </div>
    <table className="sr-only">
      <caption>Monthly fulfilment trend: completed and confirmed orders</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Completed</th><th scope="col">Confirmed</th><th scope="col">Fulfilment</th><th scope="col">Reporting period</th></tr></thead>
      <tbody>{trend.map((item) => <tr key={item.month}>
        <th scope="row">{item.label}</th><td>{item.completed}</td><td>{item.confirmed}</td>
        <td>{item.percent === null ? 'Not enough data' : `${item.percent}%`}</td>
        <td>{item.isPartial ? `Partial, through ${item.through}` : 'Full month'}</td>
      </tr>)}</tbody>
    </table>
  </>;
}

export function SupplierPerformancePage({ supplierId }: { supplierId: string }) {
  const { state, retry } = usePerformance(supplierId);
  const navigate = useNavigate();

  return <div className="ym12-performance-page">
    <header className="ym12-performance-page-heading">
      <div>
        <nav className="ym12-breadcrumb" aria-label="Breadcrumb"><ol>
          <li><span>Suppliers</span></li><li aria-hidden="true">/</li>
          <li>{state.status === 'success' ? state.data.supplier.name : 'Supplier'}</li><li aria-hidden="true">/</li>
          <li aria-current="page">Performance</li>
        </ol></nav>
        <h2>Supplier performance</h2>
        <p>Understand reliability before your next bulk order.</p>
      </div>
      {state.status === 'success' && <Button variant="outline" className="ym12-performance-profile-link"
        onClick={() => navigate(`/buyer/suppliers/${encodeURIComponent(state.data.supplier.id)}`)}>
        <ArrowLeft size={18} aria-hidden="true" />Back to supplier profile
      </Button>}
    </header>

    {state.status === 'loading' && <PerformanceLoading />}
    {state.status === 'error' && <div className="ym12-performance-state">
      <Alert type="error">We couldn’t load supplier performance. Check your connection and try again.</Alert>
      <Button variant="outline" onClick={retry}>Retry</Button>
    </div>}
    {state.status === 'notFound' && <div className="ym12-performance-state">
      <EmptyState title="Supplier not found" description="This supplier profile is unavailable or the supplier is not approved."
        action={<Button variant="outline" onClick={() => navigate('/buyer/produce')}>Back to produce</Button>} />
    </div>}
    {state.status === 'success' && <>
      <section className="ym12-performance-supplier" aria-label="Supplier and reporting period">
        <div>
          <h2>{state.data.supplier.name}</h2>
          <p>{state.data.supplier.verified ? 'Verified supplier' : 'Verification not recorded'} · {state.data.supplier.district} district</p>
        </div>
        <div className="ym12-performance-period">
          <strong>{formatDateRange(state.data.period.from, state.data.period.to)}</strong>
          <span>{state.data.period.timezone}</span>
          {state.data.dataSource === 'sample' && <StatusBadge status="Sample data" />}
        </div>
      </section>

      {state.data.insufficientHistory
        ? <div className="ym12-performance-insufficient">
          <EmptyState title="Insufficient history"
            description="Supplier performance is shown after at least five confirmed orders have been recorded." />
        </div>
        : <div className="ym12-performance-content">
          <section className="ym12-performance-metrics" aria-label="Performance metrics">
            <StatCard label="Acceptance rate" value={formatRate(state.data.metrics.acceptanceRate)}
              subtext={formatRatio(state.data.metrics.acceptanceRate, 'requests accepted')} />
            <StatCard label="Fulfilment rate" value={formatRate(state.data.metrics.fulfilmentRate)}
              subtext={formatRatio(state.data.metrics.fulfilmentRate, 'confirmed orders')} />
            <StatCard label="On-time pickup" value={formatRate(state.data.metrics.onTimePickup)}
              subtext={formatRatio(state.data.metrics.onTimePickup, 'completed orders')} />
            <StatCard label="Dispute rate" value={formatRate(state.data.metrics.disputeRate, 1)}
              subtext={formatRatio(state.data.metrics.disputeRate, 'completed orders')} />
            <StatCard label="Completed orders" value={state.data.metrics.completedOrders.count === null
              ? 'Not enough data' : state.data.metrics.completedOrders.count.toLocaleString('en-US')}
            subtext="Within the selected period" />
          </section>

          <div className="ym12-performance-details">
            <ContentCard title="Fulfilment trend" subtitle="Completed / confirmed orders · monthly" className="ym12-performance-trend-card">
              {state.data.trend.length > 0
                ? <FulfilmentChart trend={state.data.trend} />
                : <p className="ym12-performance-no-trend">No monthly order activity is recorded for this period.</p>}
              {state.data.trend.some((item) => item.isPartial) && <p className="ym12-performance-partial-note">
                * {state.data.trend.filter((item) => item.isPartial).map((item) =>
                  `${new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${item.month}-01T00:00:00.000Z`))} includes orders through ${item.through ? formatDateRange(item.through, item.through) : 'the selected end date'}`,
                ).join('. ')}. Reporting timezone: {state.data.period.timezone}.
              </p>}
            </ContentCard>
            <ContentCard title="What these numbers use" className="ym12-performance-basis">
              <dl>
                <div><dt>Buyer requests</dt><dd>{state.data.basis.buyerRequests === null ? 'Not recorded' : state.data.basis.buyerRequests.toLocaleString('en-US')}</dd></div>
                <div><dt>Confirmed orders</dt><dd>{state.data.basis.confirmedOrders === null ? 'Not recorded' : state.data.basis.confirmedOrders.toLocaleString('en-US')}</dd></div>
                <div><dt>Completed orders</dt><dd>{state.data.basis.completedOrders === null ? 'Not recorded' : state.data.basis.completedOrders.toLocaleString('en-US')}</dd></div>
              </dl>
              <div className="ym12-performance-guarantee">
                <strong>A clear view, not a guarantee</strong>
                <p>Past recorded activity can help with sourcing decisions, but does not guarantee future outcomes.</p>
              </div>
            </ContentCard>
          </div>
        </div>}
      <p className="ym12-performance-footer">New suppliers are shown with ‘Insufficient history’, never a zero performance score.</p>
    </>}
  </div>;
}
