// YM29 · Yasindu Janapriya · Rule-based recommendation reasons with separated evidence tags & dates.

import { formatColomboDate } from '../formatters';
import type { AdvisoryReason } from '../types';

export interface ReasonListProps {
  reasons: AdvisoryReason[];
}

export function ReasonList({ reasons }: ReasonListProps) {
  return (
    <div className="ym29-reason-list">
      {reasons.map((reason) => (
        <div
          key={`${reason.category}-${reason.title}`}
          className={`ym29-reason-item ym29-reason-item--${reason.category}`}
        >
          <div className="ym29-reason-meta">
            <span>{reason.evidence_type}</span>
            <span>·</span>
            <span>{formatColomboDate(reason.date)}</span>
          </div>
          <strong>{reason.title}</strong>
          <p>{reason.text}</p>
          <p style={{ fontSize: 11 }}>{reason.scope}</p>
        </div>
      ))}
    </div>
  );
}
