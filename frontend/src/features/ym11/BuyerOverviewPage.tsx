import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import type {
  BuyerDashboardResponse,
  BuyingInsights,
  ProcurementActivity,
} from './types';
import {
  formatColomboDayMonth,
  formatColomboHeadingDate,
  formatColomboShortDate,
  formatColomboTime,
  formatKg,
  formatLkrFromCents,
  formatLkrNumberFromCents,
  formatOrderStatusForBadge,
  formatPaddedCount,
  getFirstName,
  getInitials,
} from './utils';
import './ym11.css';

function ProcurementLineChart({ activity }: { activity: ProcurementActivity }) {
  const points = activity.series;
  const width = 560;
  const height = 190;
  const padLeft = 18;
  const padRight = 18;
  const padTop = 28;
  const padBottom = 32;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxVal = Math.max(activity.peakKg, 10);

  const coords = points.map((pt, index) => {
    const x =
      points.length > 1
        ? padLeft + (index / (points.length - 1)) * chartW
        : padLeft + chartW / 2;
    const y = padTop + chartH - (pt.totalKg / maxVal) * chartH;
    return { x, y, pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  const peakCoord = coords.reduce(
    (best, current) => (current.pt.totalKg >= best.pt.totalKg ? current : best),
    coords[0]
  );

  const labelStep = points.length > 10 ? Math.ceil(points.length / 7) : 1;

  return (
    <div className="ym11-chart-box">
      <svg
        className="ym11-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Procurement activity over the last ${activity.days} days totaling ${formatKg(activity.totalKg)}`}
      >
        <defs>
          <linearGradient id="ym11ActivityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-text)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent-text)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio) => {
          const y = padTop + chartH * ratio;
          return (
            <line
              key={ratio}
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#ym11ActivityFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent-text)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {coords.map(({ x, y, pt }, idx) => (
          <g key={pt.date}>
            {(points.length <= 10 || pt.totalKg > 0 || idx === coords.length - 1) && (
              <circle
                cx={x}
                cy={y}
                r={pt.totalKg > 0 ? 4.5 : 3}
                fill="var(--surface)"
                stroke="var(--accent-text)"
                strokeWidth="2"
              >
                <title>{`${formatColomboDayMonth(pt.date)}: ${formatKg(pt.totalKg)} (${pt.orderCount} order${pt.orderCount === 1 ? '' : 's'})`}</title>
              </circle>
            )}
            {(idx % labelStep === 0 || idx === coords.length - 1) && (
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted)"
              >
                {points.length <= 7 ? pt.dayLabel : formatColomboDayMonth(pt.date)}
              </text>
            )}
          </g>
        ))}

        {peakCoord && peakCoord.pt.totalKg > 0 && (
          <g transform={`translate(${Math.min(Math.max(peakCoord.x - 36, 6), width - 78)}, ${Math.max(peakCoord.y - 28, 2)})`}>
            <rect width="72" height="22" rx="6" fill="var(--green)" />
            <text
              x="36"
              y="14.5"
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="#ffffff"
            >
              {formatKg(peakCoord.pt.totalKg)}
            </text>
          </g>
        )}
      </svg>

      <div className="ym11-chart-summary">
        <span>
          Total volume ({activity.range === '7d' ? 'Last 7 days' : 'Last 30 days'}):{' '}
          <strong>{formatKg(activity.totalKg)}</strong>
        </span>
        <span>
          Total value: <strong>{formatLkrFromCents(activity.totalCents)}</strong>
        </span>
      </div>
    </div>
  );
}

function ForecastSparkline({
  series,
}: {
  series: BuyingInsights['demandForecast']['series'];
}) {
  const width = 320;
  const height = 110;
  const padX = 14;
  const padY = 18;
  const values = series.map((item) => Number(item.demand_kg ?? item.demandKg ?? 0));
  const maxVal = Math.max(...values, 1);

  const pts = series.map((item, idx) => {
    const val = values[idx];
    const x = series.length > 1 ? padX + (idx / (series.length - 1)) * (width - padX * 2) : width / 2;
    const y = padY + (1 - val / maxVal) * (height - padY * 2 - 14);
    const label = item.date ? formatColomboDayMonth(item.date) : item.day || `D${idx + 1}`;
    return { x, y, val, label };
  });

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <svg className="ym11-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="7-day demand forecast chart">
      <path d={d} fill="none" stroke="var(--accent-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, idx) => (
        <g key={idx}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="var(--surface)" stroke="var(--accent-text)" strokeWidth="2">
            <title>{`${p.label}: ${formatKg(p.val)}`}</title>
          </circle>
          {(idx === 0 || idx === pts.length - 1 || idx === Math.floor(pts.length / 2)) && (
            <text x={p.x} y={height - 2} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function BuyerOverviewPage() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<BuyerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [activityRange, setActivityRange] = useState<'7d' | '30d'>('7d');
  const [activityLoading, setActivityLoading] = useState(false);

  const [selectedCropId, setSelectedCropId] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [sectionError, setSectionError] = useState('');

  const fetchDashboard = useCallback(
    async (options?: {
      signal?: AbortSignal;
      silent?: boolean;
      range?: '7d' | '30d';
      cropId?: string;
      district?: string;
    }) => {
      const silent = Boolean(options?.silent);
      if (silent) setRefreshing(true);
      else setLoading(true);
      if (!silent) setError('');
      setSectionError('');
      try {
        const params: Record<string, string> = {
          range: options?.range ?? activityRange,
        };
        const crop = options?.cropId !== undefined ? options.cropId : selectedCropId;
        const dist = options?.district !== undefined ? options.district : selectedDistrict;
        if (crop) params.cropId = crop;
        if (dist) params.district = dist;

        const { data } = await api.get<BuyerDashboardResponse>('/ym11/dashboard', {
          params,
          signal: options?.signal,
        });
        if (options?.signal?.aborted) return;
        setDashboard(data);
        setActivityRange(data.procurementActivity.range);
      } catch (err) {
        if (
          options?.signal?.aborted ||
          (err as { code?: string })?.code === 'ERR_CANCELED' ||
          (err as { name?: string })?.name === 'CanceledError'
        ) {
          return;
        }
        if (silent) {
          setSectionError('Live refresh failed — showing last loaded data.');
        } else {
          setError('Could not load your Buyer Overview dashboard. Please check your connection and try again.');
        }
      } finally {
        if (!options?.signal?.aborted) {
          if (silent) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [activityRange, selectedCropId, selectedDistrict]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboard({ signal: controller.signal, range: '7d', cropId: '', district: '' });
    return () => controller.abort();
    // Initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time background refresh every 30s when tab is visible
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchDashboard({ silent: true });
      }
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboard]);

  async function handleRangeChange(nextRange: '7d' | '30d') {
    setActivityRange(nextRange);
    setActivityLoading(true);
    setSectionError('');
    try {
      const { data } = await api.get<{ procurementActivity: ProcurementActivity }>(
        '/ym11/dashboard/procurement-activity',
        { params: { range: nextRange } }
      );
      setDashboard((prev) => (prev ? { ...prev, procurementActivity: data.procurementActivity } : prev));
    } catch {
      setSectionError('Could not update procurement activity range. Please retry.');
    } finally {
      setActivityLoading(false);
    }
  }

  async function handleInsightsFilterChange(nextCropId: string, nextDistrict: string) {
    setSelectedCropId(nextCropId);
    setSelectedDistrict(nextDistrict);
    setInsightsLoading(true);
    setSectionError('');
    try {
      const params: Record<string, string> = {};
      if (nextCropId) params.cropId = nextCropId;
      if (nextDistrict) params.district = nextDistrict;
      const { data } = await api.get<{ insights: BuyingInsights }>('/ym11/dashboard/insights', { params });
      setDashboard((prev) => (prev ? { ...prev, insights: data.insights } : prev));
    } catch {
      setSectionError('Could not refresh buying insights for the selected filters.');
    } finally {
      setInsightsLoading(false);
    }
  }

  if (loading) {
    return (
      <ContentCard>
        <div className="ym11-loading-card" role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <span>Loading Buyer Overview dashboard…</span>
        </div>
      </ContentCard>
    );
  }

  if (error || !dashboard) {
    return (
      <ContentCard title="Buyer Overview unavailable">
        <div className="ym11-error-box">
          <Alert type="error">{error || 'Dashboard data could not be loaded.'}</Alert>
          <Button variant="outline" onClick={() => void fetchDashboard()}>
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </Button>
        </div>
      </ContentCard>
    );
  }

  const { buyer, stats, matchingNow, latestBulkMatch, procurementActivity, insights, recentOrders } = dashboard;
  const firstName = getFirstName(buyer.name);
  const activeCropName =
    insights.filters.crops.find((c) => c.id === selectedCropId)?.name || 'All crops';
  const activeDistrictLabel = selectedDistrict || 'All districts';

  const cropOptions = [
    { value: '', label: 'All crops' },
    ...insights.filters.crops.map((c) => ({ value: c.id, label: c.name })),
  ];
  const districtOptions = [
    { value: '', label: 'All districts' },
    ...insights.filters.districts.map((d) => ({ value: d, label: d })),
  ];

  const matchTopThree = matchingNow.matches.slice(0, 3);
  const suggestedMatches = insights.suggestedHarvestMatches.matches.slice(0, 3);
  const suggestedTotalKg = insights.suggestedHarvestMatches.totalAvailableKg;

  return (
    <div className="ym11-overview">
      {/* Greeting Header */}
      <section className="ym11-header" aria-label="Buyer dashboard greeting">
        <div>
          <p className="ym11-eyebrow">{formatColomboHeadingDate(dashboard.generatedAt)}</p>
          <h2 className="ym11-greeting">Fresh starts here, {firstName}.</h2>
          <p className="ym11-subtitle">Trusted farms. Better sourcing. One connected workspace.</p>
        </div>
        <div className="ym11-header-actions">
          <span className="ym11-planned-notice-pill" title="Auto-refreshes from Neon PostgreSQL every 30 seconds">
            <span className="ym11-dot ym11-seg-0" aria-hidden="true" />
            Live · Updated {formatColomboTime(dashboard.generatedAt)}
          </span>
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void fetchDashboard({ silent: true })}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
            <Plus size={16} aria-hidden="true" />
            Create demand
          </Button>
        </div>
      </section>

      {sectionError && <Alert type="warning">{sectionError}</Alert>}

      {/* 4 KPI Stat Cards */}
      <section className="ym11-kpi-grid" aria-label="Key buyer metrics">
        <div className="ym11-kpi-wrap">
          <StatCard
            label="Active orders"
            value={formatPaddedCount(stats.activeOrdersCount)}
            subtext={
              stats.awaitingSupplierCount > 0
                ? `${stats.awaitingSupplierCount} awaiting supplier response.`
                : 'Active orders currently in progress.'
            }
          />
          <span className="ym11-kpi-icon ym11-kpi-icon--green" aria-hidden="true">
            <Package size={18} />
          </span>
        </div>

        <div className="ym11-kpi-wrap">
          <StatCard
            label="Available supply"
            value={formatKg(stats.availableSupplyKg)}
            subtext={
              stats.activeGrowersCount > 0
                ? `Fresh stock across ${stats.activeGrowersCount} verified ${stats.activeGrowersCount === 1 ? 'grower' : 'growers'}.`
                : 'No active harvest stock available yet.'
            }
          />
          <span className="ym11-kpi-icon ym11-kpi-icon--green" aria-hidden="true">
            <Sprout size={18} />
          </span>
        </div>

        <div className="ym11-kpi-wrap">
          <StatCard
            label="Completed orders"
            value={formatPaddedCount(stats.completedOrdersCount)}
            subtext={`${stats.completedLast30DaysCount} accepted in the last 30 days.`}
          />
          <span className="ym11-kpi-icon ym11-kpi-icon--warm" aria-hidden="true">
            <CheckCircle2 size={18} />
          </span>
        </div>

        <div className="ym11-kpi-wrap">
          <StatCard
            label="Held funds"
            value={formatLkrFromCents(stats.heldFundsCents, stats.currency)}
            subtext={
              stats.simulatedWallet
                ? `Reserved — simulated only (${formatLkrFromCents(stats.availableFundsCents, stats.currency)} available).`
                : 'Reserved across active orders.'
            }
          />
          <span className="ym11-kpi-icon ym11-kpi-icon--warm" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
        </div>
      </section>

      {/* Hero Bulk Sourcing Banner + Matching Now */}
      <section className="ym11-two-col" aria-label="Bulk sourcing and live harvest matching">
        <article className="ym11-hero-banner">
          <div className="ym11-hero-content">
            <p className="ym11-hero-eyebrow">
              <Sparkles size={13} aria-hidden="true" />
              Smart Bulk Sourcing
            </p>
            <h3 className="ym11-hero-title">
              Big orders.
              <br />
              Shared harvests.
            </h3>
            <p className="ym11-hero-copy">
              Combine trusted growers into one transparent bulk order with verified grades, live availability, and unified delivery tracking.
            </p>
          </div>
          <div className="ym11-hero-actions">
            <Button variant="secondary" onClick={() => navigate('/buyer/bulk-matching')}>
              Find my harvests
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>

          <svg className="ym11-hero-art" viewBox="0 0 260 220" aria-hidden="true">
            <circle cx="205" cy="56" r="18" fill="#E7A06C" opacity="0.85" />
            <path d="M55 210 L110 120 L165 210 Z" fill="none" stroke="#89b898" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
            <path d="M90 220 Q175 135 260 170 L260 220 Z" fill="#e6f0e8" opacity="0.18" />
            <path d="M125 220 Q195 165 260 190 L260 220 Z" fill="#e6f0e8" opacity="0.28" />
            <path d="M168 178 L168 140" stroke="#b7dcc2" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="158" cy="148" rx="9" ry="5" transform="rotate(-25 158 148)" fill="#89b898" />
            <ellipse cx="178" cy="144" rx="9" ry="5" transform="rotate(25 178 144)" fill="#b7dcc2" />
          </svg>
        </article>

        <ContentCard>
          <div className="ym11-card-top">
            <div>
              <p className="ym11-eyebrow">Matching now</p>
              <h3 className="ym11-card-title">A perfect bulk match</h3>
            </div>
            <StatusBadge status={matchTopThree.length > 0 ? 'Active' : 'Pending'} />
          </div>

          {matchTopThree.length === 0 ? (
            <EmptyState
              title="No matching stock yet"
              description="Approved grower harvests will appear here as soon as stock becomes available."
              action={
                <Button variant="outline" onClick={() => navigate('/buyer/marketplace')}>
                  Explore Marketplace
                </Button>
              }
            />
          ) : (
            <>
              <div className="ym11-grower-list">
                {matchTopThree.map((item, idx) => (
                  <div className="ym11-grower-row" key={item.listingId || item.batchId}>
                    <div className="ym11-grower-left">
                      <span className={`ym11-avatar ym11-avatar--${idx % 3}`} aria-hidden="true">
                        {getInitials(item.farmName)}
                      </span>
                      <div className="ym11-grower-meta">
                        <p className="ym11-grower-name">{item.farmName}</p>
                        <p className="ym11-grower-detail">
                          {item.cropName} · {item.gradeName}
                        </p>
                      </div>
                    </div>
                    <div className="ym11-grower-right">
                      <p className="ym11-grower-kg">{formatKg(item.availableKg)}</p>
                      <p className="ym11-grower-price">
                        {item.unitPriceCents !== null
                          ? `${formatLkrFromCents(item.unitPriceCents)}/kg`
                          : item.district}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ym11-total-strip">
                <span>Total matched</span>
                <strong>{formatKg(matchingNow.totalAvailableKg)}</strong>
              </div>

              <Link className="ym11-inline-link" to="/buyer/bulk-matching">
                View matching details
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </>
          )}
        </ContentCard>
      </section>

      {/* Procurement Activity Chart + Latest Bulk Match */}
      <section className="ym11-two-col" aria-label="Procurement activity and latest bulk match">
        <ContentCard>
          <div className="ym11-card-top">
            <div>
              <h3 className="ym11-card-title">Procurement activity</h3>
              <p className="ym11-card-sub">Your recent purchase volume</p>
            </div>
            <SelectField
              label="Activity time range"
              className="ym11-range-select"
              value={activityRange}
              disabled={activityLoading}
              options={[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ]}
              onChange={(e) => void handleRangeChange(e.target.value as '7d' | '30d')}
            />
          </div>

          <ProcurementLineChart activity={procurementActivity} />

          {procurementActivity.totalKg === 0 && (
            <p className="ym11-card-sub" style={{ marginTop: 10 }}>
              No confirmed orders placed in this window. Switch to Last 30 days or explore available harvests in the marketplace.
            </p>
          )}
        </ContentCard>

        <ContentCard>
          <div className="ym11-card-top">
            <div>
              <p className="ym11-eyebrow">Latest bulk match</p>
              {latestBulkMatch ? (
                <>
                  <h3 className="ym11-card-title">
                    {formatKg(latestBulkMatch.totalKg)}. {latestBulkMatch.growerCount}{' '}
                    {latestBulkMatch.growerCount === 1 ? 'grower' : 'growers'}.
                  </h3>
                  <p className="ym11-card-sub">
                    {latestBulkMatch.orderCode} · {latestBulkMatch.primaryGrade || 'Standard'}{' '}
                    {latestBulkMatch.primaryCrop || 'Produce'} match.
                  </p>
                </>
              ) : (
                <h3 className="ym11-card-title">No bulk match yet</h3>
              )}
            </div>
          </div>

          {!latestBulkMatch ? (
            <EmptyState
              title="No active match recorded"
              description="Create a demand or match harvests to see your grower allocation breakdown here."
              action={
                <Button variant="outline" onClick={() => navigate('/buyer/bulk-matching')}>
                  Open Bulk Matching
                </Button>
              }
            />
          ) : (
            <>
              <div className="ym11-seg-bar" aria-label="Grower allocation split">
                {latestBulkMatch.growers.map((grower, idx) => {
                  const pct =
                    latestBulkMatch.totalKg > 0
                      ? Math.max((grower.agreedKg / latestBulkMatch.totalKg) * 100, 8)
                      : 100;
                  return (
                    <span
                      key={grower.allocationId}
                      className={`ym11-seg-piece ym11-seg-${idx % 5}`}
                      style={{ width: `${pct}%` }}
                      title={`${grower.farmName}: ${formatKg(grower.agreedKg)}`}
                    />
                  );
                })}
              </div>

              <div className="ym11-seg-legend">
                {latestBulkMatch.growers.map((grower, idx) => (
                  <span className="ym11-seg-legend-item" key={grower.allocationId}>
                    <span className={`ym11-dot ym11-seg-${idx % 5}`} aria-hidden="true" />
                    {grower.farmName} ({formatKg(grower.agreedKg)})
                  </span>
                ))}
              </div>

              <div className="ym11-summary-rows">
                <div className="ym11-summary-row">
                  <span>Goods total</span>
                  <strong>{formatLkrFromCents(latestBulkMatch.goodsTotalCents, stats.currency)}</strong>
                </div>
                <div className="ym11-summary-row">
                  <span>Delivery date</span>
                  <strong>{formatColomboShortDate(latestBulkMatch.deliveryDate)}</strong>
                </div>
                <div className="ym11-summary-row">
                  <span>Status</span>
                  <StatusBadge status={formatOrderStatusForBadge(latestBulkMatch.status)} />
                </div>
              </div>
            </>
          )}
        </ContentCard>
      </section>

      {/* AI Buying Insights */}
      <ContentCard aria-label="AI Buying Insights">
        <div className="ym11-insights-head">
          <div className="ym11-insights-brand">
            <span className="ym11-insights-icon" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="ym11-card-title">AI Buying Insights</h3>
              <p className="ym11-card-sub">Smarter sourcing with market information.</p>
            </div>
          </div>
          <StatusBadge status="Active" />
        </div>

        <div className="ym11-insights-grid">
          {/* 01 Demand Forecast */}
          <div className="ym11-insight-panel">
            <div className="ym11-panel-tag">
              <span className="ym11-panel-num">01</span>
              <span>Demand forecast</span>
            </div>

            <div className="ym11-card-top" style={{ marginBottom: 0 }}>
              <div>
                <h4 className="ym11-card-title" style={{ fontSize: 15 }}>
                  7-Day Demand Forecast
                </h4>
                <p className="ym11-card-sub">Projected daily buyer demand</p>
              </div>
              <StatusBadge
                status={
                  insights.demandForecast.available
                    ? insights.demandForecast.trend === 'upward'
                      ? 'Active'
                      : insights.demandForecast.trend === 'downward'
                        ? 'Pending'
                        : 'Scheduled'
                    : 'Scheduled'
                }
              />
            </div>

            <div className="ym11-filter-row">
              <SelectField
                label="Crop"
                className="ym11-compact-select"
                value={selectedCropId}
                disabled={insightsLoading}
                options={cropOptions}
                onChange={(e) => void handleInsightsFilterChange(e.target.value, selectedDistrict)}
              />
              <SelectField
                label="District"
                className="ym11-compact-select"
                value={selectedDistrict}
                disabled={insightsLoading}
                options={districtOptions}
                onChange={(e) => void handleInsightsFilterChange(selectedCropId, e.target.value)}
              />
            </div>

            {insights.demandForecast.available && insights.demandForecast.series.length > 0 ? (
              <>
                <ForecastSparkline series={insights.demandForecast.series} />
                <div className="ym11-note-box">
                  {insights.demandForecast.explanation}
                </div>
              </>
            ) : (
              <div className="ym11-note-box">
                <strong style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <TrendingUp size={14} aria-hidden="true" />
                  AI Forecasting API pending
                </strong>
                {insights.demandForecast.explanation}
              </div>
            )}
          </div>

          {/* 02 Observed Prices */}
          <div className="ym11-insight-panel">
            <div className="ym11-panel-tag">
              <span className="ym11-panel-num">02</span>
              <span>Observed prices</span>
            </div>

            <div>
              <h4 className="ym11-card-title" style={{ fontSize: 15 }}>
                Market Price Insights
              </h4>
              <p className="ym11-card-sub">
                {activeCropName} · {activeDistrictLabel}
              </p>
            </div>

            {insights.marketPriceInsights.available &&
            insights.marketPriceInsights.minPriceCents !== null &&
            insights.marketPriceInsights.maxPriceCents !== null ? (
              <>
                <p className="ym11-price-hero">
                  LKR {formatLkrNumberFromCents(insights.marketPriceInsights.minPriceCents)}–
                  {formatLkrNumberFromCents(insights.marketPriceInsights.maxPriceCents)}
                  <small>/kg</small>
                </p>

                <div>
                  <div className="ym11-price-track">
                    <div className="ym11-price-fill" />
                  </div>
                  <div className="ym11-price-scale">
                    <span>{formatLkrFromCents(insights.marketPriceInsights.minPriceCents)}</span>
                    <span>Avg {formatLkrFromCents(insights.marketPriceInsights.avgPriceCents)}</span>
                    <span>{formatLkrFromCents(insights.marketPriceInsights.maxPriceCents)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="ym11-note-box">
                No current market price observations recorded for {activeCropName} in{' '}
                {activeDistrictLabel} yet.
              </div>
            )}

            <div className="ym11-kv-list">
              <div className="ym11-kv-row">
                <span>Source</span>
                <strong>{insights.marketPriceInsights.source || insights.marketPriceInsights.method}</strong>
              </div>
              <div className="ym11-kv-row">
                <span>Date window</span>
                <strong>
                  {insights.marketPriceInsights.dateFrom && insights.marketPriceInsights.dateUntil
                    ? `${formatColomboShortDate(insights.marketPriceInsights.dateFrom)} – ${formatColomboShortDate(insights.marketPriceInsights.dateUntil)}`
                    : '—'}
                </strong>
              </div>
              <div className="ym11-kv-row">
                <span>Observations</span>
                <strong>{insights.marketPriceInsights.observationCount}</strong>
              </div>
              <div className="ym11-kv-row">
                <span>Last updated</span>
                <strong>{formatColomboShortDate(insights.marketPriceInsights.lastUpdated)}</strong>
              </div>
            </div>

            <Alert type="warning">{insights.marketPriceInsights.advisoryNote}</Alert>
          </div>

          {/* 03 Rule-Based Harvest Matching */}
          <div className="ym11-insight-panel">
            <div className="ym11-panel-tag">
              <span className="ym11-panel-num">03</span>
              <span>Rule-based harvest matching</span>
            </div>

            <div className="ym11-card-top" style={{ marginBottom: 0 }}>
              <div>
                <h4 className="ym11-card-title" style={{ fontSize: 15 }}>
                  Suggested Harvest Matches
                </h4>
                <p className="ym11-card-sub">
                  {activeCropName} · Available now
                </p>
              </div>
              <strong style={{ color: 'var(--accent-text)', fontSize: 14 }}>
                {formatKg(suggestedTotalKg)}
              </strong>
            </div>

            {suggestedMatches.length === 0 ? (
              <div className="ym11-note-box">
                No verified harvest stock matches the current crop and district filters. Clear a filter to view all available growers.
              </div>
            ) : (
              <>
                <div className="ym11-grower-list">
                  {suggestedMatches.map((item, idx) => (
                    <div className="ym11-grower-row" key={item.listingId || item.batchId}>
                      <div className="ym11-grower-left">
                        <span className={`ym11-avatar ym11-avatar--${idx % 3}`} aria-hidden="true">
                          {getInitials(item.farmName)}
                        </span>
                        <div className="ym11-grower-meta">
                          <p className="ym11-grower-name">{item.farmName}</p>
                          <p className="ym11-grower-detail">
                            {item.gradeName} · {item.cropName}
                          </p>
                        </div>
                      </div>
                      <div className="ym11-grower-right">
                        <p className="ym11-grower-kg">{formatKg(item.availableKg)}</p>
                        <p className="ym11-grower-price">
                          {item.unitPriceCents !== null
                            ? `${formatLkrFromCents(item.unitPriceCents)}/kg`
                            : item.batchStatus}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ym11-seg-bar" style={{ margin: '6px 0 4px' }}>
                  {suggestedMatches.map((item, idx) => {
                    const pct =
                      suggestedTotalKg > 0
                        ? Math.max((item.availableKg / suggestedTotalKg) * 100, 10)
                        : 100;
                    return (
                      <span
                        key={item.listingId || item.batchId}
                        className={`ym11-seg-piece ym11-seg-${idx % 5}`}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })}
                </div>

                <div className="ym11-note-box">
                  Matched across {insights.suggestedHarvestMatches.growerCount} verified{' '}
                  {insights.suggestedHarvestMatches.growerCount === 1 ? 'grower' : 'growers'} providing{' '}
                  <strong>{formatKg(suggestedTotalKg)}</strong> of available supply.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ym11-insights-footer">
          <div className="ym11-insights-explain">
            <strong>Why am I seeing these insights?</strong>
            Demand forecasts use historical demand estimates; comparable prices use recent market observations; harvest matches use available supply, crop, grade, and matching rules.
          </div>
          <div className="ym11-insights-actions">
            <Button variant="primary" onClick={() => navigate('/buyer/market-insights')}>
              Explore Market Insights
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/buyer/marketplace')}>
              View harvest matches
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <p className="ym11-advisory-foot">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>{insights.advisoryNotice}</span>
        </p>
      </ContentCard>

      {/* Your Recent Orders */}
      <ContentCard>
        <div className="ym11-table-head">
          <div>
            <h3 className="ym11-card-title">Your recent orders</h3>
            <p className="ym11-card-sub">Track your latest sourcing activity</p>
          </div>
          <Link className="ym11-inline-link" style={{ marginTop: 0 }} to="/buyer/orders">
            View all
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            title="No orders placed yet"
            description="Browse the marketplace or create a bulk demand to start sourcing directly from approved farms."
            action={
              <Button variant="primary" onClick={() => navigate('/buyer/marketplace')}>
                Explore Marketplace
              </Button>
            }
          />
        ) : (
          <Table headers={['Order / Source', 'Produce', 'Quantity', 'Goods Total', 'Status', '']}>
            {recentOrders.map((order) => (
              <TableRow key={order.id}>
                <td>
                  <p className="ym11-order-primary">{order.orderCode}</p>
                  <p className="ym11-order-sub">{order.sourceLabel}</p>
                </td>
                <td>
                  <p className="ym11-order-primary">{order.cropName}</p>
                  <p className="ym11-order-sub">{order.gradeName || order.destinationDistrict}</p>
                </td>
                <td>{formatKg(order.totalKg)}</td>
                <td>
                  <strong>{formatLkrFromCents(order.agreedTotalCents, stats.currency)}</strong>
                </td>
                <td>
                  <StatusBadge status={formatOrderStatusForBadge(order.status)} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Button
                    variant="outline"
                    className="ym11-row-action"
                    aria-label={`View order ${order.orderCode}`}
                    onClick={() => navigate('/buyer/orders')}
                  >
                    <ArrowRight size={15} aria-hidden="true" />
                  </Button>
                </td>
              </TableRow>
            ))}
          </Table>
        )}
      </ContentCard>
    </div>
  );
}
