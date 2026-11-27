import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Eye, EyeOff, Leaf, LockKeyhole } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import PublicFooter from '../ym01/components/PublicFooter';
import PublicNavbar from '../ym01/components/PublicNavbar';
import '../auth/LoginPage.css';

type RegisteredAccount = { name: string; email: string; role: 'buyer' };

function safeReturnTo(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || (url.pathname !== '/catalogue' && !url.pathname.startsWith('/catalogue/'))) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export default function BuyerRegistration() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<RegisteredAccount | null>(null);
  const returnTo = useMemo(() => safeReturnTo(searchParams.get('returnTo')), [searchParams]);
  const loginTo = `/login?role=buyer${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}&action=buy` : ''}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 12 || password.length > 128) {
      setError('Use a password between 12 and 128 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const { data } = await api.post<{ success: boolean; message: string; user: RegisteredAccount }>('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (!data.success || !data.user) throw new Error('Account registration could not be confirmed.');
      setAccount(data.user);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      const responseMessage = (cause as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(responseMessage || (cause instanceof Error ? cause.message : 'Unable to create your account. Please try again.'));
    } finally {
      setPending(false);
    }
  }

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="buyer-register-page">
      <div className="buyer-register-shell">
        <Link className="buyer-register-back" to={returnTo ?? '/catalogue'}><ArrowLeft size={15} /> Back to harvests</Link>
        {account ? <section className="buyer-register-card buyer-register-confirmation" aria-live="polite">
          <span className="buyer-register-icon"><BadgeCheck size={23} /></span>
          <span className="eyebrow">BUYER / SHOP REGISTRATION</span>
          <h1>Your account is ready</h1>
          <p>Thanks, {account.name}. Your Buyer / Shop account has been created. Sign in to continue to the marketplace.</p>
          <div className="buyer-register-actions"><Link className="button button-primary" to={loginTo}>Buyer Login <ArrowRight size={15} /></Link><Link className="button button-quiet" to="/catalogue">Browse Harvests</Link></div>
        </section> : <section className="buyer-register-card">
          <span className="buyer-register-icon"><Leaf size={23} /></span>
          <span className="eyebrow">JOIN THE MARKETPLACE</span>
          <h1>Create a Buyer / Shop account</h1>
          <p>Create an account with your email and password to access Buyer / Shop features.</p>
          {returnTo && <div className="login-return-message"><LockKeyhole size={16} /><span>Your selected harvest will be kept in the sign-in return link.</span></div>}
          <form className="buyer-registration-form" onSubmit={(event) => void submit(event)}>
            <label className="buyer-auth-field"><span>Full name</span><input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
            <label className="buyer-auth-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label className="buyer-auth-field"><span>Password <small>(12–128 characters)</small></span><span className="buyer-password-control"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <label className="buyer-auth-field"><span>Confirm password</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>
            {error && <Alert type="error">{error}</Alert>}
            <Button type="submit" variant="primary" className="buyer-auth-submit" disabled={pending}>{pending ? 'Creating account…' : 'Create Buyer Account'} <ArrowRight size={16} /></Button>
          </form>
          <p className="buyer-register-login">Already have an account? <Link to={loginTo}>Buyer Login</Link></p>
          <p className="buyer-register-privacy">Your password is sent over the existing API connection and stored only as a one-way password hash.</p>
        </section>}
      </div>
    </main>
    <PublicFooter />
  </div>;
}
