import React, { useMemo, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { ProduceListingDetailView } from '../../types/produce';
import { formatDisplayDateTimeColombo } from '../../utils/produceFormatters';
import {
  TIMEFRAME_OPTIONS,
  TimeframeFilter,
  calculatePriceChartGeometry,
  computeTooltipLayout,
  formatLkrAmount,
  getTimeframeDescription,
  preparePriceChartData,
} from '../../utils/priceChartUtils';

interface PriceHistoryTabProps {
  listing: ProduceListingDetailView;
  initialTimeFilter?: TimeframeFilter;
  referenceDate?: Date;
}

export const PriceHistoryTab: React.FC<PriceHistoryTabProps> = ({
  listing,
  initialTimeFilter = 'all',
  referenceDate,
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeframeFilter>(initialTimeFilter);
  const [activePointId, setActivePointId] = useState<string | null>(null);

  const prepared = useMemo(
    () =>
      preparePriceChartData({
        priceTrend: listing.priceTrend,
        priceHistory: listing.priceHistory,
        timeframe: timeFilter,
        referenceDate,
      }),
    [listing.priceTrend, listing.priceHistory, timeFilter, referenceDate]
  );

  const geometry = useMemo(
    () => calculatePriceChartGeometry(prepared.points),
    [prepared.points]
  );

  const highlightedPoint = useMemo(() => {
    if (geometry.points.length === 0) {
      return null;
    }
    if (activePointId) {
      const matched = geometry.points.find((pt) => pt.point.id === activePointId);
      if (matched) {
        return matched;
      }
    }
    return geometry.lastPoint;
  }, [geometry.points, geometry.lastPoint, activePointId]);

  const tooltip = useMemo(
    () => (highlightedPoint ? computeTooltipLayout(highlightedPoint, geometry) : null),
    [highlightedPoint, geometry]
  );

  const hasOverallChartData = prepared.totalValidChartSourceCount > 0;
  const hasOverallHistoryData = prepared.totalValidHistoryCount > 0;
  const timeframeDesc = getTimeframeDescription(timeFilter);

  const handleTimeframeChange = (nextFilter: TimeframeFilter) => {
    setTimeFilter(nextFilter);
    setActivePointId(null);
  };

  return (
    <div className="ym09-price-history-layout" data-testid="price-history-tab">
      {/* Left Column: Price History Chart */}
      <section className="ym09-details-card" aria-labelledby="price-trend-title">
        <header className="ym09-details-card-header">
          <div>
            <h3 id="price-trend-title" className="ym09-details-card-title">
              <TrendingUp size={20} aria-hidden="true" />
              Price History
            </h3>
            <p className="ym09-details-card-subtitle">
              Track price changes over time ({timeframeDesc}).
            </p>
          </div>

          <div
            className="ym09-timeframe-group"
            role="group"
            aria-label="Filter price history timeframe"
            data-testid="price-history-timeframe-filter"
          >
            {TIMEFRAME_OPTIONS.map((option) => {
              const isActive = timeFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`ym09-timeframe-btn ${
                    isActive ? 'ym09-timeframe-btn--active' : ''
                  }`}
                  aria-pressed={isActive}
                  data-timeframe={option.value}
                  onClick={() => handleTimeframeChange(option.value)}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
        </header>

        {geometry.points.length === 0 ? (
          <div className="ym09-chart-empty" role="status" data-testid="price-chart-empty">
            <div className="ym09-chart-empty-icon" aria-hidden="true">
              <TrendingUp size={20} aria-hidden="true" />
            </div>
            <p className="ym09-chart-empty-title">
              {hasOverallChartData
                ? `No price records in the ${timeframeDesc}`
                : 'No price history available'}
            </p>
            <p className="ym09-chart-empty-text">
              {hasOverallChartData
                ? 'Try selecting a wider timeframe to inspect earlier recorded prices for this listing.'
                : 'Price trend points will appear here once valid price records are logged for this listing.'}
            </p>
            {hasOverallChartData && timeFilter !== 'all' && (
              <button
                type="button"
                className="ym09-chart-reset-btn"
                onClick={() => handleTimeframeChange('all')}
              >
                Show All Time
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="ym09-chart-container">
              <svg
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                className="ym09-price-chart-svg"
                role="img"
                aria-label={`Price history chart showing ${geometry.points.length} ${
                  geometry.points.length === 1 ? 'point' : 'points'
                } for ${timeframeDesc}`}
                onMouseLeave={() => setActivePointId(null)}
              >
                <defs>
                  <linearGradient id="ym09-price-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#315A42" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#315A42" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines and Y-Axis Labels */}
                {geometry.gridSteps.map((step) => (
                  <g key={step.valueLkr}>
                    <line
                      x1={geometry.paddingLeft}
                      y1={step.y}
                      x2={geometry.width - geometry.paddingRight}
                      y2={step.y}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={geometry.paddingLeft - 8}
                      y={step.y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="var(--muted)"
                      fontFamily="Inter, sans-serif"
                    >
                      {step.label}
                    </text>
                  </g>
                ))}

                {/* Area Fill & Trend Line (rendered only when 2+ valid points exist) */}
                {geometry.areaPathD && (
                  <path d={geometry.areaPathD} fill="url(#ym09-price-gradient)" />
                )}

                {geometry.linePathD && (
                  <path
                    d={geometry.linePathD}
                    fill="none"
                    stroke="#315A42"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points */}
                {geometry.points.map((pt) => {
                  const isHighlighted = highlightedPoint?.point.id === pt.point.id;
                  return (
                    <g
                      key={pt.point.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`${pt.point.fullDateLabel}: ${pt.formattedRate}`}
                      style={{ cursor: 'pointer', outline: 'none' }}
                      onMouseEnter={() => setActivePointId(pt.point.id)}
                      onFocus={() => setActivePointId(pt.point.id)}
                      onClick={() => setActivePointId(pt.point.id)}
                    >
                      <title>{`${pt.point.fullDateLabel}: ${pt.formattedRate}`}</title>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHighlighted ? 5.5 : 3.5}
                        fill={isHighlighted ? '#E7A06C' : '#315A42'}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      {pt.showAxisLabel && (
                        <text
                          x={pt.x}
                          y={geometry.height - 12}
                          textAnchor="middle"
                          fontSize="11"
                          fill="var(--muted)"
                          fontFamily="Inter, sans-serif"
                        >
                          {pt.point.dateLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Dynamic Bounded Callout Tooltip */}
                {tooltip && (
                  <g
                    transform={`translate(${tooltip.x}, ${tooltip.y})`}
                    pointerEvents="none"
                    data-testid="price-chart-tooltip"
                  >
                    <rect
                      width={tooltip.width}
                      height={tooltip.height}
                      rx="6"
                      fill="var(--surface)"
                      stroke="var(--border)"
                      strokeWidth="1"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                    />
                    <text
                      x={tooltip.centerX}
                      y="15"
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--muted)"
                      fontFamily="Inter, sans-serif"
                    >
                      {tooltip.dateText}
                    </text>
                    <text
                      x={tooltip.centerX}
                      y="29"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="var(--text)"
                      fontFamily="Inter, sans-serif"
                    >
                      {tooltip.priceText}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {geometry.points.length === 1 && (
              <p className="ym09-chart-single-note" role="note" data-testid="price-chart-single-note">
                Only 1 valid price point recorded in this timeframe — at least 2 points are needed to plot a trend line.
              </p>
            )}
          </>
        )}
      </section>

      {/* Right Column: Price Change History Table */}
      <section className="ym09-details-card" aria-labelledby="price-changes-title">
        <header className="ym09-details-card-header">
          <div>
            <h3 id="price-changes-title" className="ym09-details-card-title">
              <Clock size={20} aria-hidden="true" />
              Price Change History
            </h3>
            <p className="ym09-details-card-subtitle">
              {prepared.filteredHistory.length}{' '}
              {prepared.filteredHistory.length === 1 ? 'record' : 'records'} ({timeframeDesc})
            </p>
          </div>
        </header>

        <div className="ym-table-scroll">
          <table className="ym-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Price per kg</th>
                <th style={{ textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {prepared.filteredHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}
                  >
                    {hasOverallHistoryData
                      ? `No price changes recorded in the ${timeframeDesc}.`
                      : 'No price changes recorded for this listing.'}
                  </td>
                </tr>
              ) : (
                prepared.filteredHistory.map((item) => {
                  const deltaCents = item.deltaCents ?? 0;
                  const hasDelta = Number.isFinite(deltaCents) && deltaCents !== 0;
                  const isPositive = deltaCents > 0;

                  return (
                    <tr key={item.id} className="ym-table-row">
                      <td style={{ fontSize: '13px', color: 'var(--text)' }}>
                        {formatDisplayDateTimeColombo(item.timestamp)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatLkrAmount(item.unitPriceCents)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {!hasDelta ? (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        ) : isPositive ? (
                          <span
                            style={{
                              color: '#16a34a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            ▲ {formatLkrAmount(deltaCents)}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: '#b42318',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            ▼ {formatLkrAmount(Math.abs(deltaCents))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
