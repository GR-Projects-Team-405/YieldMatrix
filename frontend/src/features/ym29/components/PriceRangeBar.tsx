// YM29 · Yasindu Janapriya · Statistical P25-Median-P75 price range display (n >= 5 enforced).

import { formatColomboDate, formatLkr } from '../formatters';
import type { PriceStatsPayload } from '../types';

export interface PriceRangeBarProps {
  price: PriceStatsPayload;
}

export function PriceRangeBar({ price }: PriceRangeBarProps) {
  if (price.status !== 'available' || price.p25_cents === null || price.median_cents === null || price.p75_cents === null) {
    return (
      <div className="ym29-stack" style={{ gap: 10 }}>
        <div className="ym29-price-grid">
          <div className="ym29-price-metric">
            <span>Low (P25)</span>
            <strong>—</strong>
          </div>
          <div className="ym29-price-metric">
            <span>Median</span>
            <strong>—</strong>
          </div>
          <div className="ym29-price-metric">
            <span>High (P75)</span>
            <strong>—</strong>
          </div>
        </div>
        <div className="ym29-note-box">
          <strong>{price.status === 'stale' ? 'Stale price window' : 'Insufficient observations'}:</strong> {price.note}
          <div style={{ marginTop: 4, fontSize: 12 }}>
            Observations: {price.observation_count} / {price.minimum_required} minimum · Window: {formatColomboDate(price.window_from)} – {formatColomboDate(price.window_until)}
          </div>
        </div>
      </div>
    );
  }

  const span = Math.max(price.p75_cents - price.p25_cents, 1);
  const medianRatio = Math.min(Math.max((price.median_cents - price.p25_cents) / span, 0), 1);
  const markerLeftPct = 18 + medianRatio * 64;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {price.district} · {price.grade} · n = {price.observation_count} observations ({formatColomboDate(price.window_from)} – {formatColomboDate(price.window_until)})
      </div>

      <div className="ym29-price-bar-track" aria-hidden="true">
        <div className="ym29-price-bar-fill" style={{ left: '18%', right: '18%' }} />
        <div className="ym29-price-bar-marker" style={{ left: `${markerLeftPct}%` }} />
      </div>

      <div className="ym29-price-grid">
        <div className="ym29-price-metric">
          <span>P25 (Lower quartile)</span>
          <strong>{formatLkr(price.p25_cents)}</strong>
        </div>
        <div className="ym29-price-metric">
          <span>Median (LKR/kg)</span>
          <strong>{formatLkr(price.median_cents)}</strong>
        </div>
        <div className="ym29-price-metric">
          <span>P75 (Upper quartile)</span>
          <strong>{formatLkr(price.p75_cents)}</strong>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
        Source: {price.source}. {price.note}
      </p>
    </div>
  );
}
