import { useLocation } from 'react-router-dom';
import { ComparisonProvider } from './ComparisonContext';
import { ProduceDetailsPage } from './ProduceDetailsPage';
import { SupplierComingSoon } from './SupplierComingSoon';
// YM12 · MHD Muhthas · Produce & suppliers
// The shared App mounts this module at both /buyer/produce/* and /buyer/suppliers/*.
export default function YM12() {
  const { pathname } = useLocation();
  const supplierRoute = pathname === '/buyer/suppliers' || pathname.startsWith('/buyer/suppliers/');
  const listingPath = pathname.startsWith('/buyer/produce/') ? pathname.slice('/buyer/produce/'.length).split('/')[0] : '';
  let listingId = listingPath;
  try { listingId = decodeURIComponent(listingPath); } catch { /* Invalid route text is handled as a missing listing. */ }
  return <ComparisonProvider>{supplierRoute ? <SupplierComingSoon /> : <ProduceDetailsPage listingId={listingId} />}</ComparisonProvider>;
}
