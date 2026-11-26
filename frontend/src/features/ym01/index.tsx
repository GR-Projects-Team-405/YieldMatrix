import { Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HarvestCatalogue from './pages/HarvestCatalogue';
import HarvestDetails from './pages/HarvestDetails';
import RoleIntroduction from './pages/RoleIntroduction';
import BuyerRoleIntroduction from './pages/BuyerRoleIntroduction';
import BuyerPurchaseEntry from './pages/BuyerPurchaseEntry';
import './public-pages.css';

export default function YM01() {
  const { pathname } = useLocation();
  if (pathname === '/') return <LandingPage />;
  if (pathname === '/catalogue') return <HarvestCatalogue />;
  if (/^\/catalogue\/[^/]+\/purchase\/?$/.test(pathname)) return <BuyerPurchaseEntry />;
  if (pathname.startsWith('/catalogue/')) return <HarvestDetails />;
  if (pathname === '/roles/buyer') return <BuyerRoleIntroduction />;
  if (pathname === '/roles') return <RoleIntroduction />;
  return <Navigate to="/" replace />;
}
