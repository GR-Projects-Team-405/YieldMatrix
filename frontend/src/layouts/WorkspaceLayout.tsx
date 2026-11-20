import yieldMatrixLogo from '../assets/yieldmatrix-logo.webp';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, Boxes, CalendarDays, ChartNoAxesCombined, CircleHelp, ClipboardCheck, ClipboardList, LandPlot, LayoutDashboard, LogOut, MapPin, Menu, Moon, Sun, Package, PackageCheck, Route, ScanLine, Search, Settings, ShieldCheck, Sprout, Store, TriangleAlert, Truck, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { useAuth, type Role } from '../context/AuthContext';
export const workspaceLabels: Record<Role, string> = { farmer: 'Farmer', buyer: 'Buyer / Shop', driver: 'Driver', admin: 'Admin' };
const navigation: Record<Role, { label: string; path: string; icon: LucideIcon }[]> = {
  farmer: [
    { label: "Overview", path: 'overview', icon: LayoutDashboard },
    { label: "My farms", path: 'farms', icon: LandPlot },
    { label: "My produce", path: 'produce', icon: Sprout },
    { label: "Harvest calendar", path: 'harvest-calendar', icon: CalendarDays },
    { label: "Buyer requests", path: 'buyer-requests', icon: ClipboardList },
    { label: "Allocations", path: 'allocations', icon: Boxes },
    { label: "Agri wallet", path: 'wallet', icon: Wallet },
    { label: "Market insights", path: 'market-insights', icon: ChartNoAxesCombined },
  ],
  buyer: [
    { label: "Overview", path: 'overview', icon: LayoutDashboard },
    { label: "Marketplace", path: 'marketplace', icon: Store },
    { label: "Bulk matching", path: 'bulk-matching', icon: Sprout },
    { label: "My demands", path: 'demands', icon: ClipboardList },
    { label: "My orders", path: 'orders', icon: Package },
    { label: "Commitments", path: 'commitments', icon: CalendarDays },
    { label: "Agri wallet", path: 'wallet', icon: Wallet },
    { label: "Market insights", path: 'market-insights', icon: ChartNoAxesCombined },
  ],
  driver: [
    { label: "Overview", path: 'overview', icon: LayoutDashboard },
    { label: "Assigned trips", path: 'trips', icon: Route },
    { label: "Pickup stops", path: 'pickups', icon: MapPin },
    { label: "My vehicle", path: 'vehicle', icon: Truck },
    { label: "Delivery history", path: 'history', icon: PackageCheck },
    { label: "Incidents", path: 'incidents', icon: TriangleAlert },
    { label: "Trace records", path: 'trace', icon: ScanLine },
  ],
  admin: [
    { label: "Overview", path: 'overview', icon: LayoutDashboard },
    { label: "People & access", path: 'people', icon: Users },
    { label: "Order operations", path: 'orders', icon: ClipboardCheck },
    { label: "Dispatch", path: 'dispatch', icon: Truck },
    { label: "Reconciliation", path: 'reconciliation', icon: Wallet },
    { label: "Market data", path: 'market-data', icon: ChartNoAxesCombined },
    { label: "Reference data", path: 'reference-data', icon: Settings },
    { label: "Audit trail", path: 'audit-trail', icon: ShieldCheck },
  ],
};
export default function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('yieldmatrix_theme', darkMode ? 'dark' : 'light'); } catch { /* Keep the toggle usable when storage is unavailable. */ }
  }, [darkMode]);
  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key === 'yieldmatrix_theme' || event.key === null) setDarkMode(event.newValue === 'dark');
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);
  if (!user) return null;
  const items = navigation[user.role];
  const path = pathname.split('/')[2] || 'overview';
  const page = items.find((item) => item.path === path)?.label || path.replaceAll('-', ' ');
  const isQrPreview = pathname.includes('/trace/qr/');
  return <div className="workspace">
    <a className="skip-link" href="#workspace-content">Skip to content</a>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`workspace-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label={`${workspaceLabels[user.role]} workspace`}>
      <NavLink className="brand" to={`/${user.role}/overview`} onClick={() => setMenuOpen(false)}><img className="brand-mark" src={yieldMatrixLogo} alt="" width={40} height={40} /><span><strong>Yield<span className="brand-accent">Matrix</span></strong><small>GROW. CONNECT. THRIVE.</small></span></NavLink>
      <div className="workspace-role"><span>WORKSPACE</span><strong>{workspaceLabels[user.role]}</strong></div>
      <p className="sidebar-caption">YOUR WORKSPACE</p>
      <nav className="workspace-navigation">{items.map(({ label, path: itemPath, icon: Icon }) => <NavLink key={itemPath} to={`/${user.role}/${itemPath}`} onClick={() => setMenuOpen(false)} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
      <footer className="sidebar-footer"><div className="growing-card"><Sprout size={20} aria-hidden="true" /><strong>Growing better, together.</strong><p>One shared network, from harvest to handover.</p></div><NavLink className="sidebar-link" to={`/${user.role}/help`} onClick={() => setMenuOpen(false)}><CircleHelp size={16} aria-hidden="true" />Help &amp; support</NavLink><button className="sidebar-link logout-button" onClick={logout}><LogOut size={16} aria-hidden="true" />Switch Role / Logout</button></footer>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><button className="mobile-menu icon-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="workspace-breadcrumb"><span>WORKSPACE</span><span aria-hidden="true">/</span><strong>{page}</strong></div><div className="topbar-actions"><label className="workspace-search"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search your workspace" aria-label="Search your workspace (module implementation pending)" disabled /></label><NavLink className="icon-button" to={`/${user.role}/notifications`} aria-label="Notifications"><Bell size={18} /></NavLink><button type="button" className="icon-button theme-toggle" aria-label="Dark mode" aria-pressed={darkMode} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button><NavLink className="user-pill" to={`/${user.role}/profile`} aria-label={`My profile: ${user.name}`}><UserRound size={18} aria-hidden="true" /><span>{user.name}</span></NavLink></div></header>
      <main id="workspace-content" className="workspace-content" tabIndex={-1}>{!isQrPreview && <div className="page-heading"><p>{workspaceLabels[user.role]} workspace</p><h1>{page}</h1></div>}<Outlet /></main>
    </div>
  </div>;
}
