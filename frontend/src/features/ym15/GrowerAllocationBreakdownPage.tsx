import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import type { BulkMatchResponseData } from './types';
import './ym15.css';

interface GrowerAllocationBreakdownPageProps {
  data: BulkMatchResponseData;
  onBackToResults: () => void;
  onContinue: () => void;
}

const BAR_COLORS = ['#315a42', '#e7a06c', '#98c2a6', '#5e8c70', '#d48752'];

const DECISION_CHECKS = [
  'All selected growers are approved.',
  'Crop and grade requirements are satisfied.',
  'Harvest window is compatible.',
  'Allocated quantities do not exceed available stock.',
  'Ranking uses unit price, known distance and stable listing ID.',
];

function GrowersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuantityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 8.5V16a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8.5a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z" strokeLinejoin="round" />
      <path d="m3.3 7 8.7 5 8.7-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22V12" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoBadgeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || 'YM';
}

function formatGrowerCountWord(count: number): string {
  if (count === 1) return 'One grower';
  if (count === 2) return 'Two growers';
  if (count === 3) return 'Three growers';
  return `${count} growers`;
}

export function GrowerAllocationBreakdownPage({
  data,
  onBackToResults,
  onContinue,
}: GrowerAllocationBreakdownPageProps) {
  const totalAllocatedKg = data.matchedKg;
  const isFullAllocation = data.requestedKg > 0 && totalAllocatedKg >= data.requestedKg;

  const remainingBudgetLkr =
    data.maxBudgetLkr !== null
      ? Number(Math.max(0, data.maxBudgetLkr - data.goodsTotalLkr).toFixed(2))
      : null;

  const cropName = data.allocations[0]?.crop ?? data.crop ?? 'produce';
  const gradeName = data.allocations[0]?.grade ?? data.grade ?? '';
  const growerWord = formatGrowerCountWord(data.growerCount);
  const fulfillmentLabel = data.status === 'complete' ? 'complete' : 'partial';

  const requestBadgeText = data.requestId
    ? `REQUEST ID: ${data.requestId.slice(0, 12).toUpperCase()}`
    : 'REQUEST ID: YM15-ACTIVE';

  const primaryAlternative = data.alternatives[0] ?? null;

  return (
    <div className="ym15-page">
      <div className="ym15-results-topbar">
        <div>
          <h2 className="ym15-results-title">Grower allocation breakdown</h2>
          <p className="ym15-lead-copy">
            Review how your bulk order is distributed across selected growers.
          </p>
        </div>
        <div className="ym15-header-badges">
          <span className="ym15-request-id-pill">{requestBadgeText}</span>
          <StatusBadge status={data.status === 'complete' ? 'ACTIVE' : 'PENDING'} />
        </div>
      </div>

      <div className="ym15-kpi-grid">
        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <GrowersIcon />
          </span>
          <StatCard
            label="SELECTED GROWERS"
            value={String(data.growerCount).padStart(2, '0')}
            subtext="Growers selected"
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <QuantityIcon />
          </span>
          <StatCard
            label="TOTAL ALLOCATED"
            value={`${totalAllocatedKg.toLocaleString()} kg`}
            subtext={isFullAllocation ? 'Full quantity allocated' : 'Partial quantity allocated'}
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <WalletIcon />
          </span>
          <StatCard
            label="GOODS TOTAL"
            value={`LKR ${data.goodsTotalLkr.toLocaleString()}`}
            subtext="Before reservation"
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <WalletIcon />
          </span>
          <StatCard
            label="BUDGET REMAINING"
            value={remainingBudgetLkr !== null ? `LKR ${remainingBudgetLkr.toLocaleString()}` : 'No cap'}
            subtext={
              data.maxBudgetLkr !== null ? `From LKR ${data.maxBudgetLkr.toLocaleString()}` : 'No budget cap set'
            }
          />
        </div>
      </div>

      <ContentCard>
        <div className="ym15-dist-layout">
          <div className="ym15-dist-main">
            <h3 className="ym15-subcard-heading">How your order is distributed</h3>
            <p className="ym15-dist-desc">
              {totalAllocatedKg.toLocaleString()} kg. {growerWord}. A {fulfillmentLabel}{' '}
              {gradeName ? `${gradeName} ` : ''}
              {cropName.toLowerCase()} allocation.
            </p>

            {data.allocations.length > 0 ? (
              <>
                <div className="ym15-dist-bar" role="img" aria-label="Order distribution bar">
                  {data.allocations.map((item, idx) => {
                    const widthPct =
                      totalAllocatedKg > 0 ? (item.allocatedKg / totalAllocatedKg) * 100 : 0;
                    const color = BAR_COLORS[idx % BAR_COLORS.length];
                    return (
                      <span
                        key={item.id}
                        className="ym15-dist-segment"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                        title={`${item.growerName}: ${item.allocatedKg.toLocaleString()} kg`}
                      />
                    );
                  })}
                </div>

                <div className="ym15-dist-legend">
                  {data.allocations.map((item, idx) => {
                    const pct =
                      totalAllocatedKg > 0
                        ? Math.round((item.allocatedKg / totalAllocatedKg) * 100)
                        : 0;
                    const color = BAR_COLORS[idx % BAR_COLORS.length];
                    return (
                      <div key={item.id} className="ym15-legend-entry">
                        <span
                          className="ym15-legend-dot"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <div>
                          <div className="ym15-legend-title">{item.growerName}</div>
                          <div className="ym15-legend-sub">
                            {item.allocatedKg.toLocaleString()} kg - {pct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <Alert type="warning">No grower allocations available for distribution breakdown.</Alert>
            )}
          </div>

          <div className="ym15-dist-total-box">
            <span className="ym15-dist-total-label">Total Quantity</span>
            <strong className="ym15-dist-total-value">{totalAllocatedKg.toLocaleString()} kg</strong>
          </div>
        </div>
      </ContentCard>

      <div className="ym15-breakdown-grid">
        <ContentCard title="Detailed grower allocation">
          {data.allocations.length === 0 ? (
            <Alert type="warning">No selected growers to display in allocation breakdown.</Alert>
          ) : (
            <div className="ym15-detail-table-wrap">
              <div className="ym15-detail-head">
                <span>Grower details</span>
                <span>Allocation</span>
                <span className="ym15-text-right">Financial details</span>
              </div>

              <div className="ym15-detail-body">
                {data.allocations.map((item, idx) => {
                  const pct =
                    totalAllocatedKg > 0
                      ? Math.round((item.allocatedKg / totalAllocatedKg) * 100)
                      : 0;
                  const avatarColor = BAR_COLORS[idx % BAR_COLORS.length];

                  return (
                    <div key={item.id} className="ym15-detail-row">
                      <div className="ym15-grower-cell">
                        <span
                          className="ym15-grower-avatar ym15-grower-avatar--tinted"
                          style={{
                            backgroundColor: `${avatarColor}22`,
                            color: avatarColor,
                          }}
                          aria-hidden="true"
                        >
                          {getInitials(item.growerName)}
                        </span>
                        <div>
                          <div className="ym15-grower-name">{item.growerName}</div>
                          <div className="ym15-grower-meta">
                            {item.batchCode}
                            {item.distanceKm !== null ? ` • ${item.distanceKm} km away` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="ym15-detail-alloc-col">
                        <div className="ym15-alloc-kg">{item.allocatedKg.toLocaleString()} kg</div>
                        <div className="ym15-grower-meta">{pct}% contribution</div>
                      </div>

                      <div className="ym15-detail-fin-col">
                        <div className="ym15-fin-pair">
                          <span>Unit price</span>
                          <strong>LKR {item.unitPriceLkr.toLocaleString()}/kg</strong>
                        </div>
                        <div className="ym15-fin-pair ym15-fin-pair--total">
                          <span>Allocation total</span>
                          <strong>LKR {item.allocationTotalLkr.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ym15-detail-footer">
                <span>Order goods total</span>
                <strong>LKR {data.goodsTotalLkr.toLocaleString()}</strong>
              </div>
            </div>
          )}
        </ContentCard>

        <ContentCard title="Allocation decision details">
          <ul className="ym15-decision-list">
            {DECISION_CHECKS.map((text) => (
              <li key={text} className="ym15-decision-item">
                <span className="ym15-decision-icon" aria-hidden="true">
                  <CheckIcon />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </ContentCard>
      </div>

      <ContentCard>
        <div className="ym15-alt-breakdown-layout">
          <div className="ym15-alt-breakdown-table-col">
            <h3 className="ym15-subcard-heading">Other available alternatives</h3>

            {data.alternatives.length > 0 ? (
              <div className="ym15-alt-grid-table">
                <div className="ym15-alt-grid-head">
                  <span>Grower</span>
                  <span>Crop</span>
                  <span>Grade</span>
                  <span>Available</span>
                  <span>Unit Price</span>
                  <span>Distance</span>
                </div>
                {data.alternatives.map((alt) => (
                  <div key={alt.id} className="ym15-alt-grid-row">
                    <span className="ym15-alt-grower-name">{alt.growerName}</span>
                    <span>{alt.crop ?? cropName}</span>
                    <span>{alt.grade ?? gradeName}</span>
                    <span>{alt.availableKg.toLocaleString()} kg</span>
                    <span>LKR {alt.unitPriceLkr.toLocaleString()}/kg</span>
                    <span>
                      {alt.distanceKm !== null && alt.distanceKm !== undefined
                        ? `${alt.distanceKm} km`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ym15-method-note">
                No additional eligible grower listings remained unselected for this request.
              </p>
            )}
          </div>

          <div className="ym15-alt-breakdown-note-col">
            <span className="ym15-alt-info-icon" aria-hidden="true">
              <InfoBadgeIcon />
            </span>
            <p className="ym15-alt-breakdown-note">
              {primaryAlternative
                ? primaryAlternative.reasonText
                : 'Not selected because the current selected growers already cover the requested criteria.'}
            </p>
          </div>
        </div>
      </ContentCard>

      <div className="ym15-results-actions">
        <Button type="button" variant="outline" onClick={onBackToResults}>
          Back
        </Button>
        <Button type="button" variant="primary" className="ym15-submit-btn" onClick={onContinue}>
          Continue →
        </Button>
      </div>
    </div>
  );
}