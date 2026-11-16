export interface StatusBadgeProps {
  /** Status text. Known statuses receive semantic colors; unknown values remain neutral. */
  status: string;
}

/** Displays status text inside a semantic colored pill. */
export function StatusBadge({ status }: StatusBadgeProps) {
  const value = status.trim().toLowerCase().replaceAll('_', ' ');
  const tone = ['confirmed', 'active', 'approved', 'verified'].includes(value) ? 'success' : ['pending', 'awaiting response', 'draft'].includes(value) ? 'warning' : ['in transit', 'scheduled'].includes(value) ? 'info' : ['failed', 'rejected', 'disputed', 'expired'].includes(value) ? 'error' : 'neutral';
  return <span className={`ym-status ym-tone--${tone}`}>{status.trim() || 'Unknown'}</span>;
}
