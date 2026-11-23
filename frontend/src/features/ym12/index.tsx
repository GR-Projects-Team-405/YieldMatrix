import { useLocation } from 'react-router-dom';
import { ComparisonProvider } from './ComparisonContext';
import { ProduceDetailsPage } from './ProduceDetailsPage';
import { SupplierComingSoon } from './SupplierComingSoon';
import { SupplierProfilePage } from './SupplierProfilePage';
import { SupplierPerformancePage } from './SupplierPerformancePage';
// YM12 · MHD Muhthas · Produce & suppliers
// The shared App mounts this module at both /buyer/produce/* and /buyer/suppliers/*.
export default function YM12() {
  const { pathname } = useLocation();
  const supplierBase = '/buyer/suppliers/';
  const supplierRoute = pathname === '/buyer/suppliers' || pathname.startsWith(supplierBase);
  const supplierPath = supplierRoute ? pathname.slice(supplierBase.length).split('/') : [];
  const supplierId = supplierPath[0] || '';
  const supplierPerformanceRoute = supplierPath[1] === 'performance';
  const listingPath = pathname.startsWith('/buyer/produce/') ? pathname.slice('/buyer/produce/'.length).split('/')[0] : '';
  let listingId = listingPath;
  try { listingId = decodeURIComponent(listingPath); } catch { /* Invalid route text is handled as a missing listing. */ }
  let decodedSupplierId = supplierId;
  try { decodedSupplierId = decodeURIComponent(supplierId); } catch { /* Invalid route text is handled as a missing supplier. */ }
  return <ComparisonProvider>{supplierPerformanceRoute && supplierId
    ? <SupplierPerformancePage supplierId={decodedSupplierId} />
    : supplierRoute && supplierId
      ? <SupplierProfilePage supplierId={decodedSupplierId} />
      : supplierRoute
        ? <SupplierComingSoon title="Supplier profile coming soon" />
        : <ProduceDetailsPage listingId={listingId} />}</ComparisonProvider>;
}
