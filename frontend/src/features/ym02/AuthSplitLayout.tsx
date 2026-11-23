import type { ReactNode } from 'react';
import lineArt from './assets/auth-lineart.webp';
import logo from '../../assets/yieldmatrix-logo.webp';
import './ym02.css';

export interface AuthSplitLayoutProps {
  /** Small label above the headline, e.g. "Account access". */
  label: string;
  headline: string;
  body: string;
  /** Optional note pinned to the bottom of the brand panel. */
  note?: string;
  /** The form card shown on the right side. */
  children: ReactNode;
}

export default function AuthSplitLayout({ label, headline, body, note, children }: AuthSplitLayoutProps) {
  return (
    <div className="ym02-auth">
      <aside className="ym02-auth__brand" style={{ backgroundImage: `url(${lineArt})` }}>
        <div className="ym02-auth__copy">
          <p className="ym02-auth__label">{label}</p>
          <h1 className="ym02-auth__headline">{headline}</h1>
          <p className="ym02-auth__body">{body}</p>
        </div>
        {note && <p className="ym02-auth__note">{note}</p>}
      </aside>

      <main className="ym02-auth__main">
        <div className="ym02-auth__panel">
          <div className="ym02-auth__logo">
            <img src={logo} alt="" width={40} height={40} className="brand-mark" />
            <strong>
              Yield<span className="brand-accent">Matrix</span>
            </strong>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}