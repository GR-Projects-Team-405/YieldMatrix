
import { CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../../../assets/yieldmatrix-logo.webp';

export default function PublicHeader() {
  return (
    <header className="ym03-header">
      <Link
        to="/signup"
        className="ym03-brand"
        aria-label="YieldMatrix - Choose account role"
      >
        <img
          src={logo}
          alt="YieldMatrix logo"
          className="ym03-brand-logo"
        />

        <div className="ym03-brand-details">
          <strong>YieldMatrix</strong>
          <span>GROW. CONNECT. THRIVE.</span>
        </div>
      </Link>

      <nav className="ym03-header-nav" aria-label="Main navigation">
        <Link to="/signup" className="ym03-nav-link">
          Help Centre
        </Link>

        <Link to="/login" className="ym03-nav-link">
          Log in
        </Link>

        <Link
          to="/login"
          className="ym03-user-icon"
          aria-label="Log in to YieldMatrix"
        >
          <CircleUserRound size={20} strokeWidth={1.8} />
        </Link>
      </nav>
    </header>
  );
}
