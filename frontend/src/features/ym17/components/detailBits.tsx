import type { ReactNode } from 'react';

/**
 * Small presentational pieces shared by the YM17 Allocation Details and
 * Allocation Decision Review pages, so both screens render labels, cards and
 * the response-window countdown identically.
 */

export interface FieldProps {
  label: string;
  value: ReactNode;
  title?: string;
}

/** Label-over-value pair used inside the detail cards. */
export function Field({ label, value, title }: FieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">{label}</p>
      <p className="text-sm md:text-base font-semibold text-[var(--text)] mt-1 break-words" title={title}>
        {value}
      </p>
    </div>
  );
}

export interface CardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}

/** Section card matching the inbox's card styling. */
export function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <section
      className={`ym-content-card bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-sm ${className}`}
    >
      <h2 className="text-lg md:text-xl font-bold text-[var(--text)]">{title}</h2>
      <p className="text-xs md:text-sm text-[var(--muted)] mt-1">{subtitle}</p>
      {children}
    </section>
  );
}

/**
 * Minutes left on the reservation, derived from the server's expiry instant.
 * The instant itself comes from PostgreSQL; only the countdown comparison uses
 * the browser clock, and an already-past expiry reports a closed window.
 */
export function responseWindow(reservationStatus: string | null, expiresAt: string | null): string | null {
  if (reservationStatus !== 'active' || !expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'Response window closed';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
}
