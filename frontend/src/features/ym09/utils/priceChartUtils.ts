import type { PriceChangeRecord, PriceTrendPoint } from '../types/produce';
import { formatDisplayDateColombo } from './produceFormatters';

export type TimeframeFilter = '7d' | '30d' | 'all';

export interface TimeframeOption {
  value: TimeframeFilter;
  label: string;
  shortLabel: string;
}

export const TIMEFRAME_OPTIONS: readonly TimeframeOption[] = [
  { value: '7d', label: 'Last 7 days', shortLabel: '7 Days' },
  { value: '30d', label: 'Last 30 days', shortLabel: '30 Days' },
  { value: 'all', label: 'All time', shortLabel: 'All Time' },
];

export interface ValidPricePoint {
  id: string;
  timestamp: string;
  timestampMs: number;
  unitPriceCents: number;
  priceLkr: number;
  dateLabel: string;
  fullDateLabel: string;
  previousUnitPriceCents?: number;
  deltaCents?: number;
}

export interface PreparedPriceChartData {
  source: 'trend' | 'history' | 'none';
  points: ValidPricePoint[];
  filteredHistory: Array<PriceChangeRecord & { timestampMs: number }>;
  totalValidHistoryCount: number;
  totalValidChartSourceCount: number;
}

export interface PriceChartGridStep {
  valueLkr: number;
  label: string;
  y: number;
}

export interface PriceChartPoint {
  x: number;
  y: number;
  point: ValidPricePoint;
  priceLkr: number;
  formattedRate: string;
  showAxisLabel: boolean;
}

export interface PriceChartDimensions {
  width?: number;
  height?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

export interface PriceChartGeometry {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  innerWidth: number;
  innerHeight: number;
  baselineY: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  gridSteps: PriceChartGridStep[];
  points: PriceChartPoint[];
  linePathD: string;
  areaPathD: string;
  lastPoint: PriceChartPoint | null;
}

export interface PriceTooltipLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  dateText: string;
  priceText: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parses an ISO or RFC date string into finite epoch milliseconds, or returns null.
 */
export function parseValidTimestampMs(timestamp?: string | null): number | null {
  if (!timestamp || typeof timestamp !== 'string') {
    return null;
  }
  const trimmed = timestamp.trim();
  if (!trimmed) {
    return null;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Returns true if the supplied price in cents is a valid positive finite number.
 */
export function isValidUnitPriceCents(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isFinite(cents) && cents > 0;
}

export function isValidPriceChangeRecord(
  record?: Partial<PriceChangeRecord> | null
): record is PriceChangeRecord {
  return Boolean(
    record &&
      parseValidTimestampMs(record.timestamp) !== null &&
      isValidUnitPriceCents(record.unitPriceCents)
  );
}

export function isValidPriceTrendPoint(
  point?: Partial<PriceTrendPoint> | null
): point is PriceTrendPoint {
  return Boolean(
    point &&
      parseValidTimestampMs(point.timestamp) !== null &&
      isValidUnitPriceCents(point.unitPriceCents)
  );
}

/**
 * Returns the inclusive lower-bound epoch timestamp for a timeframe filter, or null for 'all'.
 */
export function getTimeframeCutoffMs(
  timeframe: TimeframeFilter,
  referenceDate: Date = new Date()
): number | null {
  if (timeframe === 'all') {
    return null;
  }
  const refMs = Number.isFinite(referenceDate.getTime())
    ? referenceDate.getTime()
    : Date.now();
  const days = timeframe === '7d' ? 7 : 30;
  return refMs - days * DAY_MS;
}

/**
 * Formats an amount in cents to LKR string without rounding away fractional values.
 */
export function formatLkrAmount(cents: number): string {
  const lkr = cents / 100;
  const formatted = Number.isInteger(lkr)
    ? lkr.toLocaleString('en-US')
    : lkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `LKR ${formatted}`;
}

/**
 * Formats a Colombo price rate cleanly without misleading rounding of fractional LKR values.
 */
export function formatCompactLkrRate(unitPriceCents: number): string {
  return `${formatLkrAmount(unitPriceCents)} / kg`;
}

/**
 * Builds an axis-friendly short date label from a Colombo-formatted date string ("05 Nov 2026").
 */
function buildShortAxisLabel(fullDateLabel: string, includeYearSuffix: boolean): string {
  const parts = fullDateLabel.trim().split(/\s+/);
  if (parts.length < 3) {
    return fullDateLabel;
  }
  const [day, month, year] = parts;
  return includeYearSuffix ? `${day} ${month} '${year.slice(-2)}` : `${day} ${month}`;
}

function extractColomboYear(fullDateLabel: string): string {
  const match = fullDateLabel.match(/\b(\d{4})\b/);
  return match ? match[1] : '';
}

/**
 * Filters valid price history records to the selected timeframe, sorted newest-first for table display.
 */
export function filterPriceHistoryByTimeframe(
  priceHistory: readonly PriceChangeRecord[] | undefined | null,
  timeframe: TimeframeFilter,
  referenceDate: Date = new Date()
): Array<PriceChangeRecord & { timestampMs: number }> {
  if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
    return [];
  }

  const cutoffMs = getTimeframeCutoffMs(timeframe, referenceDate);
  const validWithMs: Array<PriceChangeRecord & { timestampMs: number }> = [];

  for (const record of priceHistory) {
    if (!isValidPriceChangeRecord(record)) {
      continue;
    }
    const timestampMs = parseValidTimestampMs(record.timestamp)!;
    if (cutoffMs !== null && timestampMs < cutoffMs) {
      continue;
    }
    validWithMs.push({
      ...record,
      timestampMs,
    });
  }

  validWithMs.sort((a, b) => b.timestampMs - a.timestampMs);
  return validWithMs;
}

/**
 * Filters valid price trend points to the selected timeframe, sorted oldest-first for plotting.
 */
export function filterPriceTrendByTimeframe(
  priceTrend: readonly PriceTrendPoint[] | undefined | null,
  timeframe: TimeframeFilter,
  referenceDate: Date = new Date()
): Array<PriceTrendPoint & { timestampMs: number }> {
  if (!Array.isArray(priceTrend) || priceTrend.length === 0) {
    return [];
  }

  const cutoffMs = getTimeframeCutoffMs(timeframe, referenceDate);
  const validWithMs: Array<PriceTrendPoint & { timestampMs: number }> = [];

  for (const point of priceTrend) {
    if (!isValidPriceTrendPoint(point)) {
      continue;
    }
    const timestampMs = parseValidTimestampMs(point.timestamp)!;
    if (cutoffMs !== null && timestampMs < cutoffMs) {
      continue;
    }
    validWithMs.push({
      ...point,
      timestampMs,
    });
  }

  validWithMs.sort((a, b) => a.timestampMs - b.timestampMs);
  return validWithMs;
}

/**
 * Prepares chronologically ordered, validated chart points and matching history records
 * without fabricating synthetic fallback entries when data is absent.
 */
export function preparePriceChartData(params: {
  priceTrend?: readonly PriceTrendPoint[] | null;
  priceHistory?: readonly PriceChangeRecord[] | null;
  timeframe: TimeframeFilter;
  referenceDate?: Date;
}): PreparedPriceChartData {
  const { priceTrend, priceHistory, timeframe, referenceDate = new Date() } = params;

  const allValidTrend = filterPriceTrendByTimeframe(priceTrend, 'all', referenceDate);
  const allValidHistory = filterPriceHistoryByTimeframe(priceHistory, 'all', referenceDate);

  const filteredHistory = filterPriceHistoryByTimeframe(priceHistory, timeframe, referenceDate);

  const hasValidTrendSource = allValidTrend.length > 0;
  let rawChartEntries: Array<{
    id: string;
    timestamp: string;
    timestampMs: number;
    unitPriceCents: number;
    previousUnitPriceCents?: number;
    deltaCents?: number;
  }> = [];

  let source: PreparedPriceChartData['source'] = 'none';

  if (hasValidTrendSource) {
    source = 'trend';
    const filteredTrend = filterPriceTrendByTimeframe(priceTrend, timeframe, referenceDate);
    rawChartEntries = filteredTrend.map((point, index) => ({
      id: `trend-${index}-${point.timestampMs}`,
      timestamp: point.timestamp,
      timestampMs: point.timestampMs,
      unitPriceCents: point.unitPriceCents,
    }));
  } else if (allValidHistory.length > 0) {
    source = 'history';
    rawChartEntries = [...filteredHistory]
      .sort((a, b) => a.timestampMs - b.timestampMs)
      .map((record) => ({
        id: record.id,
        timestamp: record.timestamp,
        timestampMs: record.timestampMs,
        unitPriceCents: record.unitPriceCents,
        previousUnitPriceCents: record.previousUnitPriceCents,
        deltaCents: record.deltaCents,
      }));
  }

  const withFormattedFull = rawChartEntries.map((entry) => {
    const formatted = formatDisplayDateColombo(entry.timestamp);
    const fullDateLabel = formatted !== '—' ? formatted : entry.timestamp;
    return {
      ...entry,
      fullDateLabel,
      year: extractColomboYear(fullDateLabel),
    };
  });

  const distinctYears = new Set(withFormattedFull.map((e) => e.year).filter(Boolean));
  const includeYearSuffix = distinctYears.size > 1;

  const points: ValidPricePoint[] = withFormattedFull.map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    timestampMs: entry.timestampMs,
    unitPriceCents: entry.unitPriceCents,
    priceLkr: entry.unitPriceCents / 100,
    dateLabel: buildShortAxisLabel(entry.fullDateLabel, includeYearSuffix),
    fullDateLabel: entry.fullDateLabel,
    previousUnitPriceCents: entry.previousUnitPriceCents,
    deltaCents: entry.deltaCents,
  }));

  return {
    source,
    points,
    filteredHistory,
    totalValidHistoryCount: allValidHistory.length,
    totalValidChartSourceCount: hasValidTrendSource ? allValidTrend.length : allValidHistory.length,
  };
}

/**
 * Selects a balanced subset of X-axis indices so labels do not overlap when many points exist.
 */
export function getVisibleAxisLabelIndices(totalPoints: number, maxLabels = 6): Set<number> {
  const visible = new Set<number>();
  if (totalPoints <= 0) {
    return visible;
  }
  if (totalPoints <= maxLabels) {
    for (let i = 0; i < totalPoints; i++) {
      visible.add(i);
    }
    return visible;
  }

  visible.add(0);
  visible.add(totalPoints - 1);

  const interiorSlots = maxLabels - 2;
  const step = (totalPoints - 1) / (interiorSlots + 1);
  for (let s = 1; s <= interiorSlots; s++) {
    const idx = Math.round(s * step);
    if (idx > 0 && idx < totalPoints - 1) {
      visible.add(idx);
    }
  }

  return visible;
}

/**
 * Computes nice rounded Y-axis bounds ensuring minPrice >= 0 and non-zero priceRange.
 */
function computeYAxisBounds(pricesLkr: number[]): { minPrice: number; maxPrice: number } {
  const rawMin = Math.min(...pricesLkr);
  const rawMax = Math.max(...pricesLkr);
  const span = rawMax - rawMin;

  // Choose rounding step proportional to data scale so grid lines read cleanly
  const scaleRef = Math.max(span, rawMax * 0.15, 10);
  let stepUnit = 10;
  if (scaleRef >= 500) {
    stepUnit = 100;
  } else if (scaleRef >= 200) {
    stepUnit = 50;
  } else if (scaleRef >= 60) {
    stepUnit = 20;
  }

  const pad = Math.max(stepUnit, span * 0.2);
  let minPrice = Math.max(0, Math.floor((rawMin - pad) / stepUnit) * stepUnit);
  let maxPrice = Math.ceil((rawMax + pad) / stepUnit) * stepUnit;

  if (maxPrice <= minPrice) {
    maxPrice = minPrice + stepUnit * 2;
  }

  return { minPrice, maxPrice };
}

/**
 * Computes responsive SVG geometry for valid chart points.
 * Returns empty geometry lists when no valid points exist (never invents synthetic axes).
 */
export function calculatePriceChartGeometry(
  validPoints: readonly ValidPricePoint[],
  dimensions: PriceChartDimensions = {}
): PriceChartGeometry {
  const width = dimensions.width ?? 520;
  const height = dimensions.height ?? 230;
  const paddingLeft = dimensions.paddingLeft ?? 68;
  const paddingRight = dimensions.paddingRight ?? 28;
  const paddingTop = dimensions.paddingTop ?? 28;
  const paddingBottom = dimensions.paddingBottom ?? 40;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + innerHeight;

  if (validPoints.length === 0) {
    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      innerWidth,
      innerHeight,
      baselineY,
      minPrice: 0,
      maxPrice: 0,
      priceRange: 0,
      gridSteps: [],
      points: [],
      linePathD: '',
      areaPathD: '',
      lastPoint: null,
    };
  }

  const pricesLkr = validPoints.map((p) => p.priceLkr);
  const { minPrice, maxPrice } = computeYAxisBounds(pricesLkr);
  const priceRange = maxPrice - minPrice || 1;

  const stepCount = 4;
  const stepSize = priceRange / stepCount;
  const gridSteps: PriceChartGridStep[] = [];
  for (let i = 0; i <= stepCount; i++) {
    const valueLkr = Math.round(minPrice + i * stepSize);
    const y = paddingTop + innerHeight - ((valueLkr - minPrice) / priceRange) * innerHeight;
    gridSteps.push({
      valueLkr,
      label: `LKR ${valueLkr.toLocaleString('en-US')}`,
      y,
    });
  }

  const visibleIndices = getVisibleAxisLabelIndices(validPoints.length, 6);

  const points: PriceChartPoint[] = validPoints.map((point, idx) => {
    const x =
      validPoints.length === 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft + (idx / (validPoints.length - 1)) * innerWidth;
    const clampedRatio = Math.min(1, Math.max(0, (point.priceLkr - minPrice) / priceRange));
    const y = paddingTop + innerHeight - clampedRatio * innerHeight;

    return {
      x,
      y,
      point,
      priceLkr: point.priceLkr,
      formattedRate: formatCompactLkrRate(point.unitPriceCents),
      showAxisLabel: visibleIndices.has(idx),
    };
  });

  let linePathD = '';
  let areaPathD = '';

  if (points.length >= 2) {
    linePathD = points
      .map((curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `L ${curr.x} ${curr.y}`))
      .join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    areaPathD = `${linePathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }

  return {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    innerWidth,
    innerHeight,
    baselineY,
    minPrice,
    maxPrice,
    priceRange,
    gridSteps,
    points,
    linePathD,
    areaPathD,
    lastPoint: points.length > 0 ? points[points.length - 1] : null,
  };
}

/**
 * Computes bounded SVG tooltip coordinates for a hovered or selected point without hardcoded years.
 */
export function computeTooltipLayout(
  targetPoint: PriceChartPoint,
  geometry: PriceChartGeometry
): PriceTooltipLayout {
  const dateText = targetPoint.point.fullDateLabel;
  const priceText = targetPoint.formattedRate;
  const maxChars = Math.max(dateText.length, priceText.length);
  const width = Math.max(118, Math.round(maxChars * 6.8) + 22);
  const height = 40;

  const minX = geometry.paddingLeft;
  const maxX = Math.max(minX, geometry.width - 8 - width);
  const x = Math.min(Math.max(targetPoint.x - width / 2, minX), maxX);

  const preferredAboveY = targetPoint.y - height - 10;
  const y =
    preferredAboveY >= 6
      ? preferredAboveY
      : Math.min(targetPoint.y + 12, geometry.height - height - 6);

  return {
    x,
    y,
    width,
    height,
    centerX: width / 2,
    dateText,
    priceText,
  };
}

export function getTimeframeDescription(timeframe: TimeframeFilter): string {
  switch (timeframe) {
    case '7d':
      return 'last 7 days';
    case '30d':
      return 'last 30 days';
    case 'all':
    default:
      return 'all time';
  }
}
