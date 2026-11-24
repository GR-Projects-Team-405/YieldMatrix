import type { ReactNode } from 'react';

export default function PageFrame({ eyebrow, title, description, headerAction, className = '', hideHeader = false, children }: { eyebrow?: string; title: string; description?: string; headerAction?: ReactNode; className?: string; hideHeader?: boolean; children: ReactNode }) {
  return <div className={`ym06-page-frame ${className}`.trim()}>
    {!hideHeader && <header className="ym06-page-header"><div><div className="ym06-eyebrow">{eyebrow || 'Farmer workspace'}</div><h2>{title}</h2>{description && <p>{description}</p>}</div>{headerAction && <div className="ym06-header-actions">{headerAction}</div>}</header>}
    {children}
  </div>;
}
