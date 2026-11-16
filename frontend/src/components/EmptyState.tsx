import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Heading explaining the empty state. */
  title: string;
  /** Supporting explanation or suggested next step. */
  description: string;
  /** Optional action, typically a Button component. */
  action?: ReactNode;
}

/** A centered empty-state message with an optional action. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <div className="ym-empty-state"><h3>{title}</h3><p>{description}</p>{action}</div>;
}
