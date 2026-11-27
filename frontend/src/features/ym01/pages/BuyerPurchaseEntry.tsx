import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, LockKeyhole, PackageCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { EmptyState } from '../../../components/EmptyState';
import { formatDate, formatNumber, type PublicHarvest, type PublicRole, ym01Get } from '../api';
import HarvestImage from '../components/HarvestImage';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rolePath(path: string | undefined, expectedPath: '/signup' | '/login') {
  if (!path) return null;
  try {
    const parsed = new URL(path, 'https://yieldmatrix.invalid');
    if (parsed.origin !== 'https://yieldmatrix.invalid' || parsed.pathname !== expectedPath || parsed.searchParams.get('role') !== 'buyer') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function preservePurchaseIntent(destination: string, harvestId: string, returnTo: string) {
  const parsed = new URL(destination, window.location.origin);
  if (parsed.origin !== window.location.origin) return null;
  parsed.searchParams.set('returnTo', returnTo);
  parsed.searchParams.set('action', 'buy');
  parsed.searchParams.set('harvestId', harvestId);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export default function BuyerPurchaseEntry() {
  const { '*': wildcard } = useParams();
  const harvestId = decodeURIComponent(wildcard?.split('/')[0] ?? '');
  const { user, loading: authLoading } = useAuth();
  const [harvest, setHarvest] = useState<PublicHarvest | null>(null);
  const [buyerRole, setBuyerRole] = useState<PublicRole | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!UUID_PATTERN.test(harvestId)) {
      setPageState('not-found');
      return;
    }
    const controller = new AbortController();
    setPageState('loading');
    Promise.allSettled([
      ym01Get<PublicHarvest>(`harvests/${encodeURIComponent(harvestId)}`, { signal: controller.signal }),
      ym01Get<PublicRole[]>('roles', { signal: controller.signal }),
    ]).then(([harvestResult, roleResult]) => {
      if (controller.signal.aborted) return;
      if (harvestResult.status === 'fulfilled' && harvestResult.value.data.success && harvestResult.value.data.data) {
        setHarvest(harvestResult.value.data.data);
        setPageState('ready');
      } else {
        const status = harvestResult.status === 'rejected' ? harvestResult.reason?.response?.status : 404;
        setPageState(status === 404 ? 'not-found' : 'error');
      }
      if (roleResult.status === 'fulfilled' && roleResult.value.data.success && Array.isArray(roleResult.value.data.data)) {
        setBuyerRole(roleResult.value.data.data.find((role) => role.role === 'buyer') ?? null);
      }
    });
    return () => controller.abort();
  }, [harvestId, retryKey]);

  const returnTo = useMemo(() => `/catalogue/${encodeURIComponent(harvestId)}/purchase?action=buy`, [harvestId]);
  const loginTo = rolePath(buyerRole?.loginPath, '/login');
  const registerTo = rolePath(buyerRole?.registrationPath, '/signup');
  const loginHref = loginTo && UUID_PATTERN.test(harvestId) ? preservePurchaseIntent(loginTo, harvestId, returnTo) : null;
  const registerHref = registerTo && UUID_PATTERN.test(harvestId) ? preservePurchaseIntent(registerTo, harvestId, returnTo) : null;

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="purchase-entry-page ym-container">
      <div className="purchase-breadcrumb"><Link to="/catalogue"><ArrowLeft size={15} /> Back to harvests</Link><span>Purchase entry</span></div>
      {pageState === 'loading' && <div className="purchase-entry-skeleton" aria-busy="true" aria-label="Loading harvest"><span /><span /><span /></div>}
      {pageState === 'not-found' && <EmptyState title="Harvest listing unavailable" description="This listing may have expired or is no longer available for public purchase." action={<Link to="/catalogue" className="button button-primary">Browse harvests</Link>} />}
      {pageState === 'error' && <EmptyState title="Could not load this harvest" description="Please try again or return to the public catalogue." action={<button className="button button-primary" type="button" onClick={() => setRetryKey((key) => key + 1)}>Try again</button>} />}
      {pageState === 'ready' && harvest && <>
        <section className="purchase-entry-heading"><span className="eyebrow"><span className="eyebrow-dot" /> BUYER PURCHASE</span><h1>Continue with this harvest</h1><p>Your selected listing is saved in this page’s return link. Order placement is only possible when the buyer account and order services are available.</p></section>
        <section className="purchase-entry-grid">
          <article className="purchase-item-card"><HarvestImage cropName={harvest.cropName} className="purchase-item-image" /><div className="purchase-item-content"><span className="eyebrow">{harvest.grade}</span><h2>{harvest.cropName}</h2><p>{harvest.farmName} · {harvest.district} District</p><div className="purchase-item-facts"><span>Available <strong>{formatNumber(harvest.availableQuantityKg, 3)} kg</strong></span><span>Price / kg <strong>LKR {formatNumber(harvest.unitPriceLkrPerKg, 2)}</strong></span><span>Harvest date <strong>{formatDate(harvest.harvestDate)}</strong></span><span>Status <strong>{harvest.harvestStatus}</strong></span></div></div></article>
          <aside className="purchase-access-panel">
            {!user && !authLoading && <><span className="purchase-access-icon"><LockKeyhole size={20} /></span><h2>Sign in to continue</h2><p>Sign in with a Buyer account to continue. Your selected harvest stays attached to the return link.</p><div className="purchase-access-actions">{loginHref ? <Link className="button button-primary" to={loginHref}>Buyer Login <ArrowRight size={15} /></Link> : <span className="purchase-dependency">Buyer login route is unavailable from the roles API.</span>}{registerHref ? <Link className="button button-quiet" to={registerHref}>Create Buyer Account</Link> : <span className="purchase-dependency">Buyer registration route is unavailable from the roles API.</span>}</div></>}
            {authLoading && <div className="purchase-checking" role="status">Checking account…</div>}
            {user && user.role !== 'buyer' && <><span className="purchase-access-icon warning"><AlertTriangle size={20} /></span><h2>Buyer account required</h2><p>You are signed in with the {user.role} role. Purchasing is reserved for buyer accounts.</p><Link className="button button-quiet" to={`/${user.role}/overview`}>Go to your workspace <ArrowRight size={15} /></Link></>}
            {user?.role === 'buyer' && <><span className="purchase-access-icon"><PackageCheck size={20} /></span><h2>Signed in as Buyer</h2><p>Your account is ready. Order creation and checkout are not yet provided by YM18, so no purchase has been submitted.</p><div className="purchase-access-actions"><Link className="button button-primary" to="/catalogue">Continue browsing <ArrowRight size={15} /></Link><Link className="button button-quiet" to="/buyer/orders">Buyer order history</Link></div></>}
          </aside>
        </section>
        <div className="purchase-entry-safe-note"><BadgeCheck size={16} /><span>This is a public listing preview. No quantity is reserved and no order has been placed.</span></div>
      </>}
    </main>
    <PublicFooter />
  </div>;
}
