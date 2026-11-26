import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import type { PublicRole } from '../api';
import { ym01Get } from '../api';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';
import RoleCard from '../components/RoleCard';
import RoleIntroductionHero from '../components/RoleIntroductionHero';

export default function RoleIntroduction() {
  const [roles, setRoles] = useState<PublicRole[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    ym01Get<PublicRole[]>('roles', { signal: controller.signal }).then(({ data }) => {
      if (!data.success || !Array.isArray(data.data)) throw new Error('Role information is unavailable');
      setRoles(data.data);
      setState('ready');
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [retryKey]);

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="roles-page">
      <RoleIntroductionHero />
      <section className="roles-content ym-container" id="platform-roles">
        <div className="section-heading roles-section-heading"><div><span className="eyebrow">FIND YOUR PLACE IN THE NETWORK</span><h2>Four roles. One shared<br /><em>agricultural journey.</em></h2></div><p>Learn what each role contributes to YieldMatrix. Registration and login links go to the existing account routes supplied by the platform.</p></div>
        {state === 'loading' && <div className="role-loading-grid" aria-label="Loading platform roles" aria-busy="true">{[1, 2, 3, 4].map((item) => <div key={item}><span /><span /><span /><span /></div>)}</div>}
        {state === 'error' && <EmptyState title="Role information is unavailable" description="Please try loading the platform roles again." action={<button type="button" className="button button-primary" onClick={() => setRetryKey((key) => key + 1)}>Try again</button>} />}
        {state === 'ready' && roles.length === 0 && <EmptyState title="No role information available" description="The platform has not published role information yet." />}
        {state === 'ready' && roles.length > 0 && <div className="role-cards-grid">{roles.map((role) => <RoleCard role={role} key={role.role} />)}</div>}
      </section>
      <section className="roles-cta ym-container"><div className="roles-cta-mark"><ShieldCheck size={24} /></div><div><span className="eyebrow">A CONNECTED MARKETPLACE</span><h2>Discover what’s growing<br /><em>across the network.</em></h2><p>Browse real public harvest listings from approved farms and see how YieldMatrix connects agricultural supply.</p><Link className="button button-light" to="/catalogue">Explore harvests <ArrowRight size={16} /></Link></div></section>
    </main>
    <PublicFooter />
  </div>;
}
