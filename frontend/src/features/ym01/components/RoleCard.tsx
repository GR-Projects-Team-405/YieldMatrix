import { useState, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, Leaf, LogIn, ShieldCheck, ShoppingBasket, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicRole } from '../api';

const roleVisuals: Record<PublicRole['role'], { icon: LucideIcon; image: string; alt: string; tone: string }> = {
  farmer: { icon: Leaf, image: 'photo-1500382017468-9049fed747ef', alt: 'Cultivated farmland and hillside fields', tone: 'farmer' },
  buyer: { icon: ShoppingBasket, image: 'photo-1542838132-92c53300491e', alt: 'Fresh produce displayed at a market', tone: 'buyer' },
  driver: { icon: Truck, image: 'photo-1566576912321-d58ddd7a6088', alt: 'Delivery vehicle ready for transport', tone: 'driver' },
  admin: { icon: ShieldCheck, image: 'photo-1454165804606-c3d57bc86b40', alt: 'Professional reviewing operational information', tone: 'admin' },
};

function safeRoleDestination(destination: string | undefined, expectedPath: '/signup' | '/login', role: string) {
  if (!destination) return null;
  try {
    const parsed = new URL(destination, 'https://yieldmatrix.invalid');
    if (parsed.origin !== 'https://yieldmatrix.invalid' || parsed.pathname !== expectedPath) return null;
    if (parsed.searchParams.get('role') !== role) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export default function RoleCard({ role }: { role: PublicRole }) {
  const visual = roleVisuals[role.role];
  const [imageFailed, setImageFailed] = useState(false);
  if (!visual) return null;
  const Icon = visual.icon;
  const registrationPath = role.role === 'admin' ? null : safeRoleDestination(role.registrationPath, '/signup', role.role);
  const loginPath = safeRoleDestination(role.loginPath, '/login', role.role);

  return <article className={`role-card role-card-${visual.tone}`}>
    <div className="role-card-image">
      {!imageFailed ? <img src={`https://images.unsplash.com/${visual.image}?auto=format&fit=crop&w=900&q=82`} alt={visual.alt} loading="lazy" onError={() => setImageFailed(true)} /> : <div className="role-image-fallback"><Icon size={30} /><span>{role.name}</span></div>}
      <span className="role-image-shade" />
      <span className="role-image-mark"><Icon size={15} /> {role.role === 'admin' ? 'AUTHORISED ACCESS' : 'PLATFORM ROLE'}</span>
    </div>
    <div className="role-card-content">
      <div className="role-card-top"><span className="role-icon"><Icon size={20} /></span><span className="role-eyebrow">{role.role.toUpperCase()}</span></div>
      <h3>{role.name}</h3>
      <p className="role-description">{role.description}</p>
      <RoleList title="Responsibilities" items={role.responsibilities} icon={<BadgeCheck size={15} />} />
      <RoleList title={role.role === 'admin' ? 'Administrator information' : 'Benefits'} items={role.benefits} icon={<Leaf size={15} />} />
      <div className="role-card-actions">
        {role.role === 'admin'
          ? loginPath ? <Link className="button button-primary" to={loginPath}>Administrator login <LogIn size={16} /></Link> : <UnavailablePath label="Administrator login" />
          : <>
              {role.role === 'buyer'
                ? <Link className="button button-primary" to="/roles/buyer">Buyer / Shop overview <ArrowRight size={16} /></Link>
                : registrationPath ? <Link className="button button-primary" to={registrationPath}>Explore {role.name} role <ArrowRight size={16} /></Link> : <UnavailablePath label={`${role.name} registration`} />}
              {role.role !== 'buyer' && (loginPath ? <Link className="role-login-link" to={loginPath}>Log in <LogIn size={14} /></Link> : <UnavailablePath label={`${role.name} login`} />)}
            </>}
      </div>
      {role.role === 'admin' && <p className="admin-access-note">Administrator registration is managed through authorised platform access.</p>}
    </div>
  </article>;
}

function RoleList({ title, items, icon }: { title: string; items?: string[]; icon: ReactNode }) {
  if (!items?.length) return null;
  return <div className="role-information-list"><strong>{title}</strong><ul>{items.map((item) => <li key={item}>{icon}<span>{item}</span></li>)}</ul></div>;
}

function UnavailablePath({ label }: { label: string }) {
  return <span className="role-link-unavailable" title="This destination is not configured for the existing application routes">{label} unavailable</span>;
}
