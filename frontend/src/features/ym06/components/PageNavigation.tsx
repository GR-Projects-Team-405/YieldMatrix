import { NavLink } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ClipboardCheck, LayoutDashboard } from 'lucide-react';

const links = [
  { to: '.', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'sales', label: 'Sales performance', icon: ChartNoAxesCombined },
  { to: 'harvests', label: 'Upcoming harvests', icon: CalendarDays },
  { to: 'completed-orders', label: 'Completed orders', icon: ClipboardCheck },
];

export default function PageNavigation() {
  return <nav className="ym06-page-nav" aria-label="Farmer overview pages">
    {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={16}/><span>{label}</span><ArrowRight className="ym06-nav-arrow" size={14}/></NavLink>)}
  </nav>;
}
