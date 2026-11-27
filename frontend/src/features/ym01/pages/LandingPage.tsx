import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Boxes, ChartNoAxesCombined, ChevronRight, Leaf, MapPin, Search, ShieldCheck, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { formatNumber, type LandingResponse, type PublicRole, ym01Get } from '../api';
import HarvestCard from '../components/HarvestCard';
import HarvestSkeleton from '../components/HarvestSkeleton';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';

const iconByRole = { farmer: Leaf, buyer: ShoppingBasket, driver: Truck, admin: ShieldCheck } as const;

export default function LandingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [landing, setLanding] = useState<LandingResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [roles, setRoles] = useState<PublicRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.allSettled([
      ym01Get<LandingResponse>('landing', { signal: controller.signal }),
      ym01Get<string[]>('categories', { signal: controller.signal }),
      ym01Get<string[]>('districts', { signal: controller.signal }),
      ym01Get<PublicRole[]>('roles', { signal: controller.signal }),
    ]).then(([landingResult, categoryResult, districtResult, roleResult]) => {
      if (controller.signal.aborted) return;
      if (landingResult.status === 'fulfilled' && landingResult.value.data.success) setLanding(landingResult.value.data.data);
      else setError(true);
      if (categoryResult.status === 'fulfilled' && categoryResult.value.data.success) setCategories(categoryResult.value.data.data);
      if (districtResult.status === 'fulfilled' && districtResult.value.data.success) setDistricts(districtResult.value.data.data);
      if (roleResult.status === 'fulfilled' && roleResult.value.data.success) setRoles(roleResult.value.data.data);
      setLoading(false);
    });
    return () => controller.abort();
  }, [reloadKey]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/catalogue${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  };
  const statistics = landing?.statistics;

  return <div className="ym-public-site">
    <PublicNavbar />
    <main>
      <section className="landing-hero">
        <div className="landing-hero-inner ym-container">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> YIELDMATRIX · AGRICULTURAL MARKETPLACE</span>
            <h1>Good food starts<br />with a <em>stronger connection.</em></h1>
            <p className="hero-description">Discover harvests from approved farms, explore what is growing nearby, and connect with a more transparent agricultural supply network.</p>
            <form className="hero-search" onSubmit={submitSearch} role="search">
              <Search size={19} aria-hidden="true" />
              <label className="sr-only" htmlFor="landing-search">Search crops</label>
              <input id="landing-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tomatoes, potatoes, and more" maxLength={100} />
              <button type="submit" aria-label="Search harvests"><ArrowRight size={19} /></button>
            </form>
            <div className="hero-actions"><Link className="button button-primary" to="/catalogue">Explore harvests <ArrowRight size={17} /></Link><Link className="button button-quiet" to="/roles">How it works <ArrowDownRight size={16} /></Link></div>
            <div className="hero-trust"><BadgeCheck size={17} /><span>Public information from approved farmer listings</span></div>
          </div>
          <div className="hero-visual">
            <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=88" alt="Green agricultural fields across a hillside" />
            <div className="hero-image-caption"><span className="hero-caption-icon"><Sprout size={17} /></span><span><strong>From field to marketplace</strong><small>Explore current public harvests</small></span><Link to="/catalogue" aria-label="Explore harvest marketplace"><ArrowUpRight size={18} /></Link></div>
            <span className="hero-image-mark"><span /> A network rooted in agriculture</span>
          </div>
        </div>
        <div className="hero-bottom-band"><div className="ym-container hero-stat-grid">
          <div className="hero-stat"><span>PUBLIC LISTINGS</span><strong>{loading ? '—' : formatNumber(statistics?.total_eligible_public_listings)}</strong><small>Eligible harvests</small></div>
          <div className="hero-stat"><span>ACTIVE CROPS</span><strong>{loading ? '—' : formatNumber(statistics?.total_active_crop_categories)}</strong><small>In the crop catalogue</small></div>
          <div className="hero-stat"><span>PARTICIPATING FARMS</span><strong>{loading ? '—' : formatNumber(statistics?.total_participating_approved_farmers)}</strong><small>Approved listing farmers</small></div>
          <div className="hero-stat"><span>AVAILABLE PRODUCE</span><strong>{loading ? '—' : formatNumber(statistics?.total_eligible_available_quantity_kg, 3)} <small>kg</small></strong><small>Across eligible listings</small></div>
        </div></div>
      </section>

      <section className="section-space ym-container">
        <div className="section-heading"><div><span className="eyebrow">THE YIELDMATRIX DIFFERENCE</span><h2>A better way to move<br /><em>from harvest to market.</em></h2></div><p>One shared place to explore supply, find local produce, and understand how each participant contributes to the chain.</p></div>
        <div className="feature-grid">
          {[
            { icon: Sprout, number: '01', title: 'Closer to the source', text: 'Explore public harvest information connected to approved farm accounts.' },
            { icon: Boxes, number: '02', title: 'Supply you can see', text: 'Review crop, grade, available quantity, price, harvest date and district.' },
            { icon: ChartNoAxesCombined, number: '03', title: 'A clearer marketplace', text: 'Browse eligible listings with current availability from the existing supply records.' },
            { icon: ShieldCheck, number: '04', title: 'Privacy by design', text: 'Public pages show useful harvest details while protecting contact and pickup information.' },
          ].map(({ icon: Icon, number, title, text }) => <article className="feature-card" key={number}><span className="feature-icon"><Icon size={20} /></span><span className="feature-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="process-section"><div className="ym-container"><div className="center-heading"><span className="eyebrow">HOW THE NETWORK WORKS</span><h2>Every role has a part<br />in the <em>journey.</em></h2><p>YieldMatrix brings the people and information around each harvest into one coordinated network.</p></div>
        <div className="process-grid">
          {[
            { number: '01', icon: Leaf, role: 'FARMER', title: 'Harvest becomes visible', text: 'Farmers maintain harvest records and publish produce that is ready to offer.' },
            { number: '02', icon: ShoppingBasket, role: 'BUYER', title: 'Produce gets discovered', text: 'Buyers explore crops, compare grades and availability, and plan their sourcing.' },
            { number: '03', icon: Truck, role: 'DRIVER', title: 'The journey is coordinated', text: 'Drivers support assigned transport activity and record important handovers.' },
          ].map(({ number, icon: Icon, role, title, text }) => <article className="process-card" key={number}><div className="process-card-top"><span>{number}</span><Icon size={19} /></div><small>{role}</small><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </div></section>

      <section className="harvest-showcase section-space"><div className="ym-container"><div className="section-heading section-heading-tight"><div><span className="eyebrow">FRESH FROM THE NETWORK</span><h2>Featured harvests</h2><p>Current public listings with available produce.</p></div><Link className="text-link" to="/catalogue">Browse marketplace <ArrowRight size={16} /></Link></div>
        {error && !landing ? <EmptyState title="Marketplace is unavailable" description="We couldn’t load current harvest information. Please try again." action={<button className="button button-primary" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>} /> : loading ? <HarvestSkeleton count={3} /> : landing?.featuredHarvests.length ? <div className="harvest-grid">{landing.featuredHarvests.slice(0, 3).map((harvest) => <HarvestCard key={harvest.id} harvest={harvest} />)}</div> : <EmptyState title="No public harvests yet" description="Eligible harvest listings will appear here when they become available." />}
      </div></section>

      <section className="recent-section section-space"><div className="ym-container"><div className="section-heading section-heading-tight"><div><span className="eyebrow">LATEST LISTINGS</span><h2>Recently published</h2><p>The newest eligible listings from the marketplace.</p></div><Link className="text-link" to="/catalogue?sort=newest">See all listings <ArrowRight size={16} /></Link></div>
        {loading ? <HarvestSkeleton count={3} /> : landing?.recentlyPublished.length ? <div className="harvest-grid">{landing.recentlyPublished.slice(0, 3).map((harvest) => <HarvestCard key={harvest.id} harvest={harvest} />)}</div> : <div className="inline-empty">{error ? 'Recent listings could not be loaded right now.' : 'No recently published harvests are available.'}</div>}
      </div></section>

      <section className="browse-section section-space"><div className="ym-container browse-grid"><div className="browse-panel"><div className="browse-panel-heading"><div><span className="eyebrow">CROP DIRECTORY</span><h2>Browse by crop</h2></div><Leaf size={21} /></div>{categories.length ? <div className="browse-chips">{categories.slice(0, 14).map((crop) => <Link key={crop} to={`/catalogue?crop=${encodeURIComponent(crop)}`}>{crop}<ChevronRight size={14} /></Link>)}</div> : <p className="subtle-copy">{loading ? 'Loading active crops…' : 'Active crops will appear here when available.'}</p>}</div>
        <div className="browse-panel district-panel"><div className="browse-panel-heading"><div><span className="eyebrow">LOCAL SUPPLY</span><h2>Explore districts</h2></div><MapPin size={21} /></div>{districts.length ? <div className="district-list">{districts.slice(0, 8).map((district, index) => <Link key={district} to={`/catalogue?district=${encodeURIComponent(district)}`}><span className="district-index">{String(index + 1).padStart(2, '0')}</span><span>{district}</span><ArrowUpRight size={16} /></Link>)}</div> : <p className="subtle-copy">{loading ? 'Loading districts…' : 'Districts will appear as eligible public listings become available.'}</p>}</div>
      </div></section>

      <section className="roles-preview-section section-space"><div className="ym-container"><div className="section-heading section-heading-tight"><div><span className="eyebrow">THE PEOPLE BEHIND THE NETWORK</span><h2>Four roles. One shared journey.</h2></div><Link className="text-link" to="/roles">Meet the roles <ArrowRight size={16} /></Link></div><div className="role-preview-grid">{roles.map((role) => { const Icon = iconByRole[role.role]; return <Link to="/roles" className="role-preview-card" key={role.role}><span><Icon size={19} /></span><small>{role.name}</small><strong>{role.description}</strong><ArrowUpRight size={16} /></Link>; })}{!roles.length && !loading && <p className="subtle-copy">Role information is temporarily unavailable.</p>}</div></div></section>

      <section className="closing-cta ym-container"><div className="closing-cta-copy"><span className="eyebrow">GROW · CONNECT · THRIVE</span><h2>Bring your next harvest<br />closer to opportunity.</h2><p>Explore what is available or learn how each role takes part in the YieldMatrix network.</p><div className="hero-actions"><Link className="button button-light" to="/catalogue">Explore harvests <ArrowRight size={16} /></Link><Link className="button button-outline-light" to="/roles">Discover your role</Link></div></div><div className="closing-cta-art"><Sprout size={106} strokeWidth={1} /><span>Rooted in local supply</span></div></section>
    </main>
    <PublicFooter />
  </div>;
}
