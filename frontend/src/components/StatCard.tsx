import type { ReactNode } from 'react';

export interface StatCardProps {
  /** Short metric label displayed above or beside the value. */
  label: ReactNode;
  /** Main metric, including any formatted unit or currency. */
  value: ReactNode;
  /** Optional supporting trend or explanatory text. */
  subtext?: string;
  /** Use the warm orange background. Defaults to false. */
  highlight?: boolean;
  /** Optional icon or circular badge displayed beside the label. */
  icon?: ReactNode;
  /** Additional CSS classes applied to the card. */
  className?: string;
}

/** Displays a labelled metric with optional icon and supporting text. */
export function StatCard({
  label,
  value,
  subtext,
  highlight = false,
  icon,
  className = '',
}: StatCardProps) {
  return (
    <section className={`ym-stat-card ${highlight ? 'ym-stat-card--highlight' : ''} ${className}`}>
      {icon ? (
        <div className="flex items-center justify-center gap-2 mb-2">
          {icon}
          <span className="text-[13px] font-medium text-[var(--muted)]">{label}</span>
        </div>
      ) : (
        <p className="ym-stat-label">{label}</p>
      )}

      <div className={icon ? 'text-[32px] font-bold text-[var(--text)] text-center tracking-tight' : 'ym-stat-value'}>
        {value}
      </div>

      {subtext && <p className="ym-stat-subtext text-center">{subtext}</p>}
    </section>
  );
}