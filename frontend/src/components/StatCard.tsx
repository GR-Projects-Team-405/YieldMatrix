import type { ReactNode } from 'react';

export interface StatCardProps {
  /** Short metric label displayed above the value. */
  label: string;
  /** Main metric, including any formatted unit or currency. */
  value: ReactNode;
  /** Optional supporting trend or explanatory text. */
  subtext?: string;
  /** Use the warm orange background. Defaults to false. */
  highlight?: boolean;
}

/** Displays a labelled metric with optional supporting text. */
export function StatCard({ label, value, subtext, highlight = false }: StatCardProps) {
  return <section className={`ym-stat-card ${highlight ? 'ym-stat-card--highlight' : ''}`}><p className="ym-stat-label">{label}</p><p className="ym-stat-value">{value}</p>{subtext && <p className="ym-stat-subtext">{subtext}</p>}</section>;
}
