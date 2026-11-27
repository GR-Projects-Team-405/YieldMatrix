import { ArrowDown, Leaf, ShieldCheck, ShoppingBasket, Truck } from 'lucide-react';

export default function RoleIntroductionHero() {
  return <section className="roles-hero">
    <div className="roles-hero-image" role="img" aria-label="Agricultural terraces and green fields">
      <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=88" alt="" />
    </div>
    <div className="ym-container roles-hero-inner">
      <span className="eyebrow"><span className="eyebrow-dot" /> A NETWORK ROOTED IN AGRICULTURE</span>
      <h1>Be Part of<br /><em>YieldMatrix.</em></h1>
      <p>Meet the people who grow, source, move and support produce through an agricultural marketplace built around clearer connections.</p>
      <a className="roles-hero-link" href="#platform-roles">Meet the platform roles <ArrowDown size={15} /></a>
      <div className="role-sequence" aria-label="Platform roles">
        <span><Leaf size={16} /> Grow</span><i /><span><ShoppingBasket size={16} /> Source</span><i /><span><Truck size={16} /> Deliver</span><i /><span><ShieldCheck size={16} /> Steward</span>
      </div>
    </div>
  </section>;
}
