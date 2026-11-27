import { useState } from 'react';
import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import logo from '../../../assets/yieldmatrix-logo.webp';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/catalogue', label: 'Harvest Catalogue' },
  { to: '/roles', label: 'Roles' },
];

export default function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const logoutBuyer = () => {
    logout();
    setMenuOpen(false);
    navigate('/', { replace: true });
  };
  return <header className="public-header">
    <div className="public-nav-wrap">
      <Link className="public-brand" to="/" aria-label="YieldMatrix home" onClick={() => setMenuOpen(false)}>
        <img src={logo} alt="" width="42" height="42" />
        <span><strong>Yield<span>Matrix</span></strong><small>GROW · CONNECT · THRIVE</small></span>
      </Link>
      <button className="public-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        {menuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>
      <nav className={`public-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        {links.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>{item.label}</NavLink>)}
        {user?.role === 'buyer' && <div className="public-nav-actions">
            <Link className="public-buyer-profile" to="/buyer/profile" onClick={() => setMenuOpen(false)}><UserRound size={16} /><span>{user.name}</span></Link>
            <button className="public-logout-button" type="button" onClick={logoutBuyer}><LogOut size={15} /><span>Logout</span></button>
        </div>}
      </nav>
    </div>
  </header>;
}
