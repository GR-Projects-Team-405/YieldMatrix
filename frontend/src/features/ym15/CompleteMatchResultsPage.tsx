import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import type { BulkMatchResponseData } from './types';
import './ym15.css';

interface CompleteMatchResultsPageProps {
  data: BulkMatchResponseData;
  onBackToRequest: () => void;
  onViewAllocationBreakdown: () => void;
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

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
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

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowerAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className="ym15-grower-avatar" aria-hidden="true">
      {initials || 'YM'}
    </span>
  );
}

export function CompleteMatchResultsPage({
  data,
  onBackToRequest,
  onViewAllocationBreakdown,
}: CompleteMatchResultsPageProps) {
  const fulfillmentPercent =
    data.requestedKg > 0 ? Math.round((data.matchedKg / data.requestedKg) * 100) : 0;

  const budgetSubtext =
    data.maxBudgetLkr !== null
      ? data.withinBudget
        ? `Within LKR ${data.maxBudgetLkr.toLocaleString()} budget`
        : `Exceeds LKR ${data.maxBudgetLkr.toLocaleString()} budget`
      : 'No budget cap set';

  return (
    <div className="ym15-page">
      <div className="ym15-results-topbar">
        <div>
          <h2 className="ym15-results-title">Complete match results</h2>
          <p className="ym15-lead-copy">
            {data.growerCount > 0
              ? `Your ${data.requestedKg.toLocaleString()} kg request matched across ${data.growerCount} eligible grower listing(s).`
              : `No eligible grower listings matched your ${data.requestedKg.toLocaleString()} kg request.`}
          </p>
        </div>
        <StatusBadge status={data.status === 'complete' ? 'ACTIVE' : 'PENDING'} />
      </div>

      <div className="ym15-kpi-grid">
        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <QuantityIcon />
          </span>
          <StatCard
            label="REQUESTED QUANTITY"
            value={`${data.requestedKg.toLocaleString()} kg`}
            subtext="Buyer requirement"
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge ym15-kpi-icon-badge--success" aria-hidden="true">
            <CheckCircleIcon />
          </span>
          <StatCard
            label="MATCHED QUANTITY"
            value={`${data.matchedKg.toLocaleString()} kg`}
            subtext={`${fulfillmentPercent}% fulfilled`}
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge ym15-kpi-icon-badge--success" aria-hidden="true">
            <CheckCircleIcon />
          </span>
          <StatCard
            label="SHORTAGE"
            value={`${data.shortageKg.toLocaleString()} kg`}
            subtext={data.shortageKg === 0 ? 'No shortage' : 'Unmatched quantity'}
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <WalletIcon />
          </span>
          <StatCard
            label="GOODS TOTAL"
            value={`LKR ${data.goodsTotalLkr.toLocaleString()}`}
            subtext={budgetSubtext}
          />
        </div>
      </div>

      <div className="ym15-results-main-grid">
        <div className="ym15-results-left-col">
          <ContentCard
            title="Selected growers"
            subtitle={
              data.growerCount > 0
                ? `${data.growerCount} grower listing(s) allocated for your request.`
                : 'No grower allocations were selected.'
            }
          >
            {data.allocations.length === 0 ? (
              <Alert type="warning">
                No active approved grower listings matched the selected crop, grade, availability, or budget rules.
              </Alert>
            ) : (
              <div className="ym15-alloc-table-wrap">
                <div className="ym15-alloc-head">
                  <span>GROWER / BATCH</span>
                  <span>QUANTITY / PRICE</span>
                  <span className="ym15-text-right">ALLOCATION TOTAL</span>
                </div>

                <div className="ym15-alloc-rows">
                  {data.allocations.map((item) => (
                    <div key={item.id} className="ym15-alloc-row">
                      <div className="ym15-grower-cell">
                        <GrowerAvatar name={item.growerName} />
                        <div>
                          <div className="ym15-grower-name">{item.growerName}</div>
                          <div className="ym15-grower-meta">Batch: {item.batchCode}</div>
                          <div className="ym15-grower-meta">
                            {item.distanceKm !== null ? `${item.distanceKm} km away` : 'Distance unavailable'}
                          </div>
                        </div>
                      </div>

                      <div className="ym15-qty-price-cell">
                        <div className="ym15-alloc-kg">{item.allocatedKg.toLocaleString()} kg</div>
                        <div className="ym15-alloc-price">LKR {item.unitPriceLkr.toLocaleString()}/kg</div>
                      </div>

                      <div className="ym15-alloc-total-cell">
                        LKR {item.allocationTotalLkr.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ym15-alloc-footer">
                  <div>
                    <div className="ym15-footer-caption">Total quantity</div>
                    <div className="ym15-footer-big">{data.matchedKg.toLocaleString()} kg</div>
                  </div>
                  <div className="ym15-text-right">
                    <div className="ym15-footer-caption">Total allocation</div>
                    <div className="ym15-footer-big">LKR {data.goodsTotalLkr.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </ContentCard>

          {data.alternatives.length > 0 && (
            <ContentCard title="Alternative growers">
              {data.alternatives.map((alt) => (
                <div key={alt.id} className="ym15-alt-row">
                  <div className="ym15-alt-left">
                    <div className="ym15-alt-cols-head">
                      <span>Grower</span>
                      <span>Available</span>
                      <span>Price</span>
                    </div>
                    <div className="ym15-alt-cols-val">
                      <span className="ym15-alt-grower-name">{alt.growerName}</span>
                      <span className="ym15-alt-badge">{alt.statusLabel}</span>
                      <span>{alt.availableKg.toLocaleString()} kg</span>
                      <span>LKR {alt.unitPriceLkr.toLocaleString()}/kg</span>
                    </div>
                  </div>
                  <p className="ym15-alt-reason">{alt.reasonText}</p>
                </div>
              ))}
            </ContentCard>
          )}
        </div>

        <aside className="ym15-side-column">
          <ContentCard title="Why these growers were matched">
            <div className="ym15-method-pill-row">
              <span className="ym15-method-pill">
                <GearIcon />
                <span>{data.methodLabel}</span>
              </span>
            </div>

            <p className="ym15-method-note">
              Eligible listings are ranked by unit price, then known pickup distance, and finally by stable listing ID.
            </p>

            {data.allocations.length === 0 ? (
              <p className="ym15-method-note">No ranked grower listings to display.</p>
            ) : (
              <div className="ym15-rank-list">
                {data.allocations.map((item) => (
                  <div key={item.id} className="ym15-rank-item">
                    <GrowerAvatar name={item.growerName} />
                    <div className="ym15-rank-body">
                      <div className="ym15-rank-title">
                        {item.growerName} - Rank {item.rank}
                      </div>
                      <p className="ym15-rank-desc">
                        {item.crop} and {item.grade} match. {item.availableKg.toLocaleString()} kg available at LKR{' '}
                        {item.unitPriceLkr.toLocaleString()}/kg.
                      </p>
                      <div className="ym15-rank-sub">
                        {item.distanceKm !== null ? `${item.distanceKm} km away · ` : ''}
                        {item.ruleTag}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>

          <Alert type="info">
            Matching results are recommendations. Stock is not reserved at this stage.
          </Alert>
        </aside>
      </div>

      <div className="ym15-results-actions">
        <Button type="button" variant="outline" onClick={onBackToRequest}>
          ← Back to request
        </Button>
        <Button type="button" variant="primary" className="ym15-submit-btn" onClick={onViewAllocationBreakdown}>
          View allocation breakdown →
        </Button>
      </div>
    </div>
  );
}