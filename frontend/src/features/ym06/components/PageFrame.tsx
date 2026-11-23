import type { ReactNode } from 'react';
import PageNavigation from './PageNavigation';

export default function PageFrame({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children: ReactNode }) {
  return <div className="ym06-page-frame">
    <header className="ym06-page-header"><div><div className="ym06-eyebrow">{eyebrow || 'Farmer overview'}</div><h2>{title}</h2>{description && <p>{description}</p>}</div><PageNavigation /></header>
    {children}
  </div>;
}
