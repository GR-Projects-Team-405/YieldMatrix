import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import type { BulkMatchResponseData } from './types';
import './ym15.css';

interface PartialMatchShortagePageProps {
  data: BulkMatchResponseData;
  onBackToRequest: () => void;
  onAcceptPartialPlan: () => void;
}

const SLICE_COLORS = ['#315a42', '#e7a06c', '#98c2a6', '#5e8c70', '#d48752'];
const SHORTAGE_COLOR = '#2f5d8a';

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" strokeLinejoin="round" />
      <path d="M14 3v6h6" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" strokeLinecap="round" />
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

function ShortageBagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 7h12l-1 13H7L6 7Z" strokeLinejoin="round" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
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

function CheckMarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GrowerBadge({ name, index }: { name: string; index: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const color = SLICE_COLORS[index % SLICE_COLORS.length];

  return (
    <span
      className="ym15-grower-avatar ym15-grower-avatar--tinted"
      style={{ backgroundColor: `${color}22`, color }}
      aria-hidden="true"
    >
      {initials || 'YM'}
    </span>
  );
}

interface PieSegment {
  key: string;
  label: string;
  kg: number;
  percent: number;
  color: string;
  isShortage?: boolean;
}

function FulfilmentPieChart({ segments }: { segments: PieSegment[] }) {
  const totalKg = segments.reduce((sum, s) => sum + Math.max(0, s.kg), 0);
  const cx = 56;
  const cy = 56;
  const r = 46;

  let cumulativeAngle = -Math.PI / 2;

  const slices = segments
    .filter((s) => s.kg > 0 && totalKg > 0)
    .map((seg) => {
      const fraction = seg.kg / totalKg;
      const startAngle = cumulativeAngle;
      const endAngle = startAngle + fraction * Math.PI * 2;
      cumulativeAngle = endAngle;

      if (fraction >= 0.9999) {
        return {
          ...seg,
          fullCircle: true,
          pathData: '',
        };
      }

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArcFlag = fraction > 0.5 ? 1 : 0;

      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1.toFixed(3)} ${y1.toFixed(3)}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
        'Z',
      ].join(' ');

      return {
        ...seg,
        fullCircle: false,
        pathData,
      };
    });

  return (
    <svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      className="ym15-pie-svg"
      role="img"
      aria-label="Order fulfilment breakdown chart"
    >
      {slices.map((slice) =>
        slice.fullCircle ? (
          <circle
            key={slice.key}
            cx={cx}
            cy={cy}
            r={r}
            fill={slice.color}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ) : (
          <path
            key={slice.key}
            d={slice.pathData}
            fill={slice.color}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )
      )}
    </svg>
  );
}

export function PartialMatchShortagePage({
  data,
  onBackToRequest,
  onAcceptPartialPlan,
}: PartialMatchShortagePageProps) {
  const requestedKg = Math.max(0, Number(data.requestedKg || 0));
  const matchedKg = Math.max(0, Number(data.matchedKg || 0));
  const shortageKg = Math.max(0, Number(data.shortageKg ?? Math.max(0, requestedKg - matchedKg)));

  const matchedPercent =
    requestedKg > 0 ? Math.min(100, Math.round((matchedKg / requestedKg) * 100)) : 0;
  const shortagePercent =
    requestedKg > 0 ? Math.max(0, 100 - matchedPercent) : 0;

  const cropLabel = data.allocations[0]?.crop ?? data.crop ?? 'Produce';
  const gradeLabel = data.allocations[0]?.grade ?? data.grade ?? '';

  const requestBadgeText = data.requestId
    ? `REQUEST ID: ${data.requestId.slice(0, 12).toUpperCase()}`
    : 'REQUEST ID: YM15-PARTIAL';

  const chartSegments: PieSegment[] = [
    ...data.allocations.map((item, idx) => {
      const pct = requestedKg > 0 ? Math.round((item.allocatedKg / requestedKg) * 100) : 0;
      return {
        key: item.id,
        label: item.growerName,
        kg: item.allocatedKg,
        percent: pct,
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
      };
    }),
    ...(shortageKg > 0
      ? [
          {
            key: 'shortage',
            label: 'Shortage',
            kg: shortageKg,
            percent: shortagePercent,
            color: SHORTAGE_COLOR,
            isShortage: true,
          },
        ]
      : []),
  ];

  const primaryAlternative = data.alternatives[0] ?? null;
  const hasOverBudgetAlt = data.alternatives.some((a) => a.statusLabel === 'Over Budget');

  const alternativeNoteText = primaryAlternative
    ? primaryAlternative.reasonText
    : shortageKg > 0
      ? 'No additional eligible grower listings were available to cover the remaining shortage within current constraints.'
      : 'No additional eligible grower listings remained unselected for this request.';

  return (
    <div className="ym15-page">
      <div className="ym15-results-topbar">
        <div>
          <h2 className="ym15-results-title">Partial match &amp; shortage results</h2>
          <p className="ym15-lead-copy">
            {shortageKg > 0
              ? `We found suitable growers, but ${shortageKg.toLocaleString()} kg of your requested quantity is still unavailable.`
              : `Your ${requestedKg.toLocaleString()} kg request matched across ${data.growerCount} eligible grower listing(s).`}
          </p>
        </div>
        <div className="ym15-header-badges">
          <span className="ym15-request-id-pill">{requestBadgeText}</span>
          <StatusBadge status="PENDING" />
        </div>
      </div>

      {data.partialBlocked && shortageKg > 0 && (
        <Alert type="warning">
          Partial fulfilment was set to <strong>No</strong> on your request, so {shortageKg.toLocaleString()} kg remains unmatched. You can go back to adjust your request or accept this partial allocation plan below.
        </Alert>
      )}

      <div className="ym15-kpi-grid">
        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <DocIcon />
          </span>
          <StatCard
            label="REQUESTED QUANTITY"
            value={`${requestedKg.toLocaleString()} kg`}
            subtext="Original request"
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge ym15-kpi-icon-badge--success" aria-hidden="true">
            <CheckCircleIcon />
          </span>
          <StatCard
            label="MATCHED QUANTITY"
            value={`${matchedKg.toLocaleString()} kg`}
            subtext={`${matchedPercent}% fulfilled`}
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge ym15-kpi-icon-badge--shortage" aria-hidden="true">
            <ShortageBagIcon />
          </span>
          <StatCard
            label="QUANTITY SHORTAGE"
            value={`${shortageKg.toLocaleString()} kg`}
            subtext={`${shortagePercent}% unavailable`}
          />
        </div>

        <div className="ym15-kpi-card-wrap">
          <span className="ym15-kpi-icon-badge" aria-hidden="true">
            <WalletIcon />
          </span>
          <StatCard
            label="GOODS TOTAL"
            value={`LKR ${data.goodsTotalLkr.toLocaleString()}`}
            subtext={`For matched ${matchedKg.toLocaleString()} kg`}
          />
        </div>
      </div>

      <div className="ym15-partial-main-grid">
        <div className="ym15-results-left-col">
          <ContentCard title="Detailed grower allocation">
            {data.allocations.length === 0 ? (
              <Alert type="warning">
                No eligible grower allocations matched your request criteria.
              </Alert>
            ) : (
              <div className="ym15-partial-table-wrap">
                <div className="ym15-partial-table-head">
                  <span>Grower details</span>
                  <span className="ym15-text-center">QUANTITY / PRICE</span>
                  <span className="ym15-text-right">ALLOCATION TOTAL</span>
                  <span className="ym15-text-right">STATUS</span>
                </div>

                <div className="ym15-partial-table-body">
                  {data.allocations.map((item, idx) => {
                    const rowTotal = Number((item.allocatedKg * item.unitPriceLkr).toFixed(2));
                    const displayTotal = item.allocationTotalLkr || rowTotal;

                    return (
                      <div key={item.id} className="ym15-partial-table-row">
                        <div className="ym15-grower-cell">
                          <GrowerBadge name={item.growerName} index={idx} />
                          <div>
                            <div className="ym15-grower-name">{item.growerName}</div>
                            <div className="ym15-grower-meta">
                              {item.batchCode}
                              {item.distanceKm !== null ? ` • ${item.distanceKm} km away` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="ym15-qty-price-cell">
                          <div className="ym15-alloc-kg">{item.allocatedKg.toLocaleString()} kg</div>
                          <div className="ym15-alloc-price">LKR {item.unitPriceLkr.toLocaleString()}/kg</div>
                        </div>

                        <div className="ym15-alloc-total-cell">
                          LKR {displayTotal.toLocaleString()}
                        </div>

                        <div className="ym15-partial-status-cell">
                          <span className="ym15-selected-pill">Selected</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="ym15-partial-table-footer">
                  <div>
                    <div className="ym15-footer-caption">Total matched quantity</div>
                    <div className="ym15-footer-big">{matchedKg.toLocaleString()} kg</div>
                  </div>
                  <div className="ym15-text-right">
                    <div className="ym15-footer-caption">Total goods value</div>
                    <div className="ym15-footer-big">LKR {data.goodsTotalLkr.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </ContentCard>

          <ContentCard>
            <div className="ym15-partial-alt-layout">
              <div className="ym15-partial-alt-table-col">
                <h3 className="ym15-subcard-heading">Other available alternatives</h3>

                {data.alternatives.length > 0 ? (
                  <div className="ym15-partial-alt-grid">
                    <div className="ym15-partial-alt-head">
                      <span>Grower</span>
                      <span>Crop</span>
                      <span>Grade</span>
                      <span>Available</span>
                      <span>Unit Price</span>
                      <span>Distance</span>
                    </div>
                    {data.alternatives.map((alt) => (
                      <div key={alt.id} className="ym15-partial-alt-row">
                        <span className="ym15-alt-grower-name">{alt.growerName}</span>
                        <span>{alt.crop ?? cropLabel}</span>
                        <span>{alt.grade ?? gradeLabel}</span>
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

              <div className="ym15-partial-alt-note-col">
                <span className="ym15-alt-info-icon" aria-hidden="true">
                  <InfoIcon />
                </span>
                <p className="ym15-alt-breakdown-note">{alternativeNoteText}</p>
              </div>
            </div>
          </ContentCard>
        </div>

        <aside className="ym15-side-column">
          <ContentCard title="Your order fulfilment">
            <div className="ym15-pie-layout">
              <FulfilmentPieChart segments={chartSegments} />

              <div className="ym15-pie-legend">
                {chartSegments.map((seg) => (
                  <div key={seg.key} className="ym15-pie-legend-item">
                    <span
                      className="ym15-legend-dot"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="ym15-pie-legend-text">
                      <strong>{seg.label}</strong> • {seg.kg.toLocaleString()} kg • {seg.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ym15-fulfilment-summary">
              <div className="ym15-fulfilment-row">
                <span>Matched quantity</span>
                <strong>{matchedKg.toLocaleString()} kg</strong>
              </div>
              <div className="ym15-fulfilment-row">
                <span>Remaining shortage</span>
                <strong>{shortageKg.toLocaleString()} kg</strong>
              </div>
            </div>
          </ContentCard>

          <ContentCard title="Why is your order partially matched?">
            <div className="ym15-why-metrics">
              <div className="ym15-why-metric-row">
                <span>Original request</span>
                <strong>{requestedKg.toLocaleString()} kg</strong>
              </div>
              <div className="ym15-why-metric-row">
                <span>Eligible supply</span>
                <strong>{matchedKg.toLocaleString()} kg</strong>
              </div>
              <div className="ym15-why-metric-row">
                <span>Unavailable quantity</span>
                <strong>{shortageKg.toLocaleString()} kg</strong>
              </div>
            </div>

            <ul className="ym15-decision-list">
              <li className="ym15-decision-item">
                <span className="ym15-decision-icon" aria-hidden="true">
                  <CheckMarkIcon />
                </span>
                <span>
                  Selected growers meet the {cropLabel} and {gradeLabel} requirements.
                </span>
              </li>
              <li className="ym15-decision-item">
                <span className="ym15-decision-icon" aria-hidden="true">
                  <CheckMarkIcon />
                </span>
                <span>
                  Current allocations cover {matchedPercent}% of the requested quantity.
                </span>
              </li>
              <li className="ym15-decision-item">
                <span className="ym15-decision-icon" aria-hidden="true">
                  <CheckMarkIcon />
                </span>
                <span>
                  {hasOverBudgetAlt && data.maxBudgetLkr !== null
                    ? `Remaining supply would exceed the LKR ${data.maxBudgetLkr.toLocaleString()} budget cap or no extra approved stock was available.`
                    : `No additional approved active supply remained for the remaining ${shortageKg.toLocaleString()} kg shortage.`}
                </span>
              </li>
            </ul>

            <div className="ym15-method-callout">
              <span className="ym15-method-callout-icon" aria-hidden="true">
                <InfoIcon />
              </span>
              <div>
                <div className="ym15-method-callout-title">Allocation method: Rule-based</div>
                <p className="ym15-method-callout-sub">
                  Recommendations consider crop, grade, quantity, unit price, known distance and delivery eligibility.
                </p>
              </div>
            </div>
          </ContentCard>
        </aside>
      </div>

      <div className="ym15-results-actions">
        <Button type="button" variant="outline" onClick={onBackToRequest}>
          ← Back to request
        </Button>
        <Button
          type="button"
          variant="primary"
          className="ym15-submit-btn"
          onClick={onAcceptPartialPlan}
          disabled={data.allocations.length === 0}
        >
          Accept partial plan →
        </Button>
      </div>
    </div>
  );
}