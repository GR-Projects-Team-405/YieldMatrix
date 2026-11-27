
import type { ReactNode } from 'react';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({
  children,
}: PublicLayoutProps) {
  return (
    <div className="ym03-public-layout">
      <PublicHeader />

      <main className="ym03-main">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}
