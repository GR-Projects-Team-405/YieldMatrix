// YM29 · Yasindu Janapriya · Displays mandatory provenance (data date, method, demo/sample/stale labels).

import { formatColomboDate, formatColomboTime } from '../formatters';
import type { InsightStatus } from '../types';

export interface ProvenanceBarProps {
  status: InsightStatus;
  dataDate: string | null;
  method?: string;
  generatedAt?: string | null;
  isDemo: boolean;
  isSampleWeather?: boolean;
}

export function ProvenanceBar({
  status,
  dataDate,
  method,
  generatedAt,
  isDemo,
  isSampleWeather,
}: ProvenanceBarProps) {
  return (
    <div className="ym29-provenance-bar" aria-label="Data provenance">
      {isDemo ? (
        <span className="ym29-chip ym29-chip--demo">Demo data</span>
      ) : (
        <span className="ym29-chip ym29-chip--live">Live database</span>
      )}

      {status === 'stale' && <span className="ym29-chip ym29-chip--stale">Stale (&gt;7 days)</span>}
      {status === 'insufficient_data' && <span className="ym29-chip ym29-chip--demo">Insufficient history</span>}
      {status === 'service_unavailable' && <span className="ym29-chip ym29-chip--error">Forecast unavailable</span>}

      {isSampleWeather && <span className="ym29-chip ym29-chip--info">Sample weather</span>}

      <span className="ym29-chip">Data date: {formatColomboDate(dataDate)}</span>
      {method && <span className="ym29-chip">Method: {method}</span>}
      {generatedAt && <span className="ym29-chip">Generated: {formatColomboTime(generatedAt)} IST</span>}
    </div>
  );
}
