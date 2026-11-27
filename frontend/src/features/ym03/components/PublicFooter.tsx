
import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="ym03-footer">
      <p>© YieldMatrix. All rights reserved.</p>

      <nav
        className="ym03-footer-links"
        aria-label="Footer navigation"
      >
        <Link to="/signup">Privacy Policy</Link>
        <Link to="/signup">Terms of Service</Link>
        <Link to="/signup">Support</Link>
      </nav>
    </footer>
  );
}
