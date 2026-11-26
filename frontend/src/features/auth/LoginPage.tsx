import { useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, Eye, EyeOff, Leaf, LockKeyhole, ShieldCheck, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import yieldMatrixLogo from '../../assets/yieldmatrix-logo.webp';
import './LoginPage.css';

const demoAccounts: { role: Exclude<Role, 'buyer'>; label: string; name: string }[] = [
  { role: 'farmer', label: 'Farmer', name: 'Demo Farmer' },
  { role: 'driver', label: 'Driver', name: 'Demo Driver' },
  { role: 'admin', label: 'Admin', name: 'Demo Admin' },
];
const accountIcons = { farmer: Leaf, buyer: ShoppingBasket, driver: Truck, admin: ShieldCheck } as const;
export default function LoginPage() {
  const { user, loading, demoLogin, loginWithPassword, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const requestedRole = searchParams.get('role');
  const buyerSignIn = requestedRole === 'buyer';
  const highlightedRole: Role | null = ['farmer', 'buyer', 'driver', 'admin'].includes(requestedRole ?? '') ? requestedRole as Role : null;
  const isPurchaseReturn = searchParams.get('action') === 'buy' || searchParams.get('returnTo')?.startsWith('/catalogue/');
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));
  const createAccountHref = `/signup?role=buyer${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}${isPurchaseReturn ? '&action=buy' : ''}` : ''}`;

  if (loading) return <main className="login-page login-page-redesigned"><div className="login-loading" role="status"><span /><p>Checking your session…</p></div></main>;

  if (user && buyerSignIn && user.role !== 'buyer') return <main className="login-page login-page-redesigned"><section className="login-workspace"><div className="login-workspace-inner login-mismatch-panel"><Link className="login-brand login-brand-mobile" to="/" aria-label="YieldMatrix home"><img className="brand-mark" src={yieldMatrixLogo} alt="" width={42} height={42} /><span>Yield<span className="brand-accent">Matrix</span></span></Link><span className="login-kicker login-mismatch-kicker"><ShieldCheck size={15} /> BUYER ACCOUNT ACCESS</span><h2>This account uses the {user.role} workspace</h2><p>The current session is for {user.name}. A Buyer / Shop account is required to continue with purchasing.</p><Alert type="warning">No buyer purchasing access was granted.</Alert><Button variant="primary" onClick={logout}>Sign out and continue as Buyer</Button><Link to="/catalogue" className="login-mismatch-link">Return to public harvests</Link></div></section></main>;

  if (user) return <Navigate to={buyerSignIn ? returnTo ?? '/catalogue' : `/${user.role}/overview`} replace />;

  async function submitBuyerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('buyer');
    setError('');
    try {
      await loginWithPassword(email.trim(), password, 'buyer');
      navigate(returnTo ?? '/catalogue', { replace: true });
    } catch (cause) {
      const message = (cause as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Unable to sign in. Check your email and password, then try again.');
    } finally {
      setPending(null);
    }
  }

  async function loginDemoRole(role: Exclude<Role, 'buyer'>) {
    if (buyerSignIn) {
      setError('Use your Buyer email address and password to continue.');
      return;
    }
    setPending(role);
    setError('');
    try { await demoLogin(role); navigate(`/${role}/overview`, { replace: true }); }
    catch { setError('Unable to sign in. Check that the backend is running, then try again.'); }
    finally { setPending(null); }
  }

  return <main className="login-page login-page-redesigned">
    <section className="login-showcase" aria-label="YieldMatrix marketplace">
      <div className="login-showcase-image"><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1500&q=88" alt="Green agricultural fields across a hillside" /></div>
      <div className="login-showcase-content">
        <Link className="login-brand login-brand-v2" to="/" aria-label="YieldMatrix home"><img className="brand-mark" src={yieldMatrixLogo} alt="" width={46} height={46} /><span>Yield<span className="brand-accent">Matrix</span><small>GROW · CONNECT · THRIVE</small></span></Link>
        <div className="login-showcase-copy"><span className="login-kicker"><Sprout size={14} /> A CONNECTED AGRICULTURAL NETWORK</span><h1>Closer to the source.<br /><em>Stronger together.</em></h1><p>One marketplace connecting harvests, farmers and the businesses that bring fresh produce to people.</p></div>
        <div className="login-showcase-caption"><span><BadgeCheck size={16} /></span><div><strong>Rooted in real supply</strong><small>Explore what’s growing across the network</small></div></div>
      </div>
    </section>
    <section className="login-workspace" aria-labelledby="login-heading">
      <div className="login-workspace-inner">
        <Link className="login-brand login-brand-mobile" to="/" aria-label="YieldMatrix home"><img className="brand-mark" src={yieldMatrixLogo} alt="" width={42} height={42} /><span>Yield<span className="brand-accent">Matrix</span></span></Link>
        <div className="login-heading-block"><span className="eyebrow"><span className="eyebrow-dot" /> {buyerSignIn ? 'BUYER / SHOP ACCOUNT' : 'SECURE WORKSPACE ACCESS'}</span><h2 id="login-heading">{buyerSignIn ? 'Buyer sign in' : 'Welcome to YieldMatrix'}</h2><p>{buyerSignIn ? 'Use the email address and password for your Buyer / Shop account.' : 'Choose the workspace you want to access.'}</p></div>
        {isPurchaseReturn && <div className="login-return-message" role="status"><ShoppingBasket size={17} /><span>Please log in with your Buyer account to continue purchasing.</span></div>}
        {buyerSignIn ? <form className="buyer-login-form" onSubmit={(event) => void submitBuyerLogin(event)}>
          <label className="buyer-auth-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="buyer-auth-field"><span>Password</span><span className="buyer-password-control"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" variant="primary" className="buyer-auth-submit" disabled={pending !== null}>{pending === 'buyer' ? 'Signing in…' : 'Sign in as Buyer'} <ArrowRight size={16} /></Button>
          <p className="login-create-account">New to YieldMatrix? <Link to={createAccountHref}>Create a Buyer / Shop account</Link></p>
        </form> : <>
          <div className="login-demo-notice"><ShieldCheck size={17} /><span><strong>Development demo access</strong><small>Choose a sample role to preview its workspace. Payments are simulated.</small></span></div>
          <div className="login-role-list">{demoAccounts.map(({ role, label, name }) => {
            const Icon = accountIcons[role];
            const isSelected = highlightedRole === role;
            return <Button key={role} variant={isSelected ? 'secondary' : 'outline'} className={`login-role-option${isSelected ? ' is-selected' : ''}`} disabled={pending !== null} onClick={() => void loginDemoRole(role)} aria-pressed={isSelected}>
              <span className="login-role-icon"><Icon size={19} /></span><span className="login-role-copy"><strong>{pending === role ? 'Signing you in…' : `Continue as ${label}`}</strong><small>{name} · Development sample</small></span><ArrowRight className="login-role-arrow" size={17} />
            </Button>;
          })}</div>
          {error && <Alert type="error">{error}</Alert>}
          {buyerSignIn && <p className="login-create-account">Need a Buyer / Shop account? <Link to={createAccountHref}>Create account</Link></p>}
        </>}
        <div className="login-workspace-footer"><span><LockKeyhole size={14} aria-hidden="true" /> Passwords are protected</span><Link to="/catalogue">Return to marketplace</Link></div>
      </div>
      <p className="login-mobile-tagline">Grow. Connect. Thrive.</p>
    </section>
  </main>;
}

function getSafeReturnTo(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (parsed.pathname !== '/catalogue' && !parsed.pathname.startsWith('/catalogue/')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
