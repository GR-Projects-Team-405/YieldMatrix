import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, ChartNoAxesCombined, ChevronRight, Eye, Leaf, MapPin, Search, ShoppingBasket, Store, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { formatNumber, type PublicHarvest, ym01Get } from '../api';
import HarvestCard from '../components/HarvestCard';
import HarvestSkeleton from '../components/HarvestSkeleton';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';

const audience = [
  { icon: Store, title: 'Grocery & retail shops', text: 'Explore produce listings for local stores and neighbourhood markets.' },
  { icon: Building2, title: 'Restaurants & hotels', text: 'Review available crops, grades, quantities and districts for food service sourcing.' },
  { icon: Truck, title: 'Wholesale & food businesses', text: 'Discover public supply from participating farms across agricultural districts.' },
];

const benefits: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Search, title: 'Discover available harvests', description: 'Browse agricultural produce published through eligible public listings from approved farmers.' },
  { icon: ChartNoAxesCombined, title: 'Compare produce', description: 'Review crop categories, grades, available quantities, districts and listed prices.' },
  { icon: Eye, title: 'Review transparent information', description: 'Open harvest details, public farm information and any public traceability records available.' },
  { icon: MapPin, title: 'Discover wider supply', description: 'Explore listings from different participating agricultural districts in one marketplace.' },
];

const steps = [
  { number: '01', title: 'Explore harvests', description: 'Browse available public agricultural listings.', icon: Search },
  { number: '02', title: 'Compare listings', description: 'Review crops, grades, prices, quantities and districts.', icon: ChartNoAxesCombined },
  { number: '03', title: 'Review harvest details', description: 'Check listing information and any public traceability records.', icon: BadgeCheck },
  { number: '04', title: 'Continue from a listing', description: 'Choose Buy Now to open the Buyer sign-in flow for that harvest.', icon: ShoppingBasket },
];

export default function BuyerRoleIntroduction() {
  const [harvests, setHarvests] = useState<PublicHarvest[]>([]);
  const [harvestState, setHarvestState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setHarvestState('loading');
    ym01Get<PublicHarvest[]>('harvests', { params: { limit: 3, sort: 'newest' }, signal: controller.signal }).then(({ data }) => {
      if (!data.success || !Array.isArray(data.data)) throw new Error('Harvest listings unavailable');
      setHarvests(data.data);
      setHarvestState('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setHarvestState('error');
    });
    return () => controller.abort();
  }, [retryKey]);

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="buyer-page">
      <section className="buyer-hero">
        <div className="buyer-hero-image" aria-hidden="true"><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1900&q=88" alt="" /></div>
        <div className="ym-container buyer-hero-inner">
          <div className="buyer-hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> FOR BUYERS & SHOPS</span>
            <h1>Discover Fresh Harvests.<br /><em>Connect Directly with Farmers.</em></h1>
            <p>YieldMatrix connects buyers and shops with agricultural producers, making it easier to discover available harvests, compare produce and access transparent marketplace information.</p>
            <div className="hero-actions"><Link className="button button-primary" to="/catalogue">Explore Harvests <ArrowRight size={16} /></Link><a className="button button-quiet" href="#buyer-process">How It Works <ChevronRight size={16} /></a></div>
            <div className="buyer-hero-note"><BadgeCheck size={16} /><span>Explore real public listings from participating farms</span></div>
          </div>
          <div className="buyer-hero-aside"><span><ShoppingBasket size={19} /></span><strong>A clearer view of available produce</strong><small>Crop · Grade · Quantity · District · Price</small></div>
        </div>
      </section>

      <section className="buyer-audience section-space"><div className="ym-container">
        <div className="section-heading"><div><span className="eyebrow">A MARKETPLACE FOR PRODUCE PURCHASERS</span><h2>Find produce for<br /><em>your business.</em></h2></div><p>Grocery stores, restaurants and other produce purchasers can use the public marketplace to explore available harvest information from participating farms.</p></div>
        <div className="buyer-audience-grid">{audience.map(({ icon: Icon, title, text }) => <article className="buyer-audience-card" key={title}><span><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </div></section>

      <section className="buyer-benefits-section section-space"><div className="ym-container"><div className="center-heading"><span className="eyebrow">PUBLIC MARKETPLACE TOOLS</span><h2>Useful information for<br />your next sourcing decision.</h2><p>Explore the information already available on public harvest listings and their details.</p></div><div className="buyer-benefit-grid">{benefits.map(({ icon: Icon, title, description }) => <article className="buyer-benefit-card" key={title}><span><Icon size={20} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>

      <section className="buyer-process section-space" id="buyer-process"><div className="ym-container"><div className="section-heading"><div><span className="eyebrow">A SIMPLE WAY TO EXPLORE</span><h2>From discovery<br />to <em>your next step.</em></h2></div><p>Use public information to learn about available produce. Purchasing continues through the existing buyer account experience.</p></div><div className="buyer-steps-grid">{steps.map(({ number, title, description, icon: Icon }) => <article className="buyer-step-card" key={number}><div><span>{number}</span><Icon size={19} /></div><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>

      <section className="buyer-featured section-space"><div className="ym-container"><div className="section-heading section-heading-tight"><div><span className="eyebrow">CURRENT PUBLIC LISTINGS</span><h2>Explore available harvests</h2><p>Recent harvest listings from the public marketplace.</p></div><Link className="text-link" to="/catalogue">Browse all harvests <ArrowRight size={16} /></Link></div>
        {harvestState === 'loading' && <HarvestSkeleton count={3} />}
        {harvestState === 'error' && <EmptyState title="Harvest listings are unavailable" description="We couldn’t load public listings. Please try again." action={<button type="button" className="button button-primary" onClick={() => setRetryKey((key) => key + 1)}>Try again</button>} />}
        {harvestState === 'ready' && harvests.length === 0 && <EmptyState title="No public harvests are available" description="Eligible listings will appear here when farmers publish available produce." action={<Link className="button button-primary" to="/catalogue">View marketplace</Link>} />}
        {harvestState === 'ready' && harvests.length > 0 && <div className="harvest-grid">{harvests.map((harvest) => <div className="buyer-harvest-wrap" key={harvest.id}><HarvestCard harvest={harvest} /><div className="buyer-harvest-status"><span className="status-live-dot" />{harvest.harvestStatus || 'Status not provided'}</div><Link className="buyer-harvest-details" to={`/catalogue/${harvest.id}`}>View Details <ArrowRight size={14} /></Link></div>)}</div>}
      </div></section>

      <section className="buyer-cta-wrap"><div className="buyer-cta ym-container"><div className="buyer-cta-icon"><Leaf size={24} /></div><div className="buyer-cta-copy"><span className="eyebrow">YOUR NEXT SOURCING DISCOVERY</span><h2>Ready to Discover Your Next Harvest?</h2><p>Explore agricultural produce from participating farmers through the public marketplace.</p><div className="buyer-cta-actions"><Link className="button button-light" to="/catalogue">Explore Harvests <ArrowRight size={15} /></Link></div></div><div className="buyer-cta-art"><ShoppingBasket size={76} strokeWidth={1.2} /><span>Discover · Compare · Explore</span></div></div></section>
      <div className="ym-container buyer-marketplace-note"><Leaf size={15} /><span>Public pages provide listing information only. Private contact details and purchasing workflows remain within the existing account experience.</span><span className="buyer-count-note">{harvestState === 'ready' ? `${formatNumber(harvests.length)} recent listings shown` : ''}</span></div>
    </main>
    <PublicFooter />
  </div>;
}
