import type { ReactNode } from 'react';

export interface AlertProps {
  /** Semantic tone. Defaults to info; error messages use an alert live region. */
  type?: 'success' | 'warning' | 'error' | 'info';
  /** Message content displayed beside the colored dot. */
  children: ReactNode;
}

/** An inline feedback message with a colored dot and accessible live region. */
export function Alert({ type = 'info', children }: AlertProps) {
  return <div className={`ym-alert ym-tone--${type}`} role={type === 'error' ? 'alert' : 'status'}><span className="ym-alert-dot" aria-hidden="true" /><span>{children}</span></div>;
}
