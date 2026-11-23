import { NavLink } from 'react-router-dom';

const buyerTabs = [
  { to: '/buyer/wallet', label: 'Wallet overview', end: true },
  { to: '/buyer/wallet/funding', label: 'Simulated funding', end: false },
  { to: '/buyer/wallet/holds', label: 'Held funds by order', end: false },
  { to: '/buyer/wallet/refunds', label: 'Refund details', end: false },
];

export default function BuyerSubNav() {
  return (
    <nav className="ym28-subnav" aria-label="Buyer wallet sections">
      {buyerTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `ym28-subnav-link ${isActive ? 'active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}