import type { HTMLAttributes, ReactNode } from 'react';

export interface ContentCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Optional visible card heading, rather than an HTML title tooltip. */
  title?: string;
  /** Optional supporting text beneath the heading. */
  subtitle?: string;
  /** Main card content. */
  children?: ReactNode;
  /** Additional CSS classes applied to the section. */
  className?: string;
}

/** A white content surface with a subtle border and 12px corners. */
export function ContentCard({ title, subtitle, children, className = '', ...props }: ContentCardProps) {
  return <section className={`ym-content-card ${className}`} {...props}>{(title || subtitle) && <header className="ym-card-heading">{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</header>}{children}</section>;
}
