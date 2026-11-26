// YM29 · Yasindu Janapriya · Lightweight accessible SVG dual-line chart (Forecast vs 7-Day Baseline).

import { formatColomboDate, formatKg, formatVariance } from '../formatters';
import type { ForecastSeriesPoint } from '../types';

export interface DemandForecastChartProps {
  series: ForecastSeriesPoint[];
  peakDay: ForecastSeriesPoint | null;
  cropName: string;
  district: string;
  compact?: boolean;
}

export function DemandForecastChart({
  series,
  peakDay,
  cropName,
  district,
  compact = false,
}: DemandForecastChartProps) {
  const validPoints = series.filter((pt) => pt.predicted_kg !== null);
  if (validPoints.length === 0) return null;

  const width = 640;
  const height = compact ? 230 : 270;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 30;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = validPoints.flatMap((pt) =>
    [pt.predicted_kg, pt.baseline_kg].filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  const rawMax = Math.max(...allValues, 100);
  const rawMin = Math.min(...allValues, 0);
  const minVal = Math.max(0, Math.floor((rawMin * 0.85) / 50) * 50);
  const maxVal = Math.ceil((rawMax * 1.12) / 50) * 50;
  const range = Math.max(maxVal - minVal, 1);

  const xAt = (index: number) =>
    validPoints.length === 1 ? padLeft + plotW / 2 : padLeft + (index / (validPoints.length - 1)) * plotW;
  const yAt = (val: number) => padTop + plotH - ((val - minVal) / range) * plotH;

  const predictedCoords = validPoints.map((pt, i) => ({ x: xAt(i), y: yAt(pt.predicted_kg ?? 0), pt }));
  const baselineCoords = validPoints
    .map((pt, i) => (pt.baseline_kg !== null ? { x: xAt(i), y: yAt(pt.baseline_kg), pt } : null))
    .filter((item): item is { x: number; y: number; pt: ForecastSeriesPoint } => item !== null);

  const linePath = (coords: { x: number; y: number }[]) =>
    coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  const areaPath =
    predictedCoords.length > 1
      ? `${linePath(predictedCoords)} L ${predictedCoords[predictedCoords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${predictedCoords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.33, 0.66, 1].map((t) => Math.round(minVal + t * range));
  const peakPoint = peakDay ? predictedCoords.find((c) => c.pt.date === peakDay.date) || null : null;

  return (
    <div>
      <div className="ym29-chart-wrap">
        <svg
          className="ym29-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`7-day demand forecast chart for ${cropName} in ${district}`}
        >
          <defs>
            <linearGradient id="ym29AreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#315A42" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#315A42" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                  {tick.toLocaleString('en-US')}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#ym29AreaGrad)" />}

          {baselineCoords.length > 1 && (
            <path
              d={linePath(baselineCoords)}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}

          <path d={linePath(predictedCoords)} fill="none" stroke="#315A42" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {predictedCoords.map(({ x, y, pt }) => {
            const isPeak = peakPoint && peakPoint.pt.date === pt.date;
            return (
              <g key={pt.date}>
                <circle
                  cx={x}
                  cy={y}
                  r={isPeak ? 6 : 4}
                  fill={isPeak ? '#E7A06C' : '#315A42'}
                  stroke="var(--surface)"
                  strokeWidth="2"
                >
                  <title>{`${formatColomboDate(pt.date, true)}: ${formatKg(pt.predicted_kg)} (Baseline: ${formatKg(pt.baseline_kg)})`}</title>
                </circle>
                <text
                  x={x}
                  y={height - 14}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isPeak ? '700' : '400'}
                  fill={isPeak ? 'var(--accent-text)' : 'var(--muted)'}
                >
                  {formatColomboDate(pt.date, true)}
                </text>
              </g>
            );
          })}

          {peakPoint && peakDay && (
            <g>
              <rect
                x={Math.min(Math.max(peakPoint.x - 86, padLeft), width - padRight - 172)}
                y={Math.max(peakPoint.y - 34, 4)}
                width="172"
                height="24"
                rx="6"
                fill="#263A31"
              />
              <text
                x={Math.min(Math.max(peakPoint.x - 86, padLeft), width - padRight - 172) + 86}
                y={Math.max(peakPoint.y - 34, 4) + 16}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#ffffff"
              >
                Peak: {formatKg(peakDay.predicted_kg)} ({formatVariance(peakDay.variance_pct)})
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="ym29-chart-legend">
        <span>
          <span className="ym29-legend-dot" style={{ background: '#315A42' }} />
          Projected demand (kg)
        </span>
        <span>
          <span className="ym29-legend-dot" style={{ background: 'var(--muted)' }} />
          7-day weekday baseline (kg)
        </span>
        <span>
          <span className="ym29-legend-dot" style={{ background: '#E7A06C', height: 8, width: 8, borderRadius: '50%' }} />
          Peak demand day
        </span>
      </div>
    </div>
  );
}
