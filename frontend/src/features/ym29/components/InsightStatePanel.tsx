// YM29 · Yasindu Janapriya · Standardized non-zero rendering for unavailable, insufficient, and stale states.

import { AlertTriangle, Clock, Database, Info } from 'lucide-react';
import { Button } from '../../../components/Button';
import type { InsightStatus } from '../types';

export interface InsightStatePanelProps {
  status: InsightStatus | 'error';
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function InsightStatePanel({
  status,
  title,
  description,
  actionLabel,
  onAction,
}: InsightStatePanelProps) {
  const defaultTitle: Record<InsightStatus | 'error', string> = {
    available: 'Data available',
    insufficient_data: 'Insufficient history for this selection',
    stale: 'Data is stale — new advice suppressed',
    service_unavailable: 'Forecast not yet available (—)',
    empty: 'No market records yet',
    error: 'Unable to load market insight',
  };

  const Icon =
    status === 'stale'
      ? Clock
      : status === 'insufficient_data'
        ? Info
        : status === 'service_unavailable' || status === 'empty'
          ? Database
          : AlertTriangle;

  return (
    <div className="ym29-state-panel" role="status">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={18} aria-hidden="true" />
        <h3>{title || defaultTitle[status]}</h3>
      </div>
      <p>{description}</p>
      {status !== 'available' && (
        <p style={{ fontSize: 12 }}>
          Unavailable predictions are displayed as <strong>—</strong> and never as 0 kg. Trading workflows continue unaffected.
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
